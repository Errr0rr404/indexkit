import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/webmasters";

interface TokenCache {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
}

export function credentialKind(json: unknown): "service_account" | "installed" | "unknown" {
  if (!json || typeof json !== "object") return "unknown";
  const record = json as { type?: string; installed?: unknown };
  if (record.type === "service_account") return "service_account";
  if (record.installed) return "installed";
  return "unknown";
}

export function readCachedAccessToken(cachePath: string, nowMs: number): string | null {
  if (!fs.existsSync(cachePath)) return null;
  const cache = JSON.parse(fs.readFileSync(cachePath, "utf8")) as TokenCache;
  if (!cache.access_token || cache.expiry_date - nowMs < 60_000) return null;
  return cache.access_token;
}

export async function getAccessToken(opts: {
  credentialsPath: string;
  tokenCachePath: string;
  openUrl?: (url: string) => void;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const cached = readCachedAccessToken(opts.tokenCachePath, Date.now());
  if (cached) return cached;
  const json = JSON.parse(fs.readFileSync(opts.credentialsPath, "utf8")) as unknown;
  const kind = credentialKind(json);
  if (kind === "service_account") {
    const auth = new GoogleAuth({ keyFile: opts.credentialsPath, scopes: [SCOPE] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) throw new Error("Google auth returned no access token");
    return token.token;
  }
  if (kind !== "installed") throw new Error("Google credential file must be a service account or installed app client");
  const refreshed = await refreshIfPossible(json, opts.tokenCachePath, opts.fetchImpl ?? fetch);
  if (refreshed) return refreshed;
  return authorizeInstalled(json, opts);
}

async function refreshIfPossible(json: unknown, cachePath: string, fetchImpl: typeof fetch): Promise<string | null> {
  if (!fs.existsSync(cachePath)) return null;
  const cache = JSON.parse(fs.readFileSync(cachePath, "utf8")) as TokenCache;
  if (!cache.refresh_token) return null;
  const installed = (json as { installed: { client_id: string; client_secret: string } }).installed;
  const body = new URLSearchParams({
    client_id: installed.client_id,
    client_secret: installed.client_secret,
    refresh_token: cache.refresh_token,
    grant_type: "refresh_token",
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  const token = await response.json() as { access_token: string; expires_in: number; refresh_token?: string };
  writeCache(cachePath, token.access_token, token.refresh_token ?? cache.refresh_token, Date.now() + token.expires_in * 1000);
  return token.access_token;
}

async function authorizeInstalled(json: unknown, opts: {
  tokenCachePath: string;
  openUrl?: (url: string) => void;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const installed = (json as { installed: { client_id: string; client_secret: string } }).installed;
  const server = http.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("OAuth loopback failed to bind");
  const redirectUri = `http://127.0.0.1:${address.port}`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", installed.client_id);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  const code = await new Promise<string>((resolve, reject) => {
    server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", redirectUri);
      const value = url.searchParams.get("code");
      response.statusCode = 200;
      response.end("Indexkit received the Google authorization code. You can close this tab.");
      server.close();
      if (!value) reject(new Error("Google redirect did not include a code"));
      else resolve(value);
    });
    (opts.openUrl ?? defaultOpen)(authUrl.toString());
  });
  const body = new URLSearchParams({
    code,
    client_id: installed.client_id,
    client_secret: installed.client_secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await (opts.fetchImpl ?? fetch)("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Google token exchange failed: HTTP ${response.status}`);
  const token = await response.json() as { access_token: string; expires_in: number; refresh_token?: string };
  writeCache(opts.tokenCachePath, token.access_token, token.refresh_token, Date.now() + token.expires_in * 1000);
  return token.access_token;
}

function writeCache(cachePath: string, accessToken: string, refreshToken: string | undefined, expiry: number): void {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  const payload: TokenCache = { access_token: accessToken, expiry_date: expiry };
  if (refreshToken) payload.refresh_token = refreshToken;
  fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2));
}

function defaultOpen(url: string): void {
  process.stderr.write(`Open this URL to authorize Search Console:\n${url}\n`);
}
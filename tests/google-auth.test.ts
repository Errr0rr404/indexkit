import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { credentialKind, getAccessToken, readCachedAccessToken } from "../src/google-auth.js";

describe("google auth", () => {
  it("detects credential files and reads a fresh cache", () => {
    expect(credentialKind({ type: "service_account" })).toBe("service_account");
    expect(credentialKind({ installed: { client_id: "id" } })).toBe("installed");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexkit-auth-"));
    const cache = path.join(dir, "token.json");
    fs.writeFileSync(cache, JSON.stringify({ access_token: "ya29.cached", expiry_date: Date.now() + 120_000 }));
    expect(readCachedAccessToken(cache, Date.now())).toBe("ya29.cached");
  });

  it("exchanges an oauth code from the loopback", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexkit-auth-"));
    const credentialsPath = path.join(dir, "client.json");
    fs.writeFileSync(credentialsPath, JSON.stringify({
      installed: { client_id: "id", client_secret: "secret", redirect_uris: ["http://127.0.0.1"] },
    }));
    const token = await getAccessToken({
      credentialsPath,
      tokenCachePath: path.join(dir, "token.json"),
      openUrl(url) {
        const redirect = new URL(url).searchParams.get("redirect_uri");
        if (!redirect) throw new Error("missing redirect");
        void fetch(`${redirect}?code=abc`);
      },
      fetchImpl: async (url) => {
        expect(String(url)).toBe("https://oauth2.googleapis.com/token");
        return new Response(JSON.stringify({ access_token: "ya29.fresh", expires_in: 3600, refresh_token: "refresh" }), { status: 200 });
      },
    });
    expect(token).toBe("ya29.fresh");
  });
});
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "./fsutil.js";
import type { RawRoute, RouteRecord } from "./types.js";

const DISCOVER_SYSTEM = 'You extract HTTP page routes from a web app. Return a JSON array only. Each item is {"path":"/pricing","sourcePath":"app/pricing/page.tsx","dynamic":false}. path is the URL path. sourcePath must be one of the files you were given. Include only pages a search engine should be able to request. Omit API handlers, server actions, and asset files. No markdown.';
const CLASSIFY_SYSTEM = 'You label web routes as indexable or not. Return a JSON array only. Each item is {"path":"/pricing","indexable":true,"reason":"public page"}. Use only paths from the input. Mark indexable false for admin, auth, account, API, and draft pages. No markdown.';

export function extractJsonArray(text: string): unknown {
  const fenced = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("MiniMax response did not contain a JSON array");
  return JSON.parse(body.slice(start, end + 1));
}

export function acceptModelRoutes(parsed: unknown, allowedSourcePaths: Set<string>): RawRoute[] {
  if (!Array.isArray(parsed)) return [];
  const routes: RawRoute[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as { path?: unknown; sourcePath?: unknown; dynamic?: unknown };
    if (typeof record.path !== "string" || !record.path.startsWith("/")) continue;
    if (typeof record.sourcePath !== "string" || !allowedSourcePaths.has(record.sourcePath)) continue;
    routes.push({
      path: record.path,
      sourcePath: record.sourcePath,
      dynamic: record.dynamic === true || /[\[\]:]/.test(record.path),
    });
  }
  return routes;
}

export function candidateFiles(project: string): { path: string; text: string }[] {
  const interesting = /(page|route|router|server|nuxt\.config|astro\.config)\./i;
  return walkFiles(project, (abs) => interesting.test(path.basename(abs)) && /\.(js|jsx|ts|tsx|mjs|vue|svelte|astro|md|mdx)$/.test(abs))
    .slice(0, 30)
    .map((abs) => ({
      path: path.relative(project, abs),
      text: fs.readFileSync(abs, "utf8").slice(0, 6000),
    }));
}

export function createMiniMaxModel(opts: {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  cachePath: string;
  fetchImpl?: typeof fetch;
}): {
  discoverFromFiles(input: { project: string; files: { path: string; text: string }[] }): Promise<RawRoute[]>;
  classify(routes: RouteRecord[]): Promise<RouteRecord[]>;
} {
  const model = opts.model ?? "MiniMax-M3";
  const baseUrl = opts.baseUrl ?? "https://api.minimax.io/v1";
  return {
    async discoverFromFiles(input) {
      const content = await chat(opts, baseUrl, model, DISCOVER_SYSTEM, JSON.stringify(input.files));
      return acceptModelRoutes(extractJsonArray(content), new Set(input.files.map((file) => file.path)));
    },
    async classify(routes) {
      const content = await chat(opts, baseUrl, model, CLASSIFY_SYSTEM, JSON.stringify(routes.map((route) => ({
        path: route.path,
        sourcePath: route.sourcePath,
      }))));
      const parsed = extractJsonArray(content);
      if (!Array.isArray(parsed)) return routes;
      const labels = new Map<string, { indexable: boolean; reason: string }>();
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const record = item as { path?: unknown; indexable?: unknown; reason?: unknown };
        if (typeof record.path !== "string") continue;
        labels.set(record.path, {
          indexable: record.indexable === true,
          reason: typeof record.reason === "string" ? record.reason : "minimax",
        });
      }
      return routes.map((route) => {
        const label = labels.get(route.path);
        if (!label) return route;
        return { ...route, indexable: route.indexable && label.indexable, reason: label.reason };
      });
    },
  };
}

async function chat(
  opts: { apiKey: string; cachePath: string; fetchImpl?: typeof fetch },
  baseUrl: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const body = JSON.stringify({
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const key = createHash("sha256").update(body).digest("hex");
  const cache = readCache(opts.cachePath);
  if (cache[key]) return cache[key];
  const response = await (opts.fetchImpl ?? fetch)(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
      "content-type": "application/json",
    },
    body,
  });
  if (!response.ok) throw new Error(`MiniMax failed: HTTP ${response.status}`);
  const json = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("MiniMax response did not include message content");
  cache[key] = content;
  fs.mkdirSync(path.dirname(opts.cachePath), { recursive: true });
  fs.writeFileSync(opts.cachePath, JSON.stringify(cache));
  return content;
}

function readCache(cachePath: string): Record<string, string> {
  if (!fs.existsSync(cachePath)) return {};
  return JSON.parse(fs.readFileSync(cachePath, "utf8")) as Record<string, string>;
}
import fs from "node:fs";
import path from "node:path";
import type { RawRoute } from "../types.js";

const PAGE_FILES = ["+page.svelte", "+page.ts", "+page.js", "+page.server.ts", "+page.server.js"];

function walk(project: string, dir: string, urlParts: string[], routes: RawRoute[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const page = PAGE_FILES.find((name) => entries.some((entry) => entry.isFile() && entry.name === name));
  if (page) {
    routes.push({
      path: urlParts.length === 0 ? "/" : `/${urlParts.join("/")}`,
      sourcePath: path.relative(project, path.join(dir, page)),
      dynamic: urlParts.some((part) => part.includes("[")),
    });
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const grouped = entry.name.startsWith("(") && entry.name.endsWith(")");
    const nextParts = grouped ? urlParts : [...urlParts, entry.name];
    walk(project, path.join(dir, entry.name), nextParts, routes);
  }
}

export function discoverSvelteKit(project: string): RawRoute[] {
  const routes: RawRoute[] = [];
  walk(project, path.join(project, "src/routes"), [], routes);
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}
import fs from "node:fs";
import path from "node:path";
import type { RawRoute } from "../types.js";

const PAGE_FILES = ["page.tsx", "page.ts", "page.jsx", "page.js", "page.mdx"];

function appRoots(project: string): string[] {
  return ["app", "src/app"].map((rel) => path.join(project, rel)).filter((abs) => fs.existsSync(abs));
}

function isRouteGroup(name: string): boolean {
  return name.startsWith("(") && name.endsWith(")") && !name.startsWith("(.") && !name.startsWith("(..");
}

function isIgnoredDir(name: string): boolean {
  return name.startsWith("_") || name.startsWith("@") || name.startsWith("(.") || name.startsWith("(..");
}

function walk(project: string, dir: string, urlParts: string[], routes: RawRoute[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const page = PAGE_FILES.find((name) => entries.some((entry) => entry.isFile() && entry.name === name));
  if (page) {
    const routePath = urlParts.length === 0 ? "/" : `/${urlParts.join("/")}`;
    routes.push({
      path: routePath,
      sourcePath: path.relative(project, path.join(dir, page)),
      dynamic: urlParts.some((part) => part.includes("[")),
    });
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (isIgnoredDir(entry.name)) continue;
    const nextParts = isRouteGroup(entry.name) ? urlParts : [...urlParts, entry.name];
    walk(project, path.join(dir, entry.name), nextParts, routes);
  }
}

export function discoverNextApp(project: string): RawRoute[] {
  const routes: RawRoute[] = [];
  for (const root of appRoots(project)) walk(project, root, [], routes);
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}
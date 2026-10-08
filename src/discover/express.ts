import fs from "node:fs";
import path from "node:path";
import { walkFiles } from "../fsutil.js";
import type { RawRoute } from "../types.js";

const CALL = /(?:^|[^.\w])(?:app|router|server)\.(get|head)\(\s*['"`](\/[^'"`]*)['"`]/g;
const SOURCE = /\.(js|jsx|ts|tsx|mjs|cjs)$/;

export function discoverExpress(project: string): RawRoute[] {
  const routes: RawRoute[] = [];
  const seen = new Set<string>();
  for (const abs of walkFiles(project, (file) => SOURCE.test(file))) {
    const text = fs.readFileSync(abs, "utf8");
    for (const match of text.matchAll(CALL)) {
      const routePath = match[2];
      if (!routePath || routePath.includes(":") || routePath.includes("*")) continue;
      if (seen.has(routePath)) continue;
      seen.add(routePath);
      routes.push({
        path: routePath,
        sourcePath: path.relative(project, abs),
        dynamic: false,
      });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}
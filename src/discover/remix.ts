import path from "node:path";
import { walkFiles } from "../fsutil.js";
import type { RawRoute } from "../types.js";

const EXT = /\.(js|jsx|ts|tsx|md|mdx)$/;

function fromFile(rel: string): { path: string; dynamic: boolean } | null {
  const base = rel.replace(EXT, "");
  if (base.endsWith(".server") || base.endsWith(".test") || base.endsWith(".spec")) return null;
  const segments = base.split(".").flatMap((segment) => {
    if (segment === "_index" || segment === "index") return [];
    if (segment.startsWith("_")) return [];
    if (segment.startsWith("$")) return [`:${segment.slice(1)}`];
    return [segment];
  });
  return {
    path: segments.length === 0 ? "/" : `/${segments.join("/")}`,
    dynamic: segments.some((segment) => segment.startsWith(":")),
  };
}

export function discoverRemix(project: string): RawRoute[] {
  const roots = ["app/routes", "src/routes", "routes"];
  const routes: RawRoute[] = [];
  for (const relRoot of roots) {
    const root = path.join(project, relRoot);
    for (const abs of walkFiles(root, (file) => EXT.test(file))) {
      const rel = path.relative(root, abs).split(path.sep).join("/");
      const mapped = fromFile(rel);
      if (!mapped) continue;
      routes.push({ ...mapped, sourcePath: path.relative(project, abs) });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.sourcePath.localeCompare(b.sourcePath));
}
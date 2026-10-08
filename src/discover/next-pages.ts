import path from "node:path";
import { walkFiles } from "../fsutil.js";
import type { RawRoute } from "../types.js";

const PAGE_EXT = /\.(js|jsx|ts|tsx|mdx)$/;

export function discoverNextPages(project: string): RawRoute[] {
  const roots = ["pages", "src/pages"].map((rel) => path.join(project, rel));
  const routes: RawRoute[] = [];
  for (const root of roots) {
    const files = walkFiles(root, (abs) => PAGE_EXT.test(abs));
    for (const abs of files) {
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (rel === "api" || rel.startsWith("api/")) continue;
      const withoutExt = rel.replace(PAGE_EXT, "");
      const parts = withoutExt.split("/");
      if (parts.some((part) => part.startsWith("_"))) continue;
      const urlParts = parts.filter((part) => part !== "index");
      routes.push({
        path: urlParts.length === 0 ? "/" : `/${urlParts.join("/")}`,
        sourcePath: path.relative(project, abs),
        dynamic: urlParts.some((part) => part.includes("[")),
      });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}
import path from "node:path";
import { walkFiles } from "../fsutil.js";
import type { RawRoute } from "../types.js";

const EXT = /\.(astro|md|mdx)$/;

export function discoverAstro(project: string): RawRoute[] {
  const root = path.join(project, "src/pages");
  return walkFiles(root, (abs) => EXT.test(abs)).map((abs) => {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    const withoutExt = rel.replace(EXT, "");
    const parts = withoutExt.split("/").filter((part) => part !== "index");
    return {
      path: parts.length === 0 ? "/" : `/${parts.join("/")}`,
      sourcePath: path.relative(project, abs),
      dynamic: parts.some((part) => part.includes("[")),
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}
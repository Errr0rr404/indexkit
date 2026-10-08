import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".indexkit",
  "coverage",
  ".next",
  ".svelte-kit",
  ".nuxt",
  ".astro",
]);

export function walkFiles(root: string, accept: (abs: string) => boolean): string[] {
  const out: string[] = [];
  function visit(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(abs);
      else if (accept(abs)) out.push(abs);
    }
  }
  visit(root);
  return out.sort();
}

export function hashFile(abs: string): string {
  const hash = createHash("sha256");
  hash.update(fs.existsSync(abs) ? fs.readFileSync(abs) : abs);
  return hash.digest("hex");
}
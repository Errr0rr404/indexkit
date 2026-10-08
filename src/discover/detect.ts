import fs from "node:fs";
import path from "node:path";
import type { Framework, RawRoute } from "../types.js";
import { discoverAstro } from "./astro.js";
import { discoverExpress } from "./express.js";
import { discoverNextApp } from "./next-app.js";
import { discoverNextPages } from "./next-pages.js";
import { discoverNuxt } from "./nuxt.js";
import { discoverRemix } from "./remix.js";
import { discoverSvelteKit } from "./sveltekit.js";

function exists(project: string, rel: string): boolean {
  return fs.existsSync(path.join(project, rel));
}

export function detectFramework(project: string): Framework {
  if (discoverNextApp(project).length > 0) return "next-app";
  if (discoverSvelteKit(project).length > 0) return "sveltekit";
  if (["astro.config.mjs", "astro.config.ts", "astro.config.js"].some((rel) => exists(project, rel))) return "astro";
  if (["nuxt.config.ts", "nuxt.config.js", "nuxt.config.mjs"].some((rel) => exists(project, rel))) return "nuxt";
  if (discoverNextPages(project).length > 0) return "next-pages";
  if (discoverRemix(project).length > 0 && discoverSvelteKit(project).length === 0) return "remix";
  if (discoverExpress(project).length > 0) return "express";
  return "unknown";
}

export function discoverRaw(project: string): { framework: Framework; routes: RawRoute[] } {
  const framework = detectFramework(project);
  const routes =
    framework === "next-app" ? discoverNextApp(project) :
    framework === "sveltekit" ? discoverSvelteKit(project) :
    framework === "astro" ? discoverAstro(project) :
    framework === "nuxt" ? discoverNuxt(project) :
    framework === "next-pages" ? discoverNextPages(project) :
    framework === "remix" ? discoverRemix(project) :
    framework === "express" ? discoverExpress(project) :
    [];
  return { framework, routes };
}
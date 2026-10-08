import { describe, expect, it } from "vitest";
import { discoverAstro } from "../../src/discover/astro.js";
import { discoverNuxt } from "../../src/discover/nuxt.js";
import { discoverSvelteKit } from "../../src/discover/sveltekit.js";
import { makeProject } from "../helpers.js";

describe("sveltekit nuxt astro", () => {
  it("reads sveltekit +page files and skips server endpoints", () => {
    const project = makeProject({
      "src/routes/+page.svelte": "<h1>home</h1>",
      "src/routes/(app)/pricing/+page.svelte": "<h1>pricing</h1>",
      "src/routes/blog/[slug]/+page.server.ts": "export const load = () => ({})",
      "src/routes/health/+server.ts": "export function GET(){return new Response('ok')}",
    });
    expect(discoverSvelteKit(project).map((route) => route.path).sort()).toEqual([
      "/",
      "/blog/[slug]",
      "/pricing",
    ]);
  });

  it("reads nuxt vue pages", () => {
    const project = makeProject({
      "nuxt.config.ts": "export default {}",
      "pages/index.vue": "<template><p>home</p></template>",
      "pages/blog/[slug].vue": "<template><p>post</p></template>",
    });
    expect(discoverNuxt(project).map((route) => route.path).sort()).toEqual(["/", "/blog/[slug]"]);
  });

  it("reads astro pages and markdown", () => {
    const project = makeProject({
      "astro.config.mjs": "export default {}",
      "src/pages/index.astro": "<h1>home</h1>",
      "src/pages/docs/guide.md": "# guide",
    });
    expect(discoverAstro(project).map((route) => route.path).sort()).toEqual(["/", "/docs/guide"]);
  });
});
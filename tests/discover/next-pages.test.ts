import { describe, expect, it } from "vitest";
import { discoverNextPages } from "../../src/discover/next-pages.js";
import { makeProject } from "../helpers.js";

describe("next pages router", () => {
  it("maps files to paths and skips api and document shells", () => {
    const project = makeProject({
      "pages/index.tsx": "export default function Page(){return null}",
      "pages/blog/index.tsx": "export default function Page(){return null}",
      "pages/blog/[id].tsx": "export default function Page(){return null}",
      "pages/api/health.ts": "export default function handler(){return null}",
      "pages/_app.tsx": "export default function App({Component}){return null}",
    });
    expect(discoverNextPages(project).map((route) => route.path).sort()).toEqual([
      "/",
      "/blog",
      "/blog/[id]",
    ]);
  });
});
import { describe, expect, it } from "vitest";
import { discoverExpress } from "../../src/discover/express.js";
import { discoverRemix } from "../../src/discover/remix.js";
import { makeProject } from "../helpers.js";

describe("remix and express", () => {
  it("flattens remix routes and drops pathless segments", () => {
    const project = makeProject({
      "app/routes/_index.tsx": "export default function Page(){return null}",
      "app/routes/about.tsx": "export default function Page(){return null}",
      "app/routes/blog._index.tsx": "export default function Page(){return null}",
      "app/routes/blog.$slug.tsx": "export default function Page(){return null}",
      "app/routes/_auth.login.tsx": "export default function Page(){return null}",
    });
    expect(discoverRemix(project)).toEqual([
      { path: "/", sourcePath: "app/routes/_index.tsx", dynamic: false },
      { path: "/about", sourcePath: "app/routes/about.tsx", dynamic: false },
      { path: "/blog", sourcePath: "app/routes/blog._index.tsx", dynamic: false },
      { path: "/blog/:slug", sourcePath: "app/routes/blog.$slug.tsx", dynamic: true },
      { path: "/login", sourcePath: "app/routes/_auth.login.tsx", dynamic: false },
    ]);
  });

  it("keeps literal get paths and drops parameters", () => {
    const project = makeProject({
      "server.ts": `
        app.get("/pricing", () => {});
        router.get('/docs', () => {});
        app.get("/users/:id", () => {});
      `,
    });
    expect(discoverExpress(project).map((route) => route.path).sort()).toEqual(["/docs", "/pricing"]);
  });
});
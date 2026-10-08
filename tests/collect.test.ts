import { describe, expect, it } from "vitest";
import { collectRoutes } from "../src/collect.js";
import { makeProject } from "./helpers.js";

describe("collectRoutes", () => {
  it("prefers the app router and applies the private-path policy", async () => {
    const project = makeProject({
      "app/page.tsx": "export default function Page(){return null}",
      "app/admin/page.tsx": "export default function Page(){return null}",
      "pages/legacy.tsx": "export default function Page(){return null}",
    });
    const result = await collectRoutes({ project });
    expect(result.framework).toBe("next-app");
    expect(result.routes.map((route) => [route.path, route.indexable])).toEqual([
      ["/", true],
      ["/admin", false],
    ]);
  });

  it("asks the model only when the framework is unknown", async () => {
    const project = makeProject({ "README.md": "# hi" });
    let calls = 0;
    const result = await collectRoutes({
      project,
      model: {
        async discoverFromFiles() {
          calls += 1;
          return [{ path: "/pricing", sourcePath: "README.md", dynamic: false }];
        },
        async classify(routes) {
          return routes;
        },
      },
    });
    expect(calls).toBe(1);
    expect(result.framework).toBe("unknown");
    expect(result.routes[0]?.path).toBe("/pricing");
  });
});
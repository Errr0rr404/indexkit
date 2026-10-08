import { describe, expect, it } from "vitest";
import { discoverNextApp } from "../../src/discover/next-app.js";
import { makeProject } from "../helpers.js";

describe("next app router", () => {
  it("reads pages, route groups, and dynamic segments", () => {
    const project = makeProject({
      "app/page.tsx": "export default function Page(){return null}",
      "app/(marketing)/pricing/page.tsx": "export default function Page(){return null}",
      "app/blog/[slug]/page.tsx": "export default function Page(){return null}",
      "app/api/health/route.ts": "export function GET(){return new Response('ok')}",
      "app/_components/Button.tsx": "export function Button(){return null}",
      "app/@modal/login/page.tsx": "export default function Page(){return null}",
    });
    const paths = discoverNextApp(project).map((route) => route.path).sort();
    expect(paths).toEqual(["/", "/blog/[slug]", "/pricing"]);
    expect(discoverNextApp(project).find((route) => route.path === "/blog/[slug]")?.dynamic).toBe(true);
  });
});
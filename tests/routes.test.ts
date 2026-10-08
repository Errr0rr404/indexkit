import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashFile } from "../src/fsutil.js";
import { finalizeRoutes, toUrl } from "../src/routes.js";
import { makeProject } from "./helpers.js";

describe("route policy", () => {
  it("joins the origin and keeps a trailing slash only for the root", () => {
    expect(toUrl("https://example.com/", "/")).toBe("https://example.com/");
    expect(toUrl("https://example.com", "/pricing")).toBe("https://example.com/pricing");
  });

  it("marks private and unsamplable dynamic routes as not indexable", () => {
    // samples are keyed by parameter name and shared by every route, so the
    // unsampled case needs a parameter that has no sample list.
    const routes = finalizeRoutes([
      { path: "/", sourcePath: "app/page.tsx", dynamic: false },
      { path: "/admin", sourcePath: "app/admin/page.tsx", dynamic: false },
      { path: "/shop/[sku]", sourcePath: "app/shop/[sku]/page.tsx", dynamic: true },
      { path: "/docs/[slug]", sourcePath: "app/docs/[slug]/page.tsx", dynamic: true },
    ], { slug: ["start"] });

    expect(routes.find((route) => route.path === "/")?.indexable).toBe(true);
    expect(routes.find((route) => route.path === "/admin")?.indexable).toBe(false);
    expect(routes.find((route) => route.path === "/shop/[sku]")?.indexable).toBe(false);
    expect(routes.find((route) => route.path === "/docs/start")?.indexable).toBe(true);
    expect(routes.some((route) => route.path === "/docs/[slug]")).toBe(false);
  });

  it("hashes file bytes", () => {
    const project = makeProject({ "app/page.tsx": "export default function Page(){return null}" });
    const hash = hashFile(path.join(project, "app/page.tsx"));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { makeProject } from "./helpers.js";

describe("loadConfig", () => {
  it("merges the config file with CLI overrides and defaults the budget", () => {
    const project = makeProject({
      "indexkit.config.json": JSON.stringify({
        project: ".",
        origin: "https://example.com",
        siteUrl: "sc-domain:example.com",
        samples: { slug: ["start"] },
      }),
    });
    const config = loadConfig(project, { budget: 50 });
    expect(config.origin).toBe("https://example.com");
    expect(config.budget).toBe(50);
    expect(config.siteUrl).toBe("sc-domain:example.com");
    expect(fs.existsSync(path.join(project, "indexkit.config.json"))).toBe(true);
  });

  it("rejects an origin that is not an absolute http URL", () => {
    const project = makeProject({});
    expect(() => loadConfig(project, { project, origin: "example.com" })).toThrow(/absolute http/);
  });
});
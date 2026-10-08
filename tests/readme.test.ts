import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("readme", () => {
  it("states the supported Google path and the skip rule", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain("urlInspection.index.inspect");
    expect(readme).toContain("sitemaps.submit");
    expect(readme).toContain("Indexing API");
    expect(readme).toContain("MINIMAX_API_KEY");
    expect(readme).toContain("already indexed");
  });
});
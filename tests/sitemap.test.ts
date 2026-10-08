import { describe, expect, it } from "vitest";
import { buildSitemap } from "../src/sitemap.js";

describe("buildSitemap", () => {
  it("escapes locs and emits lastmod", () => {
    const xml = buildSitemap([
      { loc: "https://example.com/a&b", lastmod: "2026-10-08" },
      { loc: "https://example.com/" },
    ]);
    expect(xml).toContain("https://example.com/a&amp;b");
    expect(xml).toContain("<lastmod>2026-10-08</lastmod>");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});
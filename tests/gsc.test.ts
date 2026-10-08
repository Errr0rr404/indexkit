import { describe, expect, it } from "vitest";
import { inspectUrl, mapCoverage, QuotaExceededError, submitSitemap } from "../src/gsc.js";

describe("search console client", () => {
  it("maps indexed, crawled-not-indexed, and excluded coverage", () => {
    expect(mapCoverage("PASS", "Submitted and indexed")).toBe("indexed");
    expect(mapCoverage("NEUTRAL", "Crawled - currently not indexed")).toBe("crawled_not_indexed");
    expect(mapCoverage("FAIL", "Excluded by ‘noindex’ tag")).toBe("excluded");
  });

  it("posts the inspection request and stops on quota", async () => {
    const seen: string[] = [];
    const ok = await inspectUrl("token", "sc-domain:example.com", "https://example.com/", async (url) => {
      seen.push(String(url));
      return new Response(JSON.stringify({
        inspectionResult: {
          indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed", lastCrawlTime: "2026-10-01T00:00:00Z" },
        },
      }), { status: 200 });
    });
    expect(seen[0]).toBe("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
    expect(ok.verdict).toBe("indexed");
    await expect(inspectUrl("token", "sc-domain:example.com", "https://example.com/x", async () => new Response("", { status: 429 })))
      .rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("puts the sitemap to the webmasters endpoint", async () => {
    let method = "";
    let target = "";
    await submitSitemap("token", "sc-domain:example.com", "https://example.com/sitemap.xml", async (url, init) => {
      method = init?.method ?? "";
      target = String(url);
      // a 204 response must be constructed with a null body
      return new Response(null, { status: 204 });
    });
    expect(method).toBe("PUT");
    expect(target).toContain("/webmasters/v3/sites/");
    expect(target).toContain(encodeURIComponent("https://example.com/sitemap.xml"));
  });
});
import type { Verdict } from "./types.js";

export class QuotaExceededError extends Error {
  constructor() {
    super("Google URL Inspection daily quota exceeded");
    this.name = "QuotaExceededError";
  }
}

export interface Inspection {
  verdict: Verdict;
  coverageState: string | null;
  lastCrawlTime: string | null;
}

export function mapCoverage(verdict: string | undefined, coverageState: string | undefined): Verdict {
  const coverage = (coverageState ?? "").toLowerCase();
  if (coverage.includes("submitted and indexed")) return "indexed";
  if (coverage.includes("crawled") && coverage.includes("not indexed")) return "crawled_not_indexed";
  if (coverage.includes("discovered") || coverage.includes("unknown to google")) return "discovered";
  if (coverage.includes("excluded") || coverage.includes("noindex") || coverage.includes("blocked")) return "excluded";
  if ((verdict ?? "").toUpperCase() === "PASS" && coverage.includes("indexed")) return "indexed";
  return "unknown";
}

export async function inspectUrl(
  token: string,
  siteUrl: string,
  inspectionUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Inspection> {
  const response = await fetchImpl("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  if (response.status === 429) throw new QuotaExceededError();
  if (!response.ok) throw new Error(`URL Inspection failed: HTTP ${response.status}`);
  const body = await response.json() as {
    inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string } };
  };
  const status = body.inspectionResult?.indexStatusResult;
  return {
    verdict: mapCoverage(status?.verdict, status?.coverageState),
    coverageState: status?.coverageState ?? null,
    lastCrawlTime: status?.lastCrawlTime ?? null,
  };
}

export async function submitSitemap(
  token: string,
  siteUrl: string,
  feedUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const target = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedUrl)}`;
  const response = await fetchImpl(target, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Sitemap submit failed: HTTP ${response.status}`);
}
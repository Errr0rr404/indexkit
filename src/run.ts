import path from "node:path";
import { hashFile } from "./fsutil.js";
import { QuotaExceededError, type Inspection } from "./gsc.js";
import type { Ledger } from "./ledger.js";
import { toUrl } from "./routes.js";
import { buildSitemap } from "./sitemap.js";
import type { RouteRecord } from "./types.js";

export interface RunDeps {
  project: string;
  origin: string;
  budget: number;
  ledger: Ledger;
  now: () => Date;
  collect: () => Promise<{ framework: string; routes: RouteRecord[] }>;
  inspect?: (url: string) => Promise<Inspection>;
  writeSitemap?: (xml: string) => string;
  submitSitemap?: () => Promise<void>;
  submitIndexNow?: (urls: string[]) => Promise<void>;
}

export interface RunReport {
  framework: string;
  discovered: number;
  indexable: number;
  skippedIndexed: number;
  inspected: number;
  newlyIndexed: number;
  errors: number;
  sitemapWritten: string | null;
  sitemapSubmitted: boolean;
  indexnowSubmitted: number;
  stoppedReason: "budget" | "quota" | "done";
}

export async function runDaily(deps: RunDeps): Promise<RunReport> {
  const now = deps.now().toISOString();
  const collected = await deps.collect();
  for (const route of collected.routes) {
    deps.ledger.upsert({
      url: toUrl(deps.origin, route.path),
      path: route.path,
      sourcePath: route.sourcePath,
      sourceHash: hashFile(path.join(deps.project, route.sourcePath)),
      indexable: route.indexable,
    }, now);
  }
  const indexable = deps.ledger.indexableUrls();
  let sitemapWritten: string | null = null;
  let sitemapSubmitted = false;
  if (deps.writeSitemap) {
    const xml = buildSitemap(indexable.map((row) => ({ loc: row.url })));
    sitemapWritten = deps.writeSitemap(xml);
    deps.ledger.markSitemap(indexable.map((row) => row.url), now);
    if (deps.submitSitemap && sitemapWritten) {
      await deps.submitSitemap();
      sitemapSubmitted = true;
    }
  }
  const pending = deps.inspect ? deps.ledger.listPending(deps.budget, now) : [];
  let inspected = 0;
  let newlyIndexed = 0;
  let errors = 0;
  let stoppedReason: RunReport["stoppedReason"] = pending.length >= deps.budget ? "budget" : "done";
  if (deps.inspect) {
    for (const row of pending) {
      try {
        const result = await deps.inspect(row.url);
        deps.ledger.markInspection(row.url, result, deps.now().toISOString());
        inspected += 1;
        if (result.verdict === "indexed") newlyIndexed += 1;
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          stoppedReason = "quota";
          break;
        }
        errors += 1;
        deps.ledger.markInspection(row.url, { error: error instanceof Error ? error.message : "inspect failed" }, deps.now().toISOString());
      }
    }
  }
  let indexnowSubmitted = 0;
  if (deps.submitIndexNow) {
    const urls = deps.ledger.urlsNeedingIndexNow();
    for (let i = 0; i < urls.length; i += 10_000) {
      const chunk = urls.slice(i, i + 10_000);
      await deps.submitIndexNow(chunk);
      deps.ledger.markIndexNow(chunk, deps.now().toISOString());
      indexnowSubmitted += chunk.length;
    }
  }
  const counts = deps.ledger.counts();
  return {
    framework: collected.framework,
    discovered: collected.routes.length,
    indexable: indexable.length,
    skippedIndexed: counts.indexed,
    inspected,
    newlyIndexed,
    errors,
    sitemapWritten,
    sitemapSubmitted,
    indexnowSubmitted,
    stoppedReason,
  };
}
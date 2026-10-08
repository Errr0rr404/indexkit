import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { LedgerRow, Verdict } from "./types.js";

const VERDICTS: Verdict[] = [
  "unknown",
  "indexed",
  "discovered",
  "crawled_not_indexed",
  "excluded",
  "error",
  "stale",
];

export interface Ledger {
  upsert(input: { url: string; path: string; sourcePath: string; sourceHash: string; indexable: boolean }, now: string): "inserted" | "unchanged" | "stale";
  markInspection(url: string, result: { verdict: Verdict; coverageState: string | null; lastCrawlTime: string | null } | { error: string }, inspectedAt: string): void;
  listPending(budget: number, nowIso: string): LedgerRow[];
  counts(): Record<Verdict, number> & { private: number };
  indexableUrls(): { url: string; sourcePath: string }[];
  markSitemap(urls: string[], at: string): void;
  urlsNeedingIndexNow(): string[];
  markIndexNow(urls: string[], at: string): void;
  close(): void;
}

export function openLedger(dbPath: string): Ledger {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS urls (
      url TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      source_path TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      indexable INTEGER NOT NULL,
      verdict TEXT NOT NULL,
      coverage_state TEXT,
      last_crawl_time TEXT,
      last_inspected_at TEXT,
      last_sitemap_at TEXT,
      indexnow_at TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  return {
    upsert(input, now) {
      const existing = db.prepare("SELECT source_hash FROM urls WHERE url = ?").get(input.url) as { source_hash: string } | undefined;
      if (!existing) {
        db.prepare(`
          INSERT INTO urls (url, path, source_path, source_hash, indexable, verdict, updated_at)
          VALUES (?, ?, ?, ?, ?, 'unknown', ?)
        `).run(input.url, input.path, input.sourcePath, input.sourceHash, input.indexable ? 1 : 0, now);
        return "inserted";
      }
      if (existing.source_hash === input.sourceHash) {
        db.prepare("UPDATE urls SET path = ?, source_path = ?, indexable = ?, updated_at = ? WHERE url = ?")
          .run(input.path, input.sourcePath, input.indexable ? 1 : 0, now, input.url);
        return "unchanged";
      }
      db.prepare(`
        UPDATE urls
        SET path = ?, source_path = ?, source_hash = ?, indexable = ?, verdict = 'stale', last_error = NULL, updated_at = ?
        WHERE url = ?
      `).run(input.path, input.sourcePath, input.sourceHash, input.indexable ? 1 : 0, now, input.url);
      return "stale";
    },
    markInspection(url, result, inspectedAt) {
      if ("error" in result) {
        db.prepare("UPDATE urls SET verdict = 'error', last_error = ?, last_inspected_at = ?, updated_at = ? WHERE url = ?")
          .run(result.error, inspectedAt, inspectedAt, url);
        return;
      }
      db.prepare(`
        UPDATE urls
        SET verdict = ?, coverage_state = ?, last_crawl_time = ?, last_error = NULL, last_inspected_at = ?, updated_at = ?
        WHERE url = ?
      `).run(result.verdict, result.coverageState, result.lastCrawlTime, inspectedAt, inspectedAt, url);
    },
    listPending(budget, nowIso) {
      const retryBefore = new Date(Date.parse(nowIso) - 24 * 60 * 60 * 1000).toISOString();
      const rows = db.prepare(`
        SELECT * FROM urls
        WHERE indexable = 1
          AND (
            verdict IN ('unknown', 'stale', 'discovered', 'crawled_not_indexed')
            OR (verdict = 'error' AND (last_inspected_at IS NULL OR last_inspected_at <= ?))
          )
        ORDER BY last_inspected_at IS NOT NULL, last_inspected_at ASC, url ASC
        LIMIT ?
      `).all(retryBefore, budget) as Record<string, unknown>[];
      return rows.map(mapRow);
    },
    counts() {
      const counts = Object.fromEntries(VERDICTS.map((verdict) => [verdict, 0])) as Record<Verdict, number> & { private: number };
      counts.private = 0;
      const rows = db.prepare("SELECT verdict, indexable, COUNT(*) AS n FROM urls GROUP BY verdict, indexable").all() as { verdict: Verdict; indexable: number; n: number }[];
      for (const row of rows) {
        if (row.indexable === 0) counts.private += row.n;
        else counts[row.verdict] += row.n;
      }
      return counts;
    },
    indexableUrls() {
      return db.prepare("SELECT url, source_path AS sourcePath FROM urls WHERE indexable = 1 ORDER BY url ASC").all() as { url: string; sourcePath: string }[];
    },
    markSitemap(urls, at) {
      const stmt = db.prepare("UPDATE urls SET last_sitemap_at = ?, updated_at = ? WHERE url = ?");
      for (const url of urls) stmt.run(at, at, url);
    },
    urlsNeedingIndexNow() {
      const rows = db.prepare("SELECT url FROM urls WHERE indexable = 1 AND indexnow_at IS NULL ORDER BY url ASC").all() as { url: string }[];
      return rows.map((row) => row.url);
    },
    markIndexNow(urls, at) {
      const stmt = db.prepare("UPDATE urls SET indexnow_at = ?, updated_at = ? WHERE url = ?");
      for (const url of urls) stmt.run(at, at, url);
    },
    close() {
      db.close();
    },
  };
}

function mapRow(row: Record<string, unknown>): LedgerRow {
  return {
    url: String(row.url),
    path: String(row.path),
    sourcePath: String(row.source_path),
    sourceHash: String(row.source_hash),
    indexable: row.indexable === 1,
    verdict: String(row.verdict) as Verdict,
    coverageState: (row.coverage_state as string | null) ?? null,
    lastCrawlTime: (row.last_crawl_time as string | null) ?? null,
    lastInspectedAt: (row.last_inspected_at as string | null) ?? null,
    lastSitemapAt: (row.last_sitemap_at as string | null) ?? null,
    indexnowAt: (row.indexnow_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    updatedAt: String(row.updated_at),
  };
}
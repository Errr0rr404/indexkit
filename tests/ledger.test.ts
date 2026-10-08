import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openLedger } from "../src/ledger.js";

describe("ledger", () => {
  it("skips an indexed url until its source hash changes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexkit-db-"));
    const ledger = openLedger(path.join(dir, "ledger.db"));
    const now = "2026-10-08T00:00:00.000Z";
    expect(ledger.upsert({
      url: "https://example.com/pricing",
      path: "/pricing",
      sourcePath: "app/pricing/page.tsx",
      sourceHash: "aaa",
      indexable: true,
    }, now)).toBe("inserted");
    ledger.markInspection("https://example.com/pricing", {
      verdict: "indexed",
      coverageState: "Submitted and indexed",
      lastCrawlTime: now,
    }, now);
    expect(ledger.listPending(10, now)).toEqual([]);

    expect(ledger.upsert({
      url: "https://example.com/pricing",
      path: "/pricing",
      sourcePath: "app/pricing/page.tsx",
      sourceHash: "bbb",
      indexable: true,
    }, now)).toBe("stale");
    expect(ledger.listPending(10, now).map((row) => row.url)).toEqual(["https://example.com/pricing"]);
    ledger.close();
  });

  it("waits 24 hours before retrying an error", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexkit-db-"));
    const ledger = openLedger(path.join(dir, "ledger.db"));
    ledger.upsert({
      url: "https://example.com/",
      path: "/",
      sourcePath: "app/page.tsx",
      sourceHash: "aaa",
      indexable: true,
    }, "2026-10-08T00:00:00.000Z");
    ledger.markInspection("https://example.com/", { error: "HTTP 500" }, "2026-10-08T00:00:00.000Z");
    expect(ledger.listPending(10, "2026-10-08T12:00:00.000Z")).toEqual([]);
    expect(ledger.listPending(10, "2026-10-09T00:00:00.000Z")).toHaveLength(1);
    ledger.close();
  });
});
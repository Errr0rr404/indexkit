import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openLedger } from "../src/ledger.js";
import { runDaily } from "../src/run.js";
import type { RouteRecord } from "../src/types.js";

const route: RouteRecord = {
  path: "/pricing",
  sourcePath: "app/pricing/page.tsx",
  dynamic: false,
  indexable: true,
  reason: "static route",
};

describe("runDaily", () => {
  it("does not inspect a url again after Google reports it indexed", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexkit-run-"));
    const project = path.join(dir, "app");
    fs.mkdirSync(project, { recursive: true });
    const source = path.join(project, "pricing");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "page.tsx"), "export default function Page(){return null}");
    const ledger = openLedger(path.join(dir, ".indexkit/ledger.db"));
    let inspections = 0;
    const deps = {
      project: dir,
      origin: "https://example.com",
      budget: 200,
      ledger,
      now: () => new Date("2026-10-08T00:00:00.000Z"),
      collect: async () => ({ framework: "next-app", routes: [route] }),
      inspect: async () => {
        inspections += 1;
        return { verdict: "indexed" as const, coverageState: "Submitted and indexed", lastCrawlTime: "2026-10-08T00:00:00Z" };
      },
    };
    const first = await runDaily(deps);
    const second = await runDaily({
      ...deps,
      inspect: async () => {
        throw new Error("inspected twice");
      },
    });
    expect(first.inspected).toBe(1);
    expect(first.newlyIndexed).toBe(1);
    expect(second.inspected).toBe(0);
    expect(second.skippedIndexed).toBe(1);
    expect(inspections).toBe(1);
    ledger.close();
  });
});
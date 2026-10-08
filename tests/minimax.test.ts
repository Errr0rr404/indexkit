import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { acceptModelRoutes, createMiniMaxModel, extractJsonArray } from "../src/minimax.js";

describe("minimax", () => {
  it("extracts a fenced array and drops invented files", () => {
    const parsed = extractJsonArray('```json\n[{"path":"/pricing","sourcePath":"app/page.tsx","dynamic":false}]\n```');
    expect(acceptModelRoutes(parsed, new Set(["app/page.tsx"]))).toEqual([
      { path: "/pricing", sourcePath: "app/page.tsx", dynamic: false },
    ]);
    expect(acceptModelRoutes(parsed, new Set(["other.ts"]))).toEqual([]);
  });

  it("uses the cache on the second discovery call", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexkit-mm-"));
    let calls = 0;
    const model = createMiniMaxModel({
      apiKey: "test-key",
      cachePath: path.join(dir, "cache.json"),
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({
          choices: [{ message: { content: '[{"path":"/pricing","sourcePath":"README.md","dynamic":false}]' } }],
        }), { status: 200 });
      },
    });
    const input = { project: dir, files: [{ path: "README.md", text: "# hi" }] };
    await model.discoverFromFiles(input);
    await model.discoverFromFiles(input);
    expect(calls).toBe(1);
  });

  it("classify cannot turn a private route into an indexable one", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexkit-mm-"));
    const model = createMiniMaxModel({
      apiKey: "test-key",
      cachePath: path.join(dir, "classify-cache.json"),
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: '[{"path":"/admin","indexable":true,"reason":"model says yes"}]' } }],
      }), { status: 200 }),
    });
    const classified = await model.classify([
      { path: "/admin", sourcePath: "app/admin/page.tsx", dynamic: false, indexable: false, reason: "private path" },
    ]);
    expect(classified[0]?.indexable).toBe(false);
  });
});
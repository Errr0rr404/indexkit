import path from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "../src/cli.js";
import { makeProject } from "./helpers.js";

describe("cli", () => {
  it("prints indexable urls for discover", async () => {
    const project = makeProject({
      "app/page.tsx": "export default function Page(){return null}",
      "app/admin/page.tsx": "export default function Page(){return null}",
    });
    const out: string[] = [];
    const code = await main(["discover", "--project", project, "--origin", "https://example.com"], {
      cwd: project,
      stdout: (line) => out.push(line),
      stderr: () => undefined,
      env: {},
    });
    expect(code).toBe(0);
    expect(out).toEqual(["https://example.com/"]);
  });

  it("reports an empty ledger", async () => {
    const project = makeProject({ "app/page.tsx": "export default function Page(){return null}" });
    const out: string[] = [];
    const code = await main(["status", "--project", project, "--origin", "https://example.com"], {
      cwd: project,
      stdout: (line) => out.push(line),
      stderr: () => undefined,
      env: {},
    });
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("no ledger");
    expect(path.basename(project)).toBeTruthy();
  });
});
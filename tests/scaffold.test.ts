import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package surface", () => {
  it("names the cli indexkit and stays on current Node", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      name: string;
      type: string;
      engines: { node: string };
      bin: { indexkit: string };
    };
    expect(pkg.name).toBe("indexkit");
    expect(pkg.type).toBe("module");
    expect(pkg.engines.node).toBe(">=22.5");
    expect(pkg.bin.indexkit).toBe("./dist/cli.js");
  });
});
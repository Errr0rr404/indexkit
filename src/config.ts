import fs from "node:fs";
import path from "node:path";
import type { IndexkitConfig } from "./types.js";

export function loadConfig(
  cwd: string,
  overrides: Partial<IndexkitConfig> & { configPath?: string } = {},
): IndexkitConfig {
  const configPath = overrides.configPath ?? path.join(cwd, "indexkit.config.json");
  const fromFile = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<IndexkitConfig>
    : {};
  const merged: IndexkitConfig = {
    ...fromFile,
    ...stripEmpty(overrides),
    project: path.resolve(cwd, overrides.project ?? fromFile.project ?? "."),
    origin: overrides.origin ?? fromFile.origin ?? "",
    budget: overrides.budget ?? fromFile.budget ?? 200,
  };
  if (!merged.origin || !/^https?:\/\//.test(merged.origin)) {
    throw new Error("origin must be an absolute http(s) URL");
  }
  if (!fs.existsSync(merged.project)) {
    throw new Error(`project does not exist: ${merged.project}`);
  }
  if (!Number.isInteger(merged.budget) || (merged.budget ?? 0) < 1 || (merged.budget ?? 0) > 2000) {
    throw new Error("budget must be an integer from 1 to 2000");
  }
  return merged;
}

function stripEmpty(overrides: Partial<IndexkitConfig> & { configPath?: string }): Partial<IndexkitConfig> {
  const copy: Partial<IndexkitConfig> = { ...overrides };
  delete (copy as { configPath?: string }).configPath;
  for (const key of Object.keys(copy) as (keyof IndexkitConfig)[]) {
    if (copy[key] === undefined) delete copy[key];
  }
  return copy;
}
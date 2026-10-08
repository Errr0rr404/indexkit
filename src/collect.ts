import type { Framework, RawRoute, RouteRecord } from "./types.js";
import { discoverRaw } from "./discover/detect.js";
import { finalizeRoutes } from "./routes.js";

export interface RouteModel {
  discoverFromFiles(input: { project: string; files: { path: string; text: string }[] }): Promise<RawRoute[]>;
  classify(routes: RouteRecord[]): Promise<RouteRecord[]>;
}

export async function collectRoutes(opts: {
  project: string;
  samples?: Record<string, string[]>;
  model?: RouteModel | null;
  filesForModel?: { path: string; text: string }[];
}): Promise<{ framework: Framework; routes: RouteRecord[] }> {
  const found = discoverRaw(opts.project);
  let raw = found.routes;
  if (raw.length === 0 && opts.model) {
    raw = await opts.model.discoverFromFiles({
      project: opts.project,
      files: opts.filesForModel ?? [],
    });
  }
  let routes = finalizeRoutes(raw, opts.samples);
  if (opts.model && routes.length > 0) {
    const classified = await opts.model.classify(routes);
    const allowed = new Set(routes.map((route) => route.path));
    routes = classified.filter((route) => allowed.has(route.path));
  }
  return { framework: found.framework, routes };
}
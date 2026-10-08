import type { RawRoute, RouteRecord } from "./types.js";

const PRIVATE = /^\/(api|admin|auth|login|logout|signup|sign-in|sign-up|account|settings|dashboard|internal|health|_next)(\/|$)/i;
const PARAM = /\[\[\.\.\.([^\]]+)\]\]|\[\.\.\.([^\]]+)\]|\[([^\]]+)\]|:([A-Za-z_][A-Za-z0-9_]*)/g;

export function toUrl(origin: string, routePath: string): string {
  const base = origin.replace(/\/+$/, "");
  if (routePath === "/" || routePath === "") return `${base}/`;
  return `${base}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;
}

function paramNames(routePath: string): string[] {
  const names: string[] = [];
  for (const match of routePath.matchAll(PARAM)) {
    const name = match[1] || match[2] || match[3] || match[4];
    if (name) names.push(name);
  }
  return names;
}

function withPolicy(route: RouteRecord): RouteRecord {
  if (!route.indexable) return route;
  if (PRIVATE.test(route.path)) {
    return { ...route, indexable: false, reason: "private path" };
  }
  return route;
}

export function finalizeRoutes(raw: RawRoute[], samples: Record<string, string[]> = {}): RouteRecord[] {
  const finished: RouteRecord[] = [];
  for (const route of raw) {
    const names = paramNames(route.path);
    if (names.length === 0) {
      finished.push(withPolicy({
        ...route,
        dynamic: false,
        indexable: true,
        reason: "static route",
      }));
      continue;
    }
    const missing = names.filter((name) => !samples[name] || samples[name].length === 0);
    if (missing.length > 0) {
      finished.push({
        ...route,
        dynamic: true,
        indexable: false,
        reason: `dynamic segment needs samples: ${missing.join(", ")}`,
      });
      continue;
    }
    let paths = [route.path];
    let tooMany = false;
    for (const name of names) {
      const next: string[] = [];
      for (const current of paths) {
        for (const value of samples[name] ?? []) {
          const pattern = new RegExp(
            `\\[\\[\\.\\.\\.${name}\\]\\]|\\[\\.\\.\\.${name}\\]|\\[${name}\\]|:${name}(?![A-Za-z0-9_])`,
          );
          next.push(current.replace(pattern, encodeURIComponent(value)));
        }
      }
      paths = next;
      if (paths.length > 100) {
        tooMany = true;
        break;
      }
    }
    if (tooMany) {
      finished.push({
        ...route,
        dynamic: true,
        indexable: false,
        reason: "sample expansion exceeds 100 urls",
      });
      continue;
    }
    for (const path of paths) {
      finished.push(withPolicy({
        ...route,
        path,
        dynamic: false,
        indexable: true,
        reason: "sample expansion",
      }));
    }
  }
  const seen = new Set<string>();
  return finished.filter((route) => {
    const key = `${route.path}\0${route.sourcePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
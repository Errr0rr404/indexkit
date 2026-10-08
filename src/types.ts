export type Framework =
  | "next-app"
  | "next-pages"
  | "sveltekit"
  | "nuxt"
  | "astro"
  | "remix"
  | "express"
  | "unknown";

export type Verdict =
  | "unknown"
  | "indexed"
  | "discovered"
  | "crawled_not_indexed"
  | "excluded"
  | "error"
  | "stale";

export interface RawRoute {
  path: string;
  sourcePath: string;
  dynamic: boolean;
}

export interface RouteRecord {
  path: string;
  sourcePath: string;
  dynamic: boolean;
  indexable: boolean;
  reason: string;
}

export interface IndexkitConfig {
  project: string;
  origin: string;
  siteUrl?: string;
  samples?: Record<string, string[]>;
  budget?: number;
  sitemapOut?: string;
  sitemapPublicUrl?: string;
  googleCredentials?: string;
  indexnow?: {
    key: string;
    host?: string;
    keyLocation?: string;
  };
  minimax?:
    | false
    | {
        discover?: boolean;
        classify?: boolean;
        model?: string;
        baseUrl?: string;
      };
}

export interface LedgerRow {
  url: string;
  path: string;
  sourcePath: string;
  sourceHash: string;
  indexable: boolean;
  verdict: Verdict;
  coverageState: string | null;
  lastCrawlTime: string | null;
  lastInspectedAt: string | null;
  lastSitemapAt: string | null;
  indexnowAt: string | null;
  lastError: string | null;
  updatedAt: string;
}
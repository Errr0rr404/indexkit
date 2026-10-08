#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { collectRoutes } from "./collect.js";
import { loadConfig } from "./config.js";
import { inspectUrl, submitSitemap } from "./gsc.js";
import { getAccessToken } from "./google-auth.js";
import { submitIndexNow } from "./indexnow.js";
import { openLedger } from "./ledger.js";
import { createMiniMaxModel } from "./minimax.js";
import { runDaily } from "./run.js";
import { toUrl } from "./routes.js";

interface Io {
  cwd: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  env: NodeJS.ProcessEnv;
}

export async function main(argv: string[], io: Io = {
  cwd: process.cwd(),
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
  env: process.env,
}): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      project: { type: "string" },
      origin: { type: "string" },
      config: { type: "string" },
      budget: { type: "string" },
      submit: { type: "boolean" },
    },
    allowPositionals: true,
    strict: true,
  });
  const command = positionals[0];
  if (!command || !["discover", "status", "sitemap", "run"].includes(command)) {
    io.stderr("usage: indexkit <discover|status|sitemap|run> --origin https://example.com [--project dir]");
    return 1;
  }
  try {
    const config = loadConfig(io.cwd, {
      project: values.project,
      origin: values.origin,
      configPath: values.config,
      budget: values.budget ? Number(values.budget) : undefined,
    });
    const ledgerPath = path.join(config.project, ".indexkit/ledger.db");
    if (command === "status" && !fs.existsSync(ledgerPath)) {
      io.stdout("no ledger");
      return 0;
    }
    const model = buildModel(config.project, config.minimax, io.env);
    if (command === "discover") {
      const result = await collectRoutes({ project: config.project, samples: config.samples, model });
      for (const route of result.routes.filter((item) => item.indexable)) {
        io.stdout(toUrl(config.origin, route.path));
      }
      io.stderr(`${result.framework} indexable ${result.routes.filter((item) => item.indexable).length}`);
      return 0;
    }
    const ledger = openLedger(ledgerPath);
    try {
      if (command === "status") {
        const counts = ledger.counts();
        for (const [key, value] of Object.entries(counts)) io.stdout(`${key} ${value}`);
        return 0;
      }
      const report = await runDaily({
        project: config.project,
        origin: config.origin,
        budget: config.budget ?? 200,
        ledger,
        now: () => new Date(),
        collect: () => collectRoutes({ project: config.project, samples: config.samples, model }),
        inspect: command === "run" && config.siteUrl && credentialPath(config, io.env)
          ? async (url) => inspectUrl(await token(config, io.env), config.siteUrl as string, url)
          : undefined,
        writeSitemap: (xml) => {
          const out = path.resolve(config.project, config.sitemapOut ?? ".indexkit/sitemap.xml");
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, xml);
          return out;
        },
        submitSitemap: values.submit && config.sitemapPublicUrl && config.siteUrl
          ? async () => {
              await submitSitemap(await token(config, io.env), config.siteUrl as string, config.sitemapPublicUrl as string);
            }
          : undefined,
        submitIndexNow: config.indexnow?.key
          ? async (urls) => {
              const host = config.indexnow?.host ?? new URL(config.origin).host;
              const key = config.indexnow?.key ?? "";
              await submitIndexNow({
                host,
                key,
                keyLocation: config.indexnow?.keyLocation ?? `${config.origin.replace(/\/$/, "")}/${key}.txt`,
                urls,
              });
            }
          : undefined,
      });
      io.stdout(JSON.stringify(report));
      return 0;
    } finally {
      ledger.close();
    }
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : "indexkit failed");
    return 1;
  }
}

function buildModel(project: string, setting: { discover?: boolean; classify?: boolean; model?: string; baseUrl?: string } | false | undefined, env: NodeJS.ProcessEnv) {
  const apiKey = env.MINIMAX_API_KEY;
  if (!apiKey || setting === false) return null;
  return createMiniMaxModel({
    apiKey,
    model: setting?.model,
    baseUrl: setting?.baseUrl,
    cachePath: path.join(project, ".indexkit/minimax-cache.json"),
  });
}

function credentialPath(config: { project: string; googleCredentials?: string }, env: NodeJS.ProcessEnv): string | undefined {
  return config.googleCredentials ?? env.GOOGLE_APPLICATION_CREDENTIALS;
}

async function token(config: { project: string; googleCredentials?: string }, env: NodeJS.ProcessEnv): Promise<string> {
  const credentialsPath = credentialPath(config, env);
  if (!credentialsPath) throw new Error("Set googleCredentials or GOOGLE_APPLICATION_CREDENTIALS");
  return getAccessToken({
    credentialsPath,
    tokenCachePath: path.join(config.project, ".indexkit/google-token.json"),
  });
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
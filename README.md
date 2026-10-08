# indexkit

`indexkit` reads a local web app, finds its pages, writes a sitemap, and remembers which URLs Google has already indexed.

A daily run skips a URL when the ledger verdict is indexed and the source file hash is unchanged.

## What Google accepts

Google gives ordinary sites two relevant APIs:

- Sitemap submission through `sitemaps.submit` on the Search Console API. This hands Google the URL list. Submit the sitemap once per change.
- Status checks through `urlInspection.index.inspect`. This returns the indexed verdict, coverage state, and last crawl. The quota is about 2,000 inspections per day and 600 per minute per property. The default budget in this tool is 200.

The URL Inspection API has no method that requests indexing. The Indexing API is for pages with `JobPosting` or `BroadcastEvent` inside a `VideoObject`. `indexkit` does not call it. IndexNow is optional and notifies Bing and the other IndexNow engines. It does not notify Google.

A successful inspection or sitemap submit does not guarantee that a page will appear in Google Search.

## Setup

1. Create a Google Cloud project and enable the Google Search Console API.
2. Create a service account, or an OAuth desktop client.
3. For a service account, add its email as an owner of the Search Console property.
4. Save the credential JSON outside git. Point `googleCredentials` or `GOOGLE_APPLICATION_CREDENTIALS` at it.
5. Copy `indexkit.config.example.json` to `indexkit.config.json`.
6. Set `origin` to the public site and `siteUrl` to the property string exactly as Search Console shows it (`sc-domain:example.com` or `https://example.com/`).
7. Put dynamic sample values in `samples`. A route such as `/blog/[slug]` stays out of the sitemap until `slug` has values.
8. Host the IndexNow key file at the URL in `keyLocation` before enabling `indexnow`.

MiniMax is optional. Export `MINIMAX_API_KEY` when the framework is not recognized or when you want a public-versus-private label. The key stays in the environment. Set `"minimax": false` to disable it.

## Commands

```bash
npx indexkit discover --project ./app --origin https://example.com
npx indexkit sitemap --submit
npx indexkit run --budget 200
npx indexkit status
```

`discover` prints indexable URLs. `sitemap` writes `sitemapOut` (default `.indexkit/sitemap.xml`) and, with `--submit`, submits `sitemapPublicUrl`. `run` discovers, updates the ledger, writes the sitemap, inspects pending URLs, and sends new URLs to IndexNow when that block is configured. `status` prints ledger counts.

The ledger is `.indexkit/ledger.db` inside the project. It is gitignored.

## Daily use

Run `indexkit run` once a day from cron or from GitHub Actions. The command spends the budget on unknown, stale, discovered, and crawled-not-indexed URLs. Error rows wait 24 hours. Indexed rows wait until the source file changes.

## Development

```bash
npm install
npm test
npm run build
```

Node.js 22.5 or newer is required.
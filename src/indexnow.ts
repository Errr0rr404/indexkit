export async function submitIndexNow(opts: {
  host: string;
  key: string;
  keyLocation: string;
  urls: string[];
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const response = await (opts.fetchImpl ?? fetch)("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: opts.host,
      key: opts.key,
      keyLocation: opts.keyLocation,
      urlList: opts.urls,
    }),
  });
  if (!response.ok) throw new Error(`IndexNow failed: HTTP ${response.status}`);
}
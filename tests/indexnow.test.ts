import { describe, expect, it } from "vitest";
import { submitIndexNow } from "../src/indexnow.js";

describe("indexnow", () => {
  it("posts the url list once", async () => {
    let body = "";
    await submitIndexNow({
      host: "example.com",
      key: "abc123",
      keyLocation: "https://example.com/abc123.txt",
      urls: ["https://example.com/pricing"],
      fetchImpl: async (url, init) => {
        expect(String(url)).toBe("https://api.indexnow.org/indexnow");
        body = String(init?.body);
        return new Response("", { status: 200 });
      },
    });
    expect(JSON.parse(body)).toMatchObject({
      host: "example.com",
      key: "abc123",
      urlList: ["https://example.com/pricing"],
    });
  });
});
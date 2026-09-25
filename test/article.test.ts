import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chooseSource, extractArticleText, fetchArticleText, MIN_ARTICLE_CHARS } from "../src/article";
import { fakeFetch } from "./helpers";

const articleHtml = readFileSync(new URL("./fixtures/article.html", import.meta.url), "utf8");
const html = (body: string) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });

describe("extractArticleText", () => {
  it("実記事の HTML から本文を抜ける", () => {
    const text = extractArticleText(articleHtml, "https://example.com/");
    expect(text?.length).toBeGreaterThanOrEqual(MIN_ARTICLE_CHARS);
  });

  it("短すぎる本文は null", () => {
    expect(extractArticleText("<html><body><p>short</p></body></html>", "https://e.test/")).toBeNull();
  });
});

describe("fetchArticleText", () => {
  it("HTML なら本文を返す", async () => {
    const f = fakeFetch({ "https://e.test": () => html(articleHtml) });
    expect(await fetchArticleText(f, "https://e.test/a", 1000)).not.toBeNull();
  });

  it("HTML 以外は null", async () => {
    const f = fakeFetch({
      "https://e.test": () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }),
    });
    expect(await fetchArticleText(f, "https://e.test/a.pdf", 1000)).toBeNull();
  });

  it("4xx は null", async () => {
    expect(await fetchArticleText(fakeFetch({}), "https://e.test/a", 1000)).toBeNull();
  });

  it("例外（タイムアウトなど）は null", async () => {
    const f = fakeFetch({
      "https://e.test": () => {
        throw new DOMException("timeout", "TimeoutError");
      },
    });
    expect(await fetchArticleText(f, "https://e.test/a", 1000)).toBeNull();
  });
});

describe("chooseSource", () => {
  it("本文があれば full（maxChars で切る）", () => {
    expect(chooseSource("abcdef", "<p>hn", 3)).toEqual({ status: "full", text: "abc" });
  });

  it("本文がなく HN のテキストがあれば hn_text", () => {
    expect(chooseSource(null, "a<p>b", 100)).toEqual({ status: "hn_text", text: "a\n\nb" });
  });

  it("どちらもなければ unavailable", () => {
    expect(chooseSource(null, null, 100)).toEqual({ status: "unavailable", text: null });
  });
});

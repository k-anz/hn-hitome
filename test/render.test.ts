import { describe, expect, it } from "vitest";
import { buildDigest, type GeneratedItem } from "../src/digest";
import { escapeHtml, renderDayHtml, renderIndexHtml, renderJson } from "../src/render";

const item: GeneratedItem = {
  candidate: { hnId: 42, title: "Orig <b>", url: "https://a.test/x?a=1&b=2", points: 10, commentCount: 3 },
  summary: { titleJa: "<script>alert(1)</script>", summaryJa: "要約 & more", discussionPointsJa: ["論点A", "論点B"] },
  sourceStatus: "full",
};
const digest = buildDigest({ now: new Date("2026-09-25T10:00:00Z"), baseUrl: "https://u.github.io/hn", items: [item] });

describe("escapeHtml", () => {
  it("5 文字をエスケープ", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("renderJson", () => {
  it("整形済み JSON で末尾改行", () => {
    const s = renderJson(digest);
    expect(JSON.parse(s)).toEqual(digest);
    expect(s.endsWith("}\n")).toBe(true);
  });
});

describe("renderDayHtml", () => {
  const html = renderDayHtml(digest);

  it("LLM の出力をエスケープする", () => {
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("記事ごとのアンカー、論点、リンク、おしまい", () => {
    expect(html).toContain(`id="42"`);
    expect(html).toContain("<li>論点A</li>");
    expect(html).toContain(`href="https://a.test/x?a=1&amp;b=2"`);
    expect(html).toContain(`href="https://news.ycombinator.com/item?id=42"`);
    expect(html).toContain("今日はおしまい");
    expect(html).toContain(`href="../../index.html"`);
    expect(html).not.toContain("本文を取得できなかった");
  });

  it("unavailable には注記を出し、元記事リンクがなければ出さない", () => {
    const d = buildDigest({
      now: new Date("2026-09-25T10:00:00Z"),
      baseUrl: "https://u.github.io/hn",
      items: [{ ...item, candidate: { ...item.candidate, url: null }, sourceStatus: "unavailable" }],
    });
    const h = renderDayHtml(d);
    expect(h).toContain("本文を取得できなかったため");
    expect(h).not.toContain("元記事");
  });
});

describe("renderIndexHtml", () => {
  it("日付ごとに相対リンクと日本語タイトルを並べる", () => {
    const html = renderIndexHtml([digest]);
    expect(html).toContain(`href="2026/09/25.html"`);
    expect(html).toContain("&lt;script&gt;");
  });
});

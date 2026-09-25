import { describe, expect, it } from "vitest";
import algoliaSearch from "./fixtures/algolia-search.json";
import algoliaItem from "./fixtures/algolia-item.json";
import hnItem from "./fixtures/hn-item.json";
import { fetchCandidates, fetchJson, fetchStoryDetail } from "../src/hn";
import { fakeFetch } from "./helpers";

const noWait = { retries: 3, baseDelayMs: 0 };

describe("fetchJson", () => {
  it("5xx はリトライして成功を返す", async () => {
    let n = 0;
    const f = fakeFetch({
      "https://x.test": () => (++n < 3 ? new Response("", { status: 503 }) : Response.json({ ok: true })),
    });
    expect(await fetchJson(f, "https://x.test/a", noWait)).toEqual({ ok: true });
    expect(f.calls).toHaveLength(3);
  });

  it("リトライ上限で失敗する", async () => {
    const f = fakeFetch({ "https://x.test": () => new Response("", { status: 500 }) });
    await expect(fetchJson(f, "https://x.test/a", noWait)).rejects.toThrow("500");
    expect(f.calls).toHaveLength(4);
  });

  it("404 はリトライしない", async () => {
    const f = fakeFetch({});
    await expect(fetchJson(f, "https://x.test/a", noWait)).rejects.toThrow("404");
    expect(f.calls).toHaveLength(1);
  });
});

describe("fetchCandidates", () => {
  const now = new Date("2026-09-25T10:00:00Z");

  it("24 時間前以降を条件にして、ポイント降順で limit 件返す", async () => {
    const hits = [
      { objectID: "1", title: "low", url: "https://a.test", points: 10, num_comments: 1 },
      { objectID: "2", title: "high", url: null, points: 300, num_comments: 5 },
      { objectID: "3", title: "mid", url: "", points: 50, num_comments: null },
    ];
    const f = fakeFetch({ "https://hn.algolia.com/api/v1/search": { hits } });
    const got = await fetchCandidates(f, now, 2, noWait);
    expect(got).toEqual([
      { hnId: 2, title: "high", url: null, points: 300, commentCount: 5 },
      { hnId: 3, title: "mid", url: null, points: 50, commentCount: 0 },
    ]);
    const since = Math.floor(now.getTime() / 1000) - 86400;
    expect(decodeURIComponent(f.calls[0]!)).toContain(`created_at_i>${since}`);
    expect(f.calls[0]).toContain("hitsPerPage=50");
  });

  it("実レスポンスの fixture を読める", async () => {
    const f = fakeFetch({ "https://hn.algolia.com/api/v1/search": algoliaSearch });
    const got = await fetchCandidates(f, now, 10, noWait);
    expect(got.length).toBe(algoliaSearch.hits.length);
    expect(got[0]!.points).toBeGreaterThanOrEqual(got.at(-1)!.points);
  });
});

describe("fetchStoryDetail", () => {
  const id = hnItem.id;
  const routes = {
    [`https://hacker-news.firebaseio.com/v0/item/${id}.json`]: hnItem,
    [`https://hn.algolia.com/api/v1/items/${id}`]: algoliaItem,
  };

  it("トップレベルを公式 API の kids の順に並べる", async () => {
    const detail = await fetchStoryDetail(fakeFetch(routes), id, noWait);
    const textById = new Map(algoliaItem.children.map((c) => [c.id, c.text]));
    expect(detail.comments.map((c) => c.text)).toEqual(hnItem.kids.map((k) => textById.get(k)));
  });

  it("kids にないトップレベル（dead など）は除く", async () => {
    const kids = hnItem.kids.slice(1);
    const detail = await fetchStoryDetail(
      fakeFetch({ ...routes, [`https://hacker-news.firebaseio.com/v0/item/${id}.json`]: { ...hnItem, kids } }),
      id,
      noWait,
    );
    expect(detail.comments).toHaveLength(kids.length);
  });

  it("本文テキスト（Ask HN など）を返す", async () => {
    const detail = await fetchStoryDetail(
      fakeFetch({ ...routes, [`https://hacker-news.firebaseio.com/v0/item/${id}.json`]: { ...hnItem, text: "<p>hi" } }),
      id,
      noWait,
    );
    expect(detail.text).toBe("<p>hi");
  });
});

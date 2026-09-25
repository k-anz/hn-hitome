import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { generateDigest } from "../src/pipeline";
import type { Summarizer } from "../src/summarize";
import { fakeFetch } from "./helpers";

const config = { ...loadConfig({}), itemCount: 2 };
const now = new Date("2026-09-25T10:00:00Z");
const retry = { retries: 0, baseDelayMs: 0 };

const hits = [1, 2, 3, 4].map((id) => ({
  objectID: String(id),
  title: `Story ${id}`,
  url: null,
  points: 100 - id,
  num_comments: 1,
}));

function routes() {
  const r: Record<string, unknown> = {
    "https://hn.algolia.com/api/v1/search": { hits },
  };
  for (const { objectID } of hits) {
    r[`https://hacker-news.firebaseio.com/v0/item/${objectID}.json`] = {
      text: `<p>body ${objectID}`,
      kids: [10],
    };
    r[`https://hn.algolia.com/api/v1/items/${objectID}`] = {
      id: Number(objectID),
      children: [{ id: 10, text: "a comment", children: [] }],
    };
  }
  return r;
}

const okSummarizer: Summarizer = async (input) => ({
  titleJa: `ja ${input.title}`,
  summaryJa: input.articleText ?? "",
  discussionPointsJa: [input.commentsText],
});

describe("generateDigest", () => {
  it("ポイント上位から itemCount 本作る", async () => {
    const d = await generateDigest({
      fetchFn: fakeFetch(routes()),
      summarize: okSummarizer,
      now,
      config,
      log: () => {},
      retry,
    });
    expect(d.items.map((i) => i.hnId)).toEqual([1, 2]);
    expect(d.items[0]).toMatchObject({
      sourceStatus: "hn_text",
      summaryJa: "body 1",
      discussionPointsJa: ["- a comment"],
    });
  });

  it("失敗した記事は飛ばして次の候補で補充する（順位はポイント順のまま）", async () => {
    const summarize: Summarizer = async (input) => {
      if (input.title === "Story 1") throw new Error("boom");
      return okSummarizer(input);
    };
    const logs: string[] = [];
    const d = await generateDigest({
      fetchFn: fakeFetch(routes()),
      summarize,
      now,
      config,
      log: (m) => logs.push(m),
      retry,
    });
    expect(d.items.map((i) => i.hnId)).toEqual([2, 3]);
    expect(d.items.map((i) => i.rank)).toEqual([1, 2]);
    expect(logs.join("\n")).toContain("boom");
  });

  it("HN API が落ちている記事もスキップ対象", async () => {
    const r = routes();
    delete r["https://hn.algolia.com/api/v1/items/2"];
    const d = await generateDigest({
      fetchFn: fakeFetch(r),
      summarize: okSummarizer,
      now,
      config,
      log: () => {},
      retry,
    });
    expect(d.items.map((i) => i.hnId)).toEqual([1, 3]);
  });

  it("候補が尽きたら揃った分だけで出す", async () => {
    const summarize: Summarizer = async (input) => {
      if (input.title !== "Story 4") throw new Error("boom");
      return okSummarizer(input);
    };
    const d = await generateDigest({
      fetchFn: fakeFetch(routes()),
      summarize,
      now,
      config,
      log: () => {},
      retry,
    });
    expect(d.items.map((i) => i.hnId)).toEqual([4]);
  });

  it("1 本も作れなければ throw", async () => {
    const summarize: Summarizer = async () => {
      throw new Error("boom");
    };
    await expect(
      generateDigest({
        fetchFn: fakeFetch(routes()),
        summarize,
        now,
        config,
        log: () => {},
        retry,
      }),
    ).rejects.toThrow("no items");
  });

  it("候補の取得に失敗したら throw", async () => {
    await expect(
      generateDigest({
        fetchFn: fakeFetch({}),
        summarize: okSummarizer,
        now,
        config,
        log: () => {},
        retry,
      }),
    ).rejects.toThrow();
  });
});

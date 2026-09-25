import { describe, expect, it } from "vitest";
import { Digest, digestJsonSchema } from "../src/schema";

const valid = {
  schemaVersion: 1,
  date: "2026-09-25",
  generatedAt: "2026-09-25T10:03:12.000Z",
  detailUrl: "https://example.github.io/hn-hitome/2026/09/25.html",
  items: [
    {
      rank: 1,
      hnId: 123,
      titleJa: "タイトル",
      titleOriginal: "Title",
      summaryJa: "要約",
      discussionPointsJa: ["論点"],
      articleUrl: "https://example.com/a",
      hnUrl: "https://news.ycombinator.com/item?id=123",
      detailUrl: "https://example.github.io/hn-hitome/2026/09/25.html#123",
      points: 100,
      commentCount: 10,
      sourceStatus: "full",
    },
  ],
};

describe("Digest", () => {
  it("正しいデータを受け入れる", () => {
    expect(Digest.parse(valid)).toEqual(valid);
  });

  it("articleUrl は null を許す", () => {
    const d = structuredClone(valid);
    d.items[0]!.articleUrl = null as unknown as string;
    expect(() => Digest.parse(d)).not.toThrow();
  });

  it("items が空なら弾く", () => {
    expect(() => Digest.parse({ ...valid, items: [] })).toThrow();
  });

  it("範囲外の sourceStatus を弾く", () => {
    const d = structuredClone(valid);
    d.items[0]!.sourceStatus = "partial";
    expect(() => Digest.parse(d)).toThrow();
  });

  it("必須項目の欠けを弾く", () => {
    const d = structuredClone(valid) as Record<string, unknown>;
    delete d.date;
    expect(() => Digest.parse(d)).toThrow();
  });

  it("JSON Schema を生成できる", () => {
    const schema = digestJsonSchema() as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining(["schemaVersion", "date", "items"]),
    );
  });
});

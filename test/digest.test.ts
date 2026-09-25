import { describe, expect, it } from "vitest";
import {
  buildDigest,
  dayPath,
  jstDate,
  type GeneratedItem,
} from "../src/digest";

const item = (
  hnId: number,
  url: string | null = "https://a.test/x",
): GeneratedItem => ({
  candidate: { hnId, title: `T${hnId}`, url, points: 100, commentCount: 5 },
  summary: {
    titleJa: `タ${hnId}`,
    summaryJa: "要約",
    discussionPointsJa: ["論点"],
  },
  sourceStatus: "full",
});

describe("jstDate / dayPath", () => {
  it("UTC 15:00 以降は JST の翌日", () => {
    expect(jstDate(new Date("2026-09-25T14:59:59Z"))).toBe("2026-09-25");
    expect(jstDate(new Date("2026-09-25T15:00:00Z"))).toBe("2026-09-26");
  });

  it("日付をパスにする", () => {
    expect(dayPath("2026-09-05")).toBe("2026/09/05");
  });
});

describe("buildDigest", () => {
  const now = new Date("2026-09-25T10:03:12Z");

  it("rank と URL を振る", () => {
    const d = buildDigest({
      now,
      baseUrl: "https://u.github.io/hn",
      items: [item(11), item(22, null)],
    });
    expect(d.date).toBe("2026-09-25");
    expect(d.generatedAt).toBe("2026-09-25T10:03:12.000Z");
    expect(d.detailUrl).toBe("https://u.github.io/hn/2026/09/25.html");
    expect(d.items.map((i) => i.rank)).toEqual([1, 2]);
    expect(d.items[1]).toMatchObject({
      hnId: 22,
      titleOriginal: "T22",
      titleJa: "タ22",
      articleUrl: null,
      hnUrl: "https://news.ycombinator.com/item?id=22",
      detailUrl: "https://u.github.io/hn/2026/09/25.html#22",
    });
  });

  it("空なら throw（壊れた Digest は作らない）", () => {
    expect(() =>
      buildDigest({ now, baseUrl: "https://u.github.io/hn", items: [] }),
    ).toThrow();
  });
});

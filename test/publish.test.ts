import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDigest, type GeneratedItem } from "../src/digest";
import { publish, readArchive } from "../src/publish";

const item: GeneratedItem = {
  candidate: { hnId: 1, title: "T", url: null, points: 1, commentCount: 0 },
  summary: { titleJa: "タ", summaryJa: "要", discussionPointsJa: ["論"] },
  sourceStatus: "hn_text",
};
const digestAt = (iso: string) => buildDigest({ now: new Date(iso), baseUrl: "https://u.github.io/hn", items: [item] });

describe("publish", () => {
  it("日付ファイル・latest・index・schema を書く", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "hitome-"));
    const d = digestAt("2026-09-25T10:00:00Z");
    await publish(dir, d);

    expect(JSON.parse(await readFile(path.join(dir, "latest.json"), "utf8"))).toEqual(d);
    expect(JSON.parse(await readFile(path.join(dir, "2026/09/25.json"), "utf8"))).toEqual(d);
    expect(await readFile(path.join(dir, "2026/09/25.html"), "utf8")).toContain("今日はおしまい");
    expect(await readFile(path.join(dir, "index.html"), "utf8")).toContain("2026/09/25.html");
    expect(JSON.parse(await readFile(path.join(dir, "schema.json"), "utf8"))).toHaveProperty("properties");
  });

  it("同じ日の再実行は上書き、別の日は index に積み上がる（新しい順）", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "hitome-"));
    await publish(dir, digestAt("2026-09-24T10:00:00Z"));
    await publish(dir, digestAt("2026-09-25T10:00:00Z"));
    await publish(dir, digestAt("2026-09-25T11:00:00Z"));

    const archive = await readArchive(dir);
    expect(archive.map((d) => d.date)).toEqual(["2026-09-25", "2026-09-24"]);
    expect(archive[0]!.generatedAt).toBe("2026-09-25T11:00:00.000Z");
    expect(await readdir(path.join(dir, "2026/09"))).toHaveLength(4);

    const index = await readFile(path.join(dir, "index.html"), "utf8");
    expect(index.indexOf("2026-09-25")).toBeLessThan(index.indexOf("2026-09-24"));
  });
});

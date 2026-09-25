import type { Candidate } from "./hn";
import { Digest, type SourceStatus, type Summary } from "./schema";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDate(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function dayPath(date: string): string {
  return date.replaceAll("-", "/");
}

export type GeneratedItem = { candidate: Candidate; summary: Summary; sourceStatus: SourceStatus };

/** 生成結果を Digest にまとめて検証する。不正なら throw（壊れたデータは公開しない） */
export function buildDigest(args: { now: Date; baseUrl: string; items: GeneratedItem[] }): Digest {
  const date = jstDate(args.now);
  const detailUrl = `${args.baseUrl}/${dayPath(date)}.html`;
  return Digest.parse({
    schemaVersion: 1,
    date,
    generatedAt: args.now.toISOString(),
    detailUrl,
    items: args.items.map(({ candidate, summary, sourceStatus }, i) => ({
      rank: i + 1,
      hnId: candidate.hnId,
      titleJa: summary.titleJa,
      titleOriginal: candidate.title,
      summaryJa: summary.summaryJa,
      discussionPointsJa: summary.discussionPointsJa,
      articleUrl: candidate.url,
      hnUrl: `https://news.ycombinator.com/item?id=${candidate.hnId}`,
      detailUrl: `${detailUrl}#${candidate.hnId}`,
      points: candidate.points,
      commentCount: candidate.commentCount,
      sourceStatus,
    })),
  });
}

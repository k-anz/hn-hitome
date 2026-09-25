import { z } from "zod";

export const SourceStatus = z.enum(["full", "hn_text", "unavailable"]);
export type SourceStatus = z.infer<typeof SourceStatus>;

/** LLM が返す 1 記事ぶんの生成結果。structured outputs のスキーマにもそのまま使う */
export const Summary = z.object({
  titleJa: z.string().describe("タイトルの自然な日本語訳"),
  summaryJa: z.string().describe("記事の日本語要約（3〜4 文）"),
  discussionPointsJa: z.array(z.string()).describe("コメント欄の主な論点（日本語で 3〜5 個）"),
});
export type Summary = z.infer<typeof Summary>;

export const DigestItem = z.object({
  rank: z.int().positive(),
  hnId: z.int().positive(),
  titleJa: z.string().min(1),
  titleOriginal: z.string().min(1),
  summaryJa: z.string().min(1),
  discussionPointsJa: z.array(z.string().min(1)),
  articleUrl: z.url().nullable(),
  hnUrl: z.url(),
  detailUrl: z.url(),
  points: z.int().nonnegative(),
  commentCount: z.int().nonnegative(),
  sourceStatus: SourceStatus,
});
export type DigestItem = z.infer<typeof DigestItem>;

export const Digest = z.object({
  schemaVersion: z.literal(1),
  date: z.iso.date(),
  generatedAt: z.iso.datetime(),
  detailUrl: z.url(),
  items: z.array(DigestItem).min(1),
});
export type Digest = z.infer<typeof Digest>;

/** 公開用の JSON Schema（public/schema.json） */
export function digestJsonSchema(): object {
  return z.toJSONSchema(Digest);
}

import type { CommentFormatOptions } from "./comments";

export type Config = {
  itemCount: number;
  candidateCount: number;
  model: string;
  pagesBaseUrl: string;
  fetchTimeoutMs: number;
  maxArticleChars: number;
  comments: CommentFormatOptions;
};

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  return {
    itemCount: Number(env.ITEM_COUNT || 3),
    candidateCount: 10,
    model: env.MODEL || "claude-sonnet-5",
    pagesBaseUrl: (env.PAGES_BASE_URL || "https://k-anz.github.io/hn-hitome").replace(/\/+$/, ""),
    fetchTimeoutMs: 10_000,
    maxArticleChars: 20_000,
    comments: { maxTopLevel: 20, maxReplyDepth: 2, maxChars: 30_000 },
  };
}

import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import type { CommentNode } from "./comments";

export type Fetch = typeof fetch;
export type RetryOptions = { retries: number; baseDelayMs: number };

export type Candidate = {
  hnId: number;
  title: string;
  url: string | null;
  points: number;
  commentCount: number;
};

export type StoryDetail = { text: string | null; comments: CommentNode[] };

const DEFAULT_RETRY: RetryOptions = { retries: 3, baseDelayMs: 1000 };

/** GET して JSON を返す。5xx・429・通信エラーは指数バックオフでリトライする */
export async function fetchJson(fetchFn: Fetch, url: string, retry = DEFAULT_RETRY): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retry.retries; attempt++) {
    if (attempt > 0) await sleep(retry.baseDelayMs * 2 ** (attempt - 1));
    try {
      const res = await fetchFn(url);
      if (res.ok) return await res.json();
      lastError = new Error(`GET ${url} -> ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const AlgoliaSearch = z.object({
  hits: z.array(
    z.object({
      objectID: z.string(),
      title: z.string(),
      url: z.string().nullish(),
      points: z.number().nullish(),
      num_comments: z.number().nullish(),
    }),
  ),
});

/** 過去 24 時間に投稿された story をポイント降順で limit 件 */
export async function fetchCandidates(
  fetchFn: Fetch,
  now: Date,
  limit: number,
  retry?: RetryOptions,
): Promise<Candidate[]> {
  const since = Math.floor(now.getTime() / 1000) - 24 * 60 * 60;
  const params = new URLSearchParams({
    tags: "story",
    numericFilters: `created_at_i>${since}`,
    hitsPerPage: "50",
  });
  const json = await fetchJson(fetchFn, `https://hn.algolia.com/api/v1/search?${params}`, retry);
  return AlgoliaSearch.parse(json)
    .hits.map((h) => ({
      hnId: Number(h.objectID),
      title: h.title,
      url: h.url || null,
      points: h.points ?? 0,
      commentCount: h.num_comments ?? 0,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

const HnItem = z.object({
  text: z.string().nullish(),
  kids: z.array(z.number()).nullish(),
});

const AlgoliaNode = z.object({
  id: z.number(),
  text: z.string().nullish(),
  get children() {
    return z.array(AlgoliaNode);
  },
});
type AlgoliaNode = z.infer<typeof AlgoliaNode>;

function toCommentNode(node: AlgoliaNode): CommentNode {
  return { text: node.text ?? null, children: node.children.map(toCommentNode) };
}

/**
 * 記事の本文テキストとコメントツリーを取る。
 * ツリーは Algolia から 1 リクエストで取り、トップレベルの順番だけ公式 API の kids（HN の表示順）に合わせる。
 */
export async function fetchStoryDetail(
  fetchFn: Fetch,
  hnId: number,
  retry?: RetryOptions,
): Promise<StoryDetail> {
  const [item, tree] = await Promise.all([
    fetchJson(fetchFn, `https://hacker-news.firebaseio.com/v0/item/${hnId}.json`, retry).then((j) =>
      HnItem.parse(j),
    ),
    fetchJson(fetchFn, `https://hn.algolia.com/api/v1/items/${hnId}`, retry).then((j) =>
      AlgoliaNode.parse(j),
    ),
  ]);
  const order = new Map((item.kids ?? []).map((id, i) => [id, i]));
  const topLevel = tree.children
    .filter((c) => order.has(c.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { text: item.text ?? null, comments: topLevel.map(toCommentNode) };
}

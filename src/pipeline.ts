import { chooseSource, fetchArticleText } from "./article";
import { formatComments } from "./comments";
import type { Config } from "./config";
import { buildDigest, type GeneratedItem } from "./digest";
import {
  fetchCandidates,
  fetchStoryDetail,
  type Candidate,
  type Fetch,
  type RetryOptions,
} from "./hn";
import type { Digest } from "./schema";
import type { Summarizer } from "./summarize";

export type PipelineDeps = {
  fetchFn: Fetch;
  summarize: Summarizer;
  now: Date;
  config: Config;
  log: (msg: string) => void;
  retry?: RetryOptions;
};

async function generateItem(
  deps: PipelineDeps,
  candidate: Candidate,
): Promise<GeneratedItem> {
  const { fetchFn, config } = deps;
  const [detail, articleText] = await Promise.all([
    fetchStoryDetail(fetchFn, candidate.hnId, deps.retry),
    candidate.url
      ? fetchArticleText(fetchFn, candidate.url, config.fetchTimeoutMs)
      : Promise.resolve(null),
  ]);
  const source = chooseSource(articleText, detail.text, config.maxArticleChars);
  const summary = await deps.summarize({
    title: candidate.title,
    sourceStatus: source.status,
    articleText: source.text,
    commentsText: formatComments(detail.comments, config.comments),
  });
  deps.log(`ok   #${candidate.hnId} [${source.status}] ${candidate.title}`);
  return { candidate, summary, sourceStatus: source.status };
}

/** 候補をポイント順に試し、itemCount 本揃うまで失敗分を次の候補で補充する */
export async function generateDigest(deps: PipelineDeps): Promise<Digest> {
  const { config } = deps;
  const candidates = await fetchCandidates(
    deps.fetchFn,
    deps.now,
    config.candidateCount,
    deps.retry,
  );
  const items: GeneratedItem[] = [];
  let next = 0;
  while (items.length < config.itemCount && next < candidates.length) {
    const batch = candidates.slice(
      next,
      next + config.itemCount - items.length,
    );
    next += batch.length;
    const results = await Promise.allSettled(
      batch.map((c) => generateItem(deps, c)),
    );
    results.forEach((r, i) => {
      if (r.status === "fulfilled") items.push(r.value);
      else
        deps.log(
          `skip #${batch[i]!.hnId} ${batch[i]!.title}: ${String(r.reason)}`,
        );
    });
  }
  if (items.length === 0) throw new Error("no items could be generated");
  return buildDigest({ now: deps.now, baseUrl: config.pagesBaseUrl, items });
}

import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import type { Fetch } from "./hn";
import type { SourceStatus } from "./schema";
import { htmlToText } from "./text";

export const MIN_ARTICLE_CHARS = 300;

const USER_AGENT = "hn-hitome/0.1 (+https://github.com/k-anz/hn-hitome)";

/** readability で本文を抜く。短すぎれば null */
export function extractArticleText(html: string, url: string): string | null {
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
  const article = new Readability(dom.window.document).parse();
  const text = (article?.textContent ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*\n\s*/g, "\n\n")
    .trim();
  return text.length >= MIN_ARTICLE_CHARS ? text : null;
}

/** 記事ページを取って本文を返す。失敗はすべて null（パイプラインを止めない） */
export async function fetchArticleText(
  fetchFn: Fetch,
  url: string,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const res = await fetchFn(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": USER_AGENT },
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("text/html"))
      return null;
    return extractArticleText(await res.text(), res.url || url);
  } catch {
    return null;
  }
}

export type ArticleSource = { status: SourceStatus; text: string | null };

/** 記事本文 → HN の本文テキスト → なし、の順で使うものを決める */
export function chooseSource(
  articleText: string | null,
  hnText: string | null,
  maxChars: number,
): ArticleSource {
  if (articleText)
    return { status: "full", text: articleText.slice(0, maxChars) };
  if (hnText)
    return { status: "hn_text", text: htmlToText(hnText).slice(0, maxChars) };
  return { status: "unavailable", text: null };
}

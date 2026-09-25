import { dayPath } from "./digest";
import type { Digest, DigestItem } from "./schema";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

export function renderJson(digest: Digest): string {
  return `${JSON.stringify(digest, null, 2)}\n`;
}

const STYLE = `
:root { color-scheme: light dark; --bg: #fbfaf7; --fg: #22211f; --muted: #6b6860; --line: #e4e1da; --accent: #c2410c; }
@media (prefers-color-scheme: dark) { :root { --bg: #161514; --fg: #e8e6e1; --muted: #9a968d; --line: #2e2c29; --accent: #fb923c; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.75 system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; }
main { max-width: 40rem; margin: 0 auto; padding: 24px 16px 64px; }
header p, .meta, .orig, footer { color: var(--muted); font-size: 0.85rem; }
h1 { font-size: 1.1rem; margin: 0 0 4px; }
article { border-top: 1px solid var(--line); padding: 24px 0; }
h2 { font-size: 1.2rem; line-height: 1.5; margin: 0 0 4px; }
.orig { margin: 0 0 12px; }
.note { font-size: 0.85rem; color: var(--muted); border-left: 3px solid var(--line); padding-left: 8px; }
h3 { font-size: 0.9rem; margin: 16px 0 4px; color: var(--muted); }
ul { padding-left: 1.2em; margin: 0; }
li { margin: 4px 0; }
a { color: var(--accent); }
.links { display: flex; gap: 16px; margin-top: 12px; font-size: 0.9rem; }
footer { border-top: 1px solid var(--line); padding-top: 24px; text-align: center; }
.end { font-size: 1.1rem; color: var(--fg); }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

function renderItem(item: DigestItem): string {
  const note =
    item.sourceStatus === "unavailable"
      ? `<p class="note">※本文を取得できなかったため、タイトルとコメントからの要約です</p>`
      : "";
  const articleLink = item.articleUrl
    ? `<a href="${escapeHtml(item.articleUrl)}">元記事</a>`
    : "";
  return `<article id="${item.hnId}">
<h2>${escapeHtml(item.titleJa)}</h2>
<p class="orig">${escapeHtml(item.titleOriginal)}</p>
${note}
<p>${escapeHtml(item.summaryJa)}</p>
<h3>コメント欄の論点</h3>
<ul>
${item.discussionPointsJa.map((p) => `<li>${escapeHtml(p)}</li>`).join("\n")}
</ul>
<p class="meta">${item.points} points · ${item.commentCount} comments</p>
<div class="links">${articleLink}<a href="${escapeHtml(item.hnUrl)}">HN のスレッド</a></div>
</article>`;
}

export function renderDayHtml(digest: Digest): string {
  const body = `<header>
<h1>HN ひとめ</h1>
<p>${escapeHtml(digest.date)} の ${digest.items.length} 本</p>
</header>
${digest.items.map(renderItem).join("\n")}
<footer>
<p class="end">今日はおしまい 🌙</p>
<p><a href="../../index.html">これまでのダイジェスト</a></p>
</footer>`;
  return page(`HN ひとめ ${digest.date}`, body);
}

export function renderIndexHtml(archive: Digest[]): string {
  const entries = archive
    .map(
      (d) => `<article>
<h2><a href="${dayPath(d.date)}.html">${escapeHtml(d.date)}</a></h2>
<ul>
${d.items.map((i) => `<li>${escapeHtml(i.titleJa)}</li>`).join("\n")}
</ul>
</article>`,
    )
    .join("\n");
  return page(
    "HN ひとめ",
    `<header><h1>HN ひとめ</h1><p>これまでのダイジェスト</p></header>\n${entries}`,
  );
}

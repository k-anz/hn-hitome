# HN 日本語ダイジェスト: 生成パイプライン & 公開 設計

- 日付: 2026-09-25
- 対象: `spec/SPEC.md` のマイルストーン 1〜2（データ生成と GitHub Pages への公開）
- 対象外: ウィジェット（KWGT / Jetpack Glance）。本設計で決める JSON スキーマを境界として、別の spec で扱う

## 目的

1 日 1 回、Hacker News で過去 24 時間に伸びた記事 3 本について、日本語タイトル・要約・コメント欄の論点を生成し、ウィジェット用 JSON と詳細 HTML を GitHub Pages で公開する。

## 決定事項

| 項目 | 決定 |
|---|---|
| 言語 / 実行 | TypeScript（Node 22）、`tsx` で直接実行（ビルドなし） |
| LLM | Claude Sonnet 5（`claude-sonnet-5`）。モデル名は設定で差し替え可 |
| 記事数 | 3 本 / 日（設定で変更可） |
| 選定 | 過去 24 時間に投稿された story をポイント順で上位から |
| 本文取得 | 自前 fetch + `@mozilla/readability` + `jsdom` |
| 公開 | 生成物を `main` の `public/` にコミットし、Actions から Pages にデプロイ |
| アーカイブ | `latest.json` + 日付ごとの JSON / HTML を残す |
| リポジトリ | public |
| 型・契約 | zod を唯一の正とし、TS 型・実行時検証・JSON Schema をそこから導出 |

## 構成

```
src/
  config.ts      # 本数・モデル名・上限値・公開 URL（環境変数で上書き可）
  schema.ts      # zod 定義（Digest / DigestItem / LLM 出力）
  hn.ts          # 候補選定とコメントツリー取得
  article.ts     # 本文 fetch + readability 抽出
  comments.ts    # コメントツリー → LLM 入力テキスト（純粋関数）
  summarize.ts   # Claude 呼び出し（記事 1 本につき 1 回、structured outputs）
  render.ts      # Digest → JSON / HTML 文字列（純粋関数）
  publish.ts     # public/ への書き出し
  main.ts        # 全体の組み立て
scripts/
  schema.ts      # public/schema.json の生成
public/          # Pages に出すもの（生成物をコミット）
test/
  fixtures/      # 実 API から保存したレスポンスと HTML
```

I/O を行うモジュール（`hn.ts` `article.ts` `summarize.ts` `publish.ts`）は、`fetch` や LLM クライアントなどの依存を引数で受け取る。変換は純粋関数（`comments.ts` `render.ts`）に寄せる。

## データの流れ

1. **日付決定**: 実行時刻から JST の日付を決める
2. **候補選定**（`hn.ts`）: Algolia `search` API に `tags=story` と `numericFilters=created_at_i>{24時間前}` を付け、多めに取得（`hitsPerPage=50`）。手元で `points` の降順に並べ、上位 10 件を候補にする
3. **記事ごとの準備**（候補の上位から、3 本揃うまで。記事ごとの処理は並列）
   - 記事メタ: HN 公式 API `item/{id}`（`title` `url` `text` `score` `descendants` `kids`）
   - コメント: Algolia `items/{id}` でツリー全体を 1 リクエストで取得。トップレベルは公式 API の `kids` の順（HN の表示順）に並べ替える。返信は Algolia の順のまま
   - 本文（`article.ts`）:
     - `url` がある → fetch（タイムアウト 10 秒）→ readability で抽出 → 成功すれば `sourceStatus: "full"`
     - `url` がなく `text` がある（Ask HN など）→ HTML を剥がした `text` を使い、`sourceStatus: "hn_text"`
     - 失敗（4xx/5xx、タイムアウト、HTML 以外、抽出後 300 文字未満）→ 本文なしで `sourceStatus: "unavailable"`
   - 本文は 20,000 文字で切り詰める
4. **コメント整形**（`comments.ts`）: トップレベル最大 20 件、各 2 階層まで。削除・dead は除外。HTML を剥がし、インデントで階層を表したテキストにする。合計 30,000 文字を超えた分は捨てる
5. **要約**（`summarize.ts`）: 記事 1 本につき 1 回呼ぶ。入力はタイトル、本文（ある場合）、コメントテキスト、`sourceStatus`。出力は structured outputs で次の形に固定する
   - `titleJa`: タイトルの自然な日本語訳
   - `summaryJa`: 3〜4 文の要約。本文がない場合はタイトルとコメントから推測した内容であることが分かる書き方にする
   - `discussionPointsJa`: コメント欄の主な論点を 3〜5 個
6. **組み立て**: 生成できた記事を `rank` 1 から振り直して `Digest` にし、`Digest.parse()` で検証する
7. **出力**（`render.ts` / `publish.ts`）
   - `public/latest.json`
   - `public/YYYY/MM/DD.json`（`latest.json` と同じ内容）
   - `public/YYYY/MM/DD.html`（その日の詳細ページ）
   - `public/index.html`（`public/` 以下の日付 JSON を走査して作るアーカイブ一覧）
   - `public/schema.json`

## JSON スキーマ（v1）

zod の定義が正。以下はその形を示したもの。

```jsonc
{
  "schemaVersion": 1,
  "date": "2026-09-25",                 // JST
  "generatedAt": "2026-09-25T10:03:12Z",
  "detailUrl": "https://<user>.github.io/hn-hitome/2026/09/25.html",
  "items": [
    {
      "rank": 1,
      "hnId": 41234567,
      "titleJa": "…",
      "titleOriginal": "…",
      "summaryJa": "…",
      "discussionPointsJa": ["…", "…", "…"],
      "articleUrl": "https://example.com/…",   // url がない投稿は null
      "hnUrl": "https://news.ycombinator.com/item?id=41234567",
      "detailUrl": "https://…/2026/09/25.html#41234567",
      "points": 812,
      "commentCount": 340,
      "sourceStatus": "full"                  // "full" | "hn_text" | "unavailable"
    }
  ]
}
```

- ウィジェットが最低限使うのは `items[].titleJa` と `items[].detailUrl`
- 公開 URL のベースは `PAGES_BASE_URL` で設定する
- 形を壊す変更をするときは `schemaVersion` を上げる
- `public/schema.json` は zod v4 の `z.toJSONSchema()` で生成する。LLM の structured outputs に渡すスキーマも同じ方法で `schema.ts` から生成する

## 詳細 HTML

- 1 日 1 ページ。3 本を縦に並べ、各記事の見出しに `id="{hnId}"` を付ける
- 各記事: 日本語タイトル、原題、要約、論点リスト、元記事リンク、HN リンク、ポイント / コメント数
- `sourceStatus` が `unavailable` の記事には「※本文を取得できなかったため、タイトルとコメントからの要約です」と表示する
- 末尾に「今日はおしまい 🌙」とアーカイブへのリンク
- JS なし。スマホ幅向けのインライン CSS、`prefers-color-scheme` でダークモード
- LLM の出力を含む全ての文字列は HTML エスケープする

## エラー処理

方針: 1 本失敗しても残りは出す。1 本も作れなければ何も書き出さない。

| 失敗箇所 | 挙動 |
|---|---|
| Algolia / HN 公式 API | 3 回リトライ（指数バックオフ）。ダメならジョブ失敗。前日までの公開物は残る |
| 本文の取得・抽出 | エラーにしない。`sourceStatus: "unavailable"` で続行 |
| LLM 呼び出し | SDK の組み込みリトライ。ダメならその記事をスキップし、次の候補で補充 |
| 候補が 10 件で足りない | 揃った本数で出す（1 本以上あれば成功） |
| 1 本も作れない | ジョブ失敗。何も書き出さない |
| zod 検証失敗 | ジョブ失敗。何も書き出さない |

- 同じ日付で再実行すると、その日のファイルを上書きする（冪等）
- ログには記事ごとの `sourceStatus` と入出力トークン数を出す
- 失敗の通知は GitHub Actions の標準メール通知に任せる

## GitHub Actions

`.github/workflows/daily.yml`
- トリガー: `schedule: cron "0 10 * * *"`（19:00 JST）、`workflow_dispatch`
- 権限: `contents: write` `pages: write` `id-token: write`
- 手順: checkout → Node 22 → `npm ci` → `npm run generate` → `public/` に差分があれば bot 名義で `main` にコミット & push → `actions/upload-pages-artifact`（`public/`）→ `actions/deploy-pages`
- Secrets: `ANTHROPIC_API_KEY`。`PAGES_BASE_URL` は Actions の変数（vars）で設定する
- 同時実行は `concurrency` で 1 つに制限

`.github/workflows/ci.yml`
- push / PR で `npm run typecheck`（`tsc --noEmit`）と `npm test`

Pages のソースは「GitHub Actions」に設定する（手動作業。README に書く）。

## テスト

vitest を使う。外部 API はテストから呼ばない。

- 依存は引数で受け取るので、テストでは偽物を渡す（mock ライブラリでモジュールを差し替える `vi.mock` は使わない）
- 偽物が返すデータは、実 API から保存した `test/fixtures/` のレスポンスを使う

| 対象 | 確認すること |
|---|---|
| `schema.ts` | 正しいデータは通る。必須項目の欠け、`sourceStatus` の範囲外などは弾く |
| `comments.ts` | 20 件 × 2 階層の剪定、削除・dead の除外、HTML の除去、文字数上限 |
| `render.ts` | JSON の形、HTML のエスケープ、アンカー、`unavailable` の注記 |
| `article.ts` | fixture の HTML から本文が取れる。短すぎる・HTML 以外は `unavailable` |
| `hn.ts` | ポイント順の並べ替え、24 時間の範囲、トップレベルの並べ替え |
| `main.ts` | 1 本失敗したら次の候補で補充される。全部失敗したら何も書き出さない |

## 開発用コマンド

- `npm run generate`: 本番と同じ生成（ローカルでは `.env` から API キーを読む）
- `npm run generate -- --dry-run`: 実 API で生成し、`public/` ではなく `tmp/` に出力する。`--save-fixtures` を付けると取得したレスポンスを `test/fixtures/` に保存する
- `npm run schema`: `public/schema.json` を生成する（`generate` の中でも実行する）
- `npm test` / `npm run typecheck`
- フォーマットは Prettier。ESLint は入れない

## 今回やらないこと

- 自分の興味に合わせた選定（プロンプトでの好み指定、タップ履歴）
- ウィジェット本体
- 過去に出した記事の除外（24 時間の範囲なので被りにくいと判断）
- コストの上限制御（1 日 3 本なので不要と判断。ログで様子を見る）

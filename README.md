# hn-hitome

Hacker News の過去 24 時間の上位記事を、日本語タイトル・要約・コメント欄の論点つきで 1 日 1 回まとめて GitHub Pages に置く。スマホのホーム画面ウィジェットから読む想定。

- 設計: `docs/superpowers/specs/2026-09-25-digest-pipeline-design.md`
- 公開物: `public/latest.json`（ウィジェット用）、`public/YYYY/MM/DD.{json,html}`、`public/index.html`
- JSON の契約: `public/schema.json`（`src/schema.ts` の zod 定義から生成）

## ローカルで動かす

```sh
npm ci
cp .env.example .env   # ANTHROPIC_API_KEY を入れる
npm run generate -- --dry-run                              # tmp/ に出力
npm run generate -- --dry-run --fake-llm                   # Claude を呼ばずに全体を確認
npm run generate -- --dry-run --fake-llm --save-fixtures   # 取得したレスポンスを test/fixtures/recorded/ に保存
npm test && npm run typecheck
```

## GitHub の初期設定（手動）

1. リポジトリを public にする
2. Settings → Pages → Source を「GitHub Actions」にする
3. Settings → Secrets and variables → Actions
   - Secret `ANTHROPIC_API_KEY`
   - Variable `PAGES_BASE_URL`（例: `https://k-anz.github.io/hn-hitome`。未設定ならこれが既定値）
4. Actions → daily digest → Run workflow で一度手動実行する

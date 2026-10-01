# hn-hitome

Hacker News の過去 24 時間の上位記事を、日本語タイトル・要約・コメント欄の論点つきで 1 日 1 回まとめて GitHub Pages に置く。スマホのホーム画面ウィジェットから読む想定。

- 設計: `docs/superpowers/specs/2026-09-25-digest-pipeline-design.md`
- 公開物: `public/latest.json`（ウィジェット用）、`public/YYYY/MM/DD.{json,html}`、`public/index.html`
- JSON の契約: `public/schema.json`（`src/schema.ts` の zod 定義から生成）

## ローカルで動かす

```sh
npm ci
cp .env.example .env   # ANTHROPIC_API_KEY を入れる（または `ant auth login` 済みなら空のままでよい）
npm run generate -- --dry-run                              # tmp/ に出力
npm run generate -- --dry-run --fake-llm                   # Claude を呼ばずに全体を確認
npm run generate -- --dry-run --fake-llm --save-fixtures   # 取得したレスポンスを test/fixtures/recorded/ に保存
npm test && npm run typecheck
```

## GitHub の初期設定（手動）

Actions からの Claude API 呼び出しは、API キーではなく OIDC（Workload Identity Federation）で認証する。

1. リポジトリを public にする
2. Settings → Pages → Source を「GitHub Actions」にする（`github-pages` environment ができる）
3. Claude Console → Workload identity
   - issuer: `https://token.actions.githubusercontent.com`（JWKS は issuer URL から自動取得）
   - サービスアカウントを作り、ルールに紐づける
   - ルールの subject パターン: `repo:k-anz/hn-hitome:environment:github-pages`
4. Settings → Secrets and variables → Actions → Variables
   - `ANTHROPIC_FEDERATION_RULE_ID`（`fdrl_...`）
   - `ANTHROPIC_ORGANIZATION_ID`
   - `ANTHROPIC_SERVICE_ACCOUNT_ID`（`svac_...`）
   - `ANTHROPIC_OIDC_AUDIENCE`（ルールで audience を指定した場合だけ。未設定なら GitHub の既定値）
   - `PAGES_BASE_URL`（例: `https://k-anz.github.io/hn-hitome`。未設定ならこれが既定値）
5. Actions → daily digest → Run workflow で一度手動実行する

ルールは `github-pages` environment に絞っているので、ローカルや他のワークフローからは OIDC で認証できない。

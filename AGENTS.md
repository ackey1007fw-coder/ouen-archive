<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 応援アーカイブ — エージェント向けガイド

5つの応援サイトをつなぐ非公式ポータル。対象repoは `ackey1007fw-coder/ouen-archive`、baseは `main`。人物・子サイト・公開設定の違いを保って運用する。

## PROJECT MEMORY — READ FIRST

コード変更・レビュー・設計提案の前に読む。

1. `AGENTS.md`（このファイル）
2. `docs/AI_HANDOFF.md` — 現在のプロジェクト状態
3. `docs/DECISION_LOG.md` — 重要判断と理由
4. `docs/AI_PROJECT_MEMORY_SKILL.md` — 記憶の運用・更新方法
5. 現在のmain、関連merged PR、対象コード・テスト

矛盾時の基本順位はmain / merged PR → Decision Logの明示的なオーナー判断 → HANDOFF → 過去チャット・AIの記憶。人物事実が現在の公式一次情報と衝突した場合は、勝手に上書きせず根拠を示してオーナーへ確認する。

古いHANDOFFの「未完了」は、現在のmain・PRで再確認する。最新の明示指示と停止条件を優先し、AGENTSを編集してその編集PRの承認・品質ゲートを緩めない。

## 作業開始・環境

- `git status --short --branch` / `git remote -v` で既存変更と対象repoを確認する。
- 最新mainと、対象ファイルに触るOpen/Draft PRを読む。他AIの未マージPR・未コミット変更を上書きしない。複数AIで同じbranch・同じファイルを並行編集しない。
- Next.js App Router / TypeScript / pnpm。バージョン・コマンドは `package.json`・`pnpm-lock.yaml`・CIを正とする。
- 冒頭のNext.js生成ブロックを保持する。フレームワークのコード変更では、そこに指定されたインストール済みドキュメントを確認する。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## 編集先

| 内容 | 正本・実装 |
| --- | --- |
| 人物プロフィール・SNS・応援リンク | `src/data/persons.ts` |
| 人物カード | `src/components/PersonCard.tsx` |
| 期限つき応援campaign | `src/data/support-campaigns.ts` |
| SUPPORT NOW選定・表示 | `src/lib/support-spotlight.ts` / `src/components/SupportSpotlight.tsx` |
| Portal Feedの契約・集約 | `src/lib/feed-schema.ts` / `src/lib/portal-feeds.ts` |
| Mily realtime | `src/lib/mily-realtime.ts` / `src/lib/mily-realtime-state.ts` |
| OGP | `src/app/opengraph-image.tsx` / `src/lib/og-portraits.ts` |
| 控えめな制作者紹介 | `src/data/creator.ts` |

## 維持する判断

- 人物カードは `mily → yukako → riri → chizuru → mako` の固定順・同等weight。人気順ではない。
- OGPだけに適用する「4人・タイル幅の違い」を人物カードへ波及させない。写真は既存ポートレートからの決定的なトリミングのみで、顔の生成・合成・レタッチをしない。
- 誕生日を保存し、年齢を固定しない。未確認の生年や所属を推測しない。明示確認された事実を「今の検索で見つからない」だけで消さない。
- 本人SNS・応援リンクは確認済みのみ。人数間で件数を揃えるためにURLを補完しない。MAKOのX / SHOWROOM非掲載方針を復活させない。
- 親のプロフィールと子サイトのfeedを別の正本として扱う。profile作業のついでにPortal Feed contractやRealtimeロジックを変更しない。
- feedのURL / datetime / personId / originを検証し、子feedの失敗を隔離する。1件の失敗で全体を落とさない。
- 配信中・放送中はfreshなverified状態だけ。予定、stale、unknownをliveへ昇格させない。
- SUPPORT NOWは確認済みの期間と次の予定から選ぶ。本文の語句だけで受付中と判断せず、終了後に表示を残さない。人物カードの固定順と混同しない。
- 制作者紹介は下部に置き、人物カードより弱くする。

## 公開・プライバシー

このrepoは公開。コード・コメント・PR・Project Memoryへ次を持ち込まない。

- 私的DM・私信、非公開の人間関係、恋愛や意図の推測
- 私的な住所・電話番号・連絡先・家族等の非公開プロフィール
- token / credential / secret
- 不要なユーザー個人情報、職業を特定する制作者紹介

人物情報は公開情報またはオーナーが掲載を明示確認したもののみ。不明値を補完しない。

## 検証・マージ・本番

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check                      # 未ステージの変更
git diff --cached --check             # ステージ済みの変更
git diff --check origin/main...HEAD   # コミット済みのPR差分（最新のbaseを取得後）
```

- UI変更は390 / 430 / 1280pxを基本に、対象画面、PROFILE開閉、リンク、focus、横overflowを確認する。
- 期限・realtime変更は境界時刻とunknown / stale / 取得失敗を確認する。文書だけなら参照先・矛盾・公開範囲を確認する。
- 原則branch → PR → CI → review → merge。Ready化・mergeはオーナー指示の範囲で行い、停止条件を守る。
- current headのCI・必要なレビュー・競合を確認する。未実行を成功扱いせず、取得不能と不具合を区別する。
- 人物事実、サイトidentity、大きいlayout変更はオーナー確認を挟む。子repoの監査はREAD ONLYが基本。
- 採用中のcanonicalは https://ouen-archive-564c.vercel.app/ 。別のPreview URLを見てproduction URL / canonical / person orderを変更しない。
- ChizuruのGitHub mergeとChatGPT Sitesのproduction publishは別工程。他の子サイトと同じデプロイ方式だと決めつけない。
- mergeはGitHubの `merged=true`・日時・mainのcommitを確認し、本番反映の確認結果と分けて報告する。

## 作業後のSAVE

大きなPhase後は `docs/AI_HANDOFF.md` を更新する。長期判断は `docs/DECISION_LOG.md` へ追記し、現在状態と判断理由を分ける。変更内容、PR、検証結果、未確認事項、次の一歩を残す。小さな修正のために判断ログを水増ししない。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PROJECT MEMORY — READ FIRST

このrepositoryでコード変更・レビュー・設計提案を行うAI/agentは、作業開始前に必ず以下を読んでください。

1. `docs/AI_HANDOFF.md` — 現在のプロジェクト状態
2. `docs/DECISION_LOG.md` — 重要判断とその理由
3. 変更対象のコードとテスト

## Source-of-truth priority

矛盾した場合の基本順位:

1. 現在の `main` のコード / merged PR
2. `docs/DECISION_LOG.md` にある明示的なオーナー判断
3. `docs/AI_HANDOFF.md`
4. 過去チャットやagentの記憶

人物事実について現在の公式一次情報と記録が衝突する場合は、勝手に上書きせずオーナーへ確認してください。

## Working rules

- 原則 branch → PR → CI → review → merge。
- 大きなphaseが終わったら `docs/AI_HANDOFF.md` を更新する。
- 長期判断が増えたら `docs/DECISION_LOG.md` に追記する。
- profile作業のついでにPortal Feed contractやRealtimeロジックを変更しない。
- child repositoryを監査するだけならREAD ONLYを基本とする。
- production URL / canonical / person orderを確認なしで変更しない。
- 複数AIに同じbranchの同じファイルを並行編集させない。

## Public-repository privacy boundary

このrepositoryは公開です。以下をproject memory・コード・コメントへ保存しないでください。

- 個人的なDMや私信
- 恋愛・人間関係の推測
- 住所、電話番号、私的連絡先
- 家族等の非公開プロフィール
- token、credential、secret
- プロジェクトに不要なユーザー個人情報

人物プロフィールには公開情報またはオーナーが明示確認した情報だけを使い、不明値を推測で補完しないでください。

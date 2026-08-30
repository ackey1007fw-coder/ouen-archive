# 応援アーカイブ

5つの個人応援サイトをつなぐ、ファン制作の非公式ポータルです。

- みりぃ / 三橋莉子
- 吉井優花子
- 夏凪里季
- 伊東千鶴
- MAKO / まこ

## 現在の主な機能

- 5人の人物カードと展開式PROFILE
- 期限連動の `SUPPORT NOW`（投票・審査・次の出演予定）
- 5つのPortal Feedを集約した `TODAY` / `LATEST UPDATES`
- `SUPPORT NOW` 内のverifiedなMily realtime banner
- 各child siteから親ポータルへ戻る導線
- bottom-only creator mini profile

## AI / agent向け project memory

別チャットや別AIから作業を再開する場合は、まず以下を読んでください。

1. [`AGENTS.md`](./AGENTS.md)
2. [`docs/AI_HANDOFF.md`](./docs/AI_HANDOFF.md) — 現在のセーブデータ
3. [`docs/DECISION_LOG.md`](./docs/DECISION_LOG.md) — 重要判断とその理由

`CLAUDE.md` は `AGENTS.md` を参照します。

## 開発

```bash
pnpm install
pnpm dev
```

品質確認:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 運用方針

- 原則 branch → PR → CI → review → merge
- 人物情報は公開情報またはオーナーが明示確認した情報のみ
- 不明値を推測で補完しない
- 大きなphase後は `docs/AI_HANDOFF.md` を更新
- 長期判断は `docs/DECISION_LOG.md` に残す

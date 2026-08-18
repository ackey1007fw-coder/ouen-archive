# 応援アーカイブ

5つの個人応援サイトをつなぐ、ファン制作の非公式ポータルです。

## 開発

```bash
pnpm install
pnpm dev
```

品質確認は次のコマンドで行います。

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Phase 1では人物カードと各応援サイトへの導線、将来のPortal Feed連携に備えたzod schema、LATEST UPDATESの空状態を実装しています。外部feed取得はまだ行いません。

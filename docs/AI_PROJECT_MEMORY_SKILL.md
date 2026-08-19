# AI PROJECT MEMORY SKILL

この文書は、ChatGPT / Claude Code / Codex / Grok など複数AI・複数チャットで同じ開発プロジェクトを継続するための、再利用可能な「Project Memory」運用スキルです。

## 目的

新しいAIや新しいチャットが、過去会話を持っていなくても、GitHub repositoryを読めば短時間で現在地点へ復帰できる状態を保ちます。

このスキルは「AIに全部覚えさせる」のではなく、**GitHubを共有の外部記憶として使う**運用です。

---

## Trigger

以下の状況ではこのスキルを使います。

- 新しいChatGPTチャットへ移る
- Claude Code / Codex / Grokなど別AIへ作業を渡す
- 大きなPhaseやPRを完了した
- 重要な設計判断・運用判断が増えた
- 「前に何を決めた？」「なぜこうした？」を再確認したい
- 複数AIが同じrepoで分業する

---

## 必須ファイル

repositoryには原則として以下を置きます。

```text
AGENTS.md
docs/
  AI_HANDOFF.md
  DECISION_LOG.md
  AI_PROJECT_MEMORY_SKILL.md
```

### `AGENTS.md`
AIが最初に読む入口。

最低限、以下を明示します。

1. `docs/AI_HANDOFF.md` を読む
2. `docs/DECISION_LOG.md` を読む
3. 対象コード・テストを読む
4. 矛盾時のsource-of-truth順位
5. branch / PR / CI / review / mergeルール
6. public repoへ保存してはいけない情報

### `docs/AI_HANDOFF.md`
**現在のセーブデータ。**

書くもの:

- プロジェクト概要
- repo / production URL
- 現在の機能
- 直近のmerged PR / Phase
- 現在有効なデータ・仕様
- 既知の注意事項
- 未完了事項
- 次に確認すべきこと
- AI分業
- 最終更新日

書かないもの:

- 長い議論の全文
- 一時的な思考過程
- 私的DM
- 不要な個人情報

### `docs/DECISION_LOG.md`
**なぜ今の形になったかを残す長期判断ログ。**

1件ごとに次の形式を推奨します。

```md
## YYYY-MM-DD — 判断タイトル

**Decision**
採用した判断。

**Reason**
理由。

**Related**
PR / issue / source。

**Do not**
今後のAIが勝手に戻してはいけないこと。
```

小さなCSS調整や一時的な作業メモは入れません。

---

## Source-of-truth priority

矛盾した場合の基本順位:

1. 現在の `main` のコード / merged PR
2. `DECISION_LOG.md` の明示的なオーナー判断
3. `AI_HANDOFF.md`
4. 過去チャット / AIの記憶

人物事実や外部情報が現在の一次情報と衝突した場合は、自動で書き換えず、オーナーへ確認します。

---

## 新しいAI / 新しいチャットを開始するとき

最初の依頼は短くてよいです。

```text
GitHubの対象repoを開いて、
AGENTS.md → docs/AI_HANDOFF.md → docs/DECISION_LOG.md
の順に読んでください。
現在地点を把握してから、このプロジェクトの続きとして対応してください。
```

そのAIがGitHubへアクセスできない場合だけ、該当ファイル本文を渡します。

---

## Phase完了時の「SAVE」手順

大きな作業が終わったら、コードmergeだけで終了しません。

1. PR / merge結果を確認
2. `AI_HANDOFF.md` を最新状態へ更新
3. 長期判断が増えた場合だけ `DECISION_LOG.md` を追記
4. staleになった説明を削除または「過去」と明示
5. private情報が入っていないか確認
6. docs変更もbranch → PR → CI → review → merge

つまり基本単位は:

```text
実装 → PR → review → merge → Project Memory SAVE
```

---

## 複数AIの分業ルール

同じbranch・同じファイルを複数AIへ並行編集させないことを優先します。

役割は重複させず、例として:

- 調査AI: 公開一次情報の事実監査。READ ONLY
- 実装AI: UI / code変更
- 統合AI: diff / CI / review / merge判断

各AIは、自分の担当外の変更を「ついでに」行わないようscopeを明示します。

---

## Privacy / Safety boundary

特にpublic repositoryでは以下を保存しません。

- 個人的なDM・私信
- 恋愛・人間関係の推測
- 住所・電話番号・私的連絡先
- 家族など非公開プロフィール
- token / credential / secret
- API key
- プロジェクトに不要なユーザー個人情報
- AIの非公開な内部推論

人物情報は公開情報またはオーナーが掲載を明示確認した情報に限定し、不明値を推測で補完しません。

---

## Review checklist

Project Memoryを更新したAIは、最低限次を確認します。

- [ ] 新しいAIが過去チャットなしで現在地点を説明できる
- [ ] 現在状態と過去判断が分離されている
- [ ] merged済み / 未mergeが明確
- [ ] URL / repo / branch / PR番号が古くない
- [ ] 未確認事項を事実として断定していない
- [ ] public repoに私的情報が入っていない
- [ ] 「勝手に戻してほしくない判断」がDecision Logにある
- [ ] 次の作業候補が明確

---

## 応援アーカイブでの現在の適用

このrepoでは既に以下をProject Memoryとして運用しています。

- `AGENTS.md`
- `docs/AI_HANDOFF.md`
- `docs/DECISION_LOG.md`

今後このプロジェクトに参加するAIは、必ずこれらを読んでから作業してください。

このスキル自体は他repoへもコピーして再利用できます。
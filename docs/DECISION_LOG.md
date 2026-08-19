# DECISION LOG — 応援アーカイブ

この文書は「なぜ今の形になっているか」を残す長期判断ログです。

- `AI_HANDOFF.md` = 現在の状態
- `DECISION_LOG.md` = 重要判断とその理由

小さなCSS調整や一時的な作業メモはここに書かず、今後のAIが誤ってひっくり返しそうな判断だけを残します。

---

## 2026-08-18 — 5人は固定順・同等weightで扱う

**Decision**

人物順は以下で固定する。

`mily → yukako → riri → chizuru → mako`

**Reason**

これはUI上の固定順で、人気・優先度・序列を意味しない。5人の人物カードは同等weightで扱う。

**Do not**

- engagementや推測した重要度で勝手に並べ替えない
- 誰かだけカードを過度に大きくしない

---

## 2026-08-18〜19 — Portal Feedはchild SSOTをサーバー側で安全に集約する

**Decision**

親は5つのchild feedをサーバー側で取得し、shared schemaとorigin整合を検証する。個別feed失敗でページ全体を落とさない。

**Reason**

各個人サイトをSSOTとして保ち、親にデータを重複手入力しすぎないため。障害時も残りの人物カードやfeedを表示できるようにするため。

**Related**

- Parent PR #2: https://github.com/ackey1007fw-coder/ouen-archive/pull/2

**Do not**

- profile作業のついでにPortal Feed contractを独自拡張しない
- 外部source URLとchild site item URLを混同しない

---

## 2026-08-19 — Mily realtimeは「予定」ではなくverified状態だけをlive扱いする

**Decision**

「配信中」「放送中」はfreshなverified状態がある場合だけ表示する。scheduled / stale / unknownをliveに昇格させない。

**Reason**

誤った「配信中」「放送中」はユーザー体験と本人情報の信頼性を損なうため。

**Related**

- Parent PR #3: https://github.com/ackey1007fw-coder/ouen-archive/pull/3

**Do not**

- scheduleだけで「配信中」にしない
- stale cacheのlive表示を残さない

---

## 2026-08-19 — Creator profileはbottom-onlyで人物カードより弱くする

**Decision**

制作者mini profileはLATESTの後・Footerの前に置き、5人の人物カードより明確にvisual priorityを下げる。

**Reason**

ポータルの主役は5人であり、制作者を「6人目の人物カード」のように見せないため。

**Related**

- Parent PR #4: https://github.com/ackey1007fw-coder/ouen-archive/pull/4

---

## 2026-08-19 — Child sitesから親へ戻るcanonical URLは564cを使う

**Decision**

子サイトFooterの戻り導線は以下へ統一する。

`https://ouen-archive-564c.vercel.app/`

**Reason**

親repoのrepository metadata homepageとGitHub Deployments historyを基礎に、`564c` familyをproject canonicalとして採用した。`oy4i`のような別Vercel URLが存在・表示されても、それだけでcanonicalを変更しない。

**Known limitation at decision time**

当時の作業環境では `*.vercel.app` の直接HTTP確認やVercel alias APIの完全確認に制約があった。したがって、将来Vercel側の正式alias設定を一次情報で確認できた場合は再評価してよい。ただし確認なしの自動置換は禁止。

**Related child PRs**

- Mily #36: https://github.com/ackey1007fw-coder/mily-fan-site/pull/36
- Yukako #179: https://github.com/ackey1007fw-coder/yukako-schedule-2026/pull/179
- Riri #83: https://github.com/ackey1007fw-coder/riri-schedule-2026/pull/83
- Chizuru #11: https://github.com/ackey1007fw-coder/chizuru-ito-archive/pull/11
- Mako #5: https://github.com/ackey1007fw-coder/mako-schedule-2026/pull/5

**Do not**

- screenshotに別deployment URLが見えた、という理由だけでchild hrefを変えない
- preview URLをcanonicalにしない

---

## 2026-08-19 — 人物カードは「サイトへのリンク」だけでなくプロフィール入口にする

**Decision**

カード全体 `<a>` をやめ、`<article>` 内に次を分離する。

- 人物情報
- `<details><summary>` のPROFILE
- 独立した「応援サイトへ」CTA

各人物は `headline / bio / facts 4 / tags 4` で情報密度を揃える。

**Reason**

親ポータルを「どのサイトへ行くか」だけでなく、「この人はどんな人かを知る入口」にするため。スマホで長文化しすぎないよう必要時だけ展開する。

**Related**

- Parent PR #5: https://github.com/ackey1007fw-coder/ouen-archive/pull/5
- merge commit: `d8aa7e8ca98e09b0618872e309d83e1d75dd0816`

---

## 2026-08-19 — 年齢ではなく誕生日を保存する

**Decision**

5人全員のprofile先頭factを「誕生日」にする。年齢は保存しない。

**Reason**

年齢は毎年陳腐化するため。誕生日のほうが長期運用しやすい。

**Current values**

- 三橋莉子: 2005年8月2日
- 吉井優花子: 1997年4月27日
- 夏凪里季: 2006年6月24日
- 伊東千鶴: 2005年3月12日
- MAKO: 4月6日

**Do not**

MAKOの生年は公開一次情報で確認できていないため、推測で補完しない。

---

## 2026-08-20 — 吉井優花子の血液型はAB型を維持する

**Decision**

吉井優花子のprofile factとして `血液型: AB型` を維持する。

**Context**

公開一次情報の再監査では、現在アクセスできる本人SNS / SHOWROOM / CLOUDCASTING / Miss Grand Japan関連公開ページなどから血液型を再発見できなかった。一度は安全側で削除したが、プロジェクトオーナーが「優花子はAB型で間違いない」と明示確認したため復帰した。

**Reason**

「今の一次ページに載っていない」ことと「事実ではない」ことは同義ではない。明示的なオーナー確認を尊重する。

**Do not**

- 一次ソースで現在見つからないという理由だけで自動削除しない
- 逆に、公式一次情報で明確な矛盾が出た場合は勝手に維持せずオーナー確認へ

---

## 2026-08-20 — 吉井優花子bioの弱い年次断定は落とす

**Decision**

bioは「秋田で公務員として働いた後、上京して俳優活動を本格化…」とし、`2022年に退職` の年次断定は入れない。

**Reason**

公務員経験・上京・俳優活動は確認できるが、「2022年退職」の現在参照できる一次根拠が弱かったため。

---

## 2026-08-20 — AI分業は「事実 / UI / 統合」を分ける

**Decision**

基本形:

- Grok / web research: 公開事実監査（READ ONLY）
- Claude Code: UI / UX / responsive監査・最小修正
- ChatGPT: 横断設計・diff/CI/review最終統合・オーナー指示下でmerge

**Reason**

同じファイルを複数AIが同時編集する衝突を避け、監査と実装を分離できたため。

**Do not**

複数AIに同じbranchの同じファイルを並行編集させない。

---

## 2026-08-20 — GitHubをAIチームの共有記憶にする

**Decision**

- `AGENTS.md` からproject memoryを必読にする
- `docs/AI_HANDOFF.md` を現在状態のSSOTとして運用する
- `docs/DECISION_LOG.md` に長期判断理由を残す

**Reason**

新しいChatGPTチャット、Claude Code、Codex、Grok等が過去会話を持っていなくても、repositoryだけで安全に再開できるようにするため。

**Privacy boundary**

repositoryは公開。個人的なDM、恋愛・人間関係の推測、住所、連絡先、家族情報、credential、token等はproject memoryへ書かない。

# AI HANDOFF — 応援アーカイブ

Last updated: 2026-08-20 JST

この文書は、ChatGPT / Claude Code / Codex / Grok など別のAIや別チャットが、過去の会話を読めなくても現在地点から作業を再開できるようにするための「現在のセーブデータ」です。

> このrepositoryは公開です。個人的なDM、恋愛・人間関係の推測、住所、連絡先、家族情報、資格情報、トークンなど、プロジェクトに不要な私的情報は絶対に記録しないでください。

## 0. 最初に読む順番

1. `AGENTS.md`
2. `docs/AI_HANDOFF.md`（この文書）
3. `docs/DECISION_LOG.md`
4. 実際に変更するコード / テスト
5. 必要に応じて関連PRと子repository

矛盾した場合は、原則として **現在の `main` のコードとmerged PR > 明示的なオーナー判断を記録した `DECISION_LOG.md` > このhandoff > 過去チャットの記憶** の順で扱います。人物事実について現在の公式一次情報と記録が衝突する場合は、勝手に上書きせずオーナーへ確認してください。

---

## 1. プロジェクト概要

「応援アーカイブ」は、5つの個人応援サイトをつなぐファン制作の非公式ポータルです。

Parent repo:
- `ackey1007fw-coder/ouen-archive`
- project canonicalとして採用中: `https://ouen-archive-564c.vercel.app/`

固定の人物順:
1. `mily` — 三橋莉子（みりぃ）
2. `yukako` — 吉井優花子
3. `riri` — 夏凪里季
4. `chizuru` — 伊東千鶴
5. `mako` — MAKO / まこ

この順序は人気順・序列ではありません。UI上の固定順です。

### Child sites

| personId | repo | production/site URL |
| --- | --- | --- |
| `mily` | `ackey1007fw-coder/mily-fan-site` | `https://mily-fan-site.vercel.app/` |
| `yukako` | `ackey1007fw-coder/yukako-schedule-2026` | `https://yukako-schedule-2026.vercel.app/` |
| `riri` | `ackey1007fw-coder/riri-schedule-2026` | `https://riri-schedule-2026.vercel.app/` |
| `chizuru` | `ackey1007fw-coder/chizuru-ito-archive` | `https://chizuru-ito-archive.tasty-mite-7025.chatgpt.site/` |
| `mako` | `ackey1007fw-coder/mako-schedule-2026` | `https://mako-schedule-2026.vercel.app/` |

ChizuruだけはChatGPT Sites系の公開先です。GitHub変更とSitesへの同期・production publishを同一視しないでください。

---

## 2. 現在の親ポータル構成

ParentはNext.js App Router / TypeScript / pnpmで構成されています。主要な現在機能:

- 5人の人物カード
- 5つのPortal Feedをサーバー側で集約
- `TODAY`
- `LATEST UPDATES`
- Mily verified realtime banner
- 制作者の控えめなmini profile
- 5人それぞれの展開式PROFILE
- PROFILE内の `LINKS｜SNS・配信`（本人SNS / SHOWROOM / MixChannel / ラジオ等への直接導線）
- PROFILE内の `SUPPORT｜応援・投票`（該当人物のみ表示。現在はMilyのみ）
- 4人のポートレートを使ったOGPシェア画像（`src/app/opengraph-image.tsx`）

親ポータルのPROFILEを開けば、応援サイトを経由せずに本人のSNS・配信・ラジオへ移動でき、Milyについては MISS CIRCLE 2026 公式ENTRYからそのまま応援へ進めます。

### Portal Feed

`src/lib/feed-schema.ts` のshared contractを利用します。

- personId: `mily | yukako | riri | chizuru | mako`
- item type: `news | story | schedule | event | update`
- URL / datetime / personId / origin整合を検証
- child feedの失敗は相互に隔離し、ページ全体を落とさない

親でプロフィールを触るついでにPortal Feed schema / fetchロジックを変更しないでください。

### Mily realtime

PR #3でverified realtime統合済み。

優先順位:
1. verified SHOWROOM live
2. verified radio on-air
3. 当日これからのschedule
4. 何もなければ非表示

予定があるだけで「配信中」「放送中」にしないこと。stale状態をlive扱いしないこと。

---

## 3. 2026-08-18〜20 に実施した主要作業

### Parent portal

- PR #1 — MVPを構築
  - https://github.com/ackey1007fw-coder/ouen-archive/pull/1
- PR #2 — 5つのPortal Feedを統合、TODAY / LATEST実装
  - https://github.com/ackey1007fw-coder/ouen-archive/pull/2
- PR #3 — Mily verified realtime統合
  - https://github.com/ackey1007fw-coder/ouen-archive/pull/3
- PR #4 — bottom-only creator mini profile
  - https://github.com/ackey1007fw-coder/ouen-archive/pull/4
- PR #5 — 5人の展開式プロフィールを人物カードへ追加
  - https://github.com/ackey1007fw-coder/ouen-archive/pull/5
  - squash merge commit: `d8aa7e8ca98e09b0618872e309d83e1d75dd0816`
- PR #8 — PROFILE内にLINKS｜SNS・配信 / SUPPORT｜応援・投票を追加
  - https://github.com/ackey1007fw-coder/ouen-archive/pull/8

### Child → Parent の戻り導線

5サイトすべてに以下の導線を追加・merge済みです。

- 表示: `← 応援アーカイブへ戻る`
- 補助文: `5つの応援サイトをつなぐ非公式ポータル`
- href: `https://ouen-archive-564c.vercel.app/`
- same-tab（`target="_blank"` なし）
- 44px程度のtap target
- 色だけに依存しないリンク表現

Merged PRs:
- Mily #36 — https://github.com/ackey1007fw-coder/mily-fan-site/pull/36
- Yukako #179 — https://github.com/ackey1007fw-coder/yukako-schedule-2026/pull/179
- Riri #83 — https://github.com/ackey1007fw-coder/riri-schedule-2026/pull/83
- Chizuru #11 — https://github.com/ackey1007fw-coder/chizuru-ito-archive/pull/11
- Mako #5 — https://github.com/ackey1007fw-coder/mako-schedule-2026/pull/5

Chizuru #11は最小変更として **トップページFooterのみ** に戻り導線を追加しています。記事ページFooterへの展開は未実施です。

---

## 4. 現在の人物PROFILE仕様

`src/data/persons.ts` が親ポータルの人物カード用SSOTです。

各人物:
- `headline`
- `bio`
- `facts` 4件
- `tags` 4件
- `links`（SNS・配信・番組公式ページ）
- `supportLinks`（応援・投票導線。0件可）

UI:
- card outer: `<article>`
- `PROFILE｜プロフィールを見る` は `<details><summary>`
- `LINKS｜SNS・配信` と `SUPPORT｜応援・投票` はいずれも `<details>` 内部
- `応援サイトへ` は独立したCTA
- JSなしで開閉可能
- 44px相当のtap target / focus-visible
- 5人の情報密度を揃える

PROFILEを開いたカードだけが伸び、同じ行の閉じたカードが不自然に引き伸ばされないよう、`.person-grid { align-items: start; }` を使用し、cardの固定 `height: 100%` は外しています。

### 誕生日

全員の `facts[0]` は「誕生日」です。年齢は保存しません。

| Person | 掲載値 |
| --- | --- |
| 三橋莉子 | `2005年8月2日` |
| 吉井優花子 | `1997年4月27日` |
| 夏凪里季 | `2006年6月24日` |
| 伊東千鶴 | `2005年3月12日` |
| MAKO | `4月6日` |

MAKOは公開一次情報で生年を確認できていません。**生年を推測して追加しないでください。**

### LINKS / SUPPORT の掲載方針

- CONFIRMEDな公開リンクだけを掲載する
- 人物ごとのリンク数は揃えない（現在 mily 7 / yukako 5 / riri 5 / chizuru 2 / mako 2）
- 件数を揃えるために未確認URLを推測・補完しない
- MAKOのX / SHOWROOMは、子サイトの既存公開方針に合わせて親ポータルでも非掲載
- MilyはFM湘南マジックウェイブのスタッフページと湘南シーサイドサークル番組ページの2本を掲載
- MilyのSHOWROOMは安定した `room_id` URLで保存する（コンテストslugを使わない）
- SUPPORTは現在Milyのみ1件。MISS CIRCLE 2026 公式ENTRY（`https://2026.misscircle.jp/entry/734`）
- SUPPORTラベルは `MISS CIRCLE 2026｜公式プロフィール・投票`。「投票受付中」等の期限依存表現は静的UIへ書かない
- 外部リンクは `target="_blank"` + `rel="noopener noreferrer"`。`応援サイトへ` CTAは従来どおり同一タブ

### 現在のprofile要点

#### 三橋莉子 / みりぃ
- 誕生日: 2005年8月2日
- 出身: 神奈川県
- 大学: 日本大学 3年（時点情報）
- 特技: 篠笛
- tags: ラジオ / SHOWROOM / 英会話 / ENFP

#### 吉井優花子
- 誕生日: 1997年4月27日
- 出身: 秋田県秋田市
- 身長: 161cm
- 血液型: **AB型**
- tags: スポーツ / 歌唱 / 料理 / 写真撮影

重要: 公開一次ソース監査では現在AB型を再発見できませんでしたが、プロジェクトオーナーが「AB型で間違いない」と明示確認しています。**一次ソースで今見つからない、という理由だけで自動削除しないこと。** 公式情報と明確に矛盾する新証拠が出た場合はオーナー確認へ。

bioは `2022年に退職` のような弱い年次断定を避け、現在は「秋田で公務員として働いた後、上京して俳優活動を本格化…」としています。

#### 夏凪里季
- 誕生日: 2006年6月24日
- 出身: 三重県生まれ、神奈川県育ち
- 大学: 青山学院大学 2年（時点情報）
- 身長: 163cm
- tags: 数独 / 映画鑑賞 / スポーツ / お菓子作り

#### 伊東千鶴
- 誕生日: 2005年3月12日
- 学び: 上智大学 総合人間科学部 社会福祉学科
- 身長: 172cm
- 受賞: Sophian’s Contest 2024 準グランプリ
- tags: 社会福祉 / トーク / モデル / ボランティア

#### MAKO / まこ
- 誕生日: 4月6日（生年は推測禁止）
- 故郷: 鹿児島県 徳之島
- 現在: 和歌山県
- 身長: 161cm
- tags: 料理 / 旅行 / ウォーキング / ヨガ

---

## 4-2. OGPシェア画像

`src/app/opengraph-image.tsx` がNext.js App Routerのfile-based metadata規約で `1200x630` のPNGを生成します。`layout.tsx` 側に `openGraph.images` を手書きする必要はありません（Nextが `og:image` / `twitter:image` / alt / 寸法を自動注入します）。

構成:

- 上段 420px … 4人のポートレートを横並び（`mily 360 / yukako 290 / riri 280 / chizuru 270`）
- 中央 6px … コーラル＋グリーンのアクセントルール
- 下段 204px … 濃色バンドに `応援アーカイブ`（86px）と `夢と活動の記録` / `FAN-MADE SUPPORT PORTAL`

掲載人物・タイル幅・キャンバス寸法は `src/lib/og-portraits.ts` がSSOTで、`src/lib/og-portraits.test.ts` が回帰テストしています。MAKOをシェア画像へ入れない判断の理由は `docs/DECISION_LOG.md`（2026-08-20）を参照してください。**ポータル本体の人物カードは従来どおり5人・固定順・同等weightのままです。**

素材は `assets/og-portraits/*.jpg`。`public/portraits/` の既存ポートレートを顔位置に合わせてトリミングしただけの派生ファイルで、元ファイルは変更していません。`ImageResponse` は `public/` を読めないため、ビルド時に `fs` で読んでdata URIとして埋め込みます。

注意:

- `ImageResponse` のバンドル上限は500KB（画像込み）。ポートレートを差し替えるときは合計サイズを確認する
- 既定フォールバックフォントに日本語boldが無いため `fontWeight: 700` は効かない。視認性は文字サイズで担保する
- 顔のAI生成・合成・レタッチはしない。トリミングのみ

---

## 5. AI分業の基本形

今回うまく機能した分業です。絶対ルールではありませんが、今後の基本形として扱います。

### Grok / Web research role
- 公開プロフィール・一次情報の事実監査
- 原則READ ONLY
- 推測で補完しない

### Claude Code role
- UI / UX / responsive / implementation polish
- 390 / 430 / 1280pxを中心に確認
- 問題がなければ変更しない
- 変更する場合も最小diff

### ChatGPT role
- 横断設計
- diff / CI / review状態の最終確認
- 複数AIの結果を統合
- オーナー指示があればReady / squash merge

重要: 複数AIに同じbranchの同じファイルを同時編集させないこと。事実監査と実装を分けると安全です。

---

## 6. 人物情報のルール

- 公開情報またはオーナーが明示確認した情報だけを扱う
- 不明な生年・所属・関係性を推測しない
- 年齢より誕生日を保存する
- 大学の「○年」は時点情報。年度更新時に再確認
- MBTI等は本人公表があっても変わりうる時点情報として扱う
- 恋愛関係、DM内容、私的な人間関係の解釈をrepoへ保存しない
- 「公式」「公認」「本人運営」と誤認させない
- 5人のUI上の扱い・情報量を極力公平にする

---

## 7. Repository / deployment運用

- 原則branch → PR → CI → review → merge
- 可能ならsquash merge
- 人物事実の変更、サイトidentity変更、大きいlayout変更は、オーナー確認を挟む
- child repoを監査目的で読む場合はREAD ONLYを基本とする
- ChizuruはGitHub mergeとChatGPT Sites production publishを分けて考える
- production URL / canonicalを勝手に変更しない

### canonical注意

現在採用している親URLは:
`https://ouen-archive-564c.vercel.app/`

別のVercel URL（例: `ouen-archive-oy4i.vercel.app`）を画面で見ても、それだけでcanonicalを変更しないでください。判断経緯は `docs/DECISION_LOG.md` を参照してください。

---

## 8. 現在の未完了 / 次の確認候補

1. PR #5 merge後のparent productionで、5人のPROFILE開閉が実際に反映されているか確認
2. canonical `564c` から最新mainが見えることを確認
3. Chizuruの記事ページFooterにも親ポータル戻り導線を出すかは未決定
4. 新年度にMily / Ririの大学学年を再確認
5. 大きなphaseをmergeしたら、この `AI_HANDOFF.md` を更新する
6. OGP差し替えをmerge後、本番URLでX / Slack等のカードキャッシュが更新されたか確認する

このリストは完了したら更新・削除してください。

---

## 9. Handoff更新ルール

大きな実装・重要判断・production URL変更・人物SSOT変更があったら:

1. コードPRを作る
2. 必要なら同じPRまたは直後のdocs PRで `AI_HANDOFF.md` を更新
3. 長期判断なら `DECISION_LOG.md` に追記
4. 「今の状態」と「判断理由」を混同しない

`AI_HANDOFF.md` は現在状態、`DECISION_LOG.md` は履歴と理由です。

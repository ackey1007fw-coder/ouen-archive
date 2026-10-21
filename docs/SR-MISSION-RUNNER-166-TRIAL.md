# SHOWROOM Mission Runner v1.6.6 — iPhone試用手順

2026-10-10確認。端末記録10/20件で、公式トップに見えている配信がすべて記録済みの場合に、開始ボタンが無効になる問題への修正です。

## 試用版とmain

| 対象 | 状態 |
| --- | --- |
| v1.6.6 | PR #20の試用版。main未統合。実機受入前 |
| v1.6.5 | 親PR #17。main未統合。今回の問題が残る旧試用版 |
| main | SR v1.0.2（merged PR #13）。v1.6.6の配布元ではない |
| 配布ページ | branchのPreviewとproductionを区別。表示番号だけでmain統合済みとは判断しない |

確認済みのスクリプト内容を固定した試用URL:

https://raw.githubusercontent.com/ackey1007fw-coder/ouen-archive/c53ae30086439719e7f2209d8317eb076415ced9/SR-Mission-Runner-Mobile.user.js

SHA-256: `8a34a9391766def781b76f27e3ca7c0c414223fd96721f6702e40c47470f5b80`

branch URLは後から内容が変わり得ます。再現確認には上のcommit固定URLを使います。以後の説明・テスト・配布ページ変更で、v1.6.6のUserscript本体は変更していません。

## 記録を保持して更新する

1. 同じiPhone・同じUserscriptsを使います。SHOWROOMの巡回を一時停止し、現在の版番号、10/20件、時間帯、取得未確認の視聴記録を控えます。複数のSHOWROOMタブで同時に巡回しないでください。
2. Userscriptsの保存先にある既存ファイルの名前を確認します。通常のInstallで作られる名前は `SR Mission Runner Mobile.user.js`。`@name` は `SR Mission Runner Mobile` のままです。必要なら元のスクリプトを保存先とは別のフォルダへコピーします。**スクリプトのコピーはコードの控えであり、件数・履歴データのバックアップではありません。**
3. 上の固定URLを**Safari**で開きます。コードが表示されるだけでは更新されません。Safariのページメニュー／拡張機能から **Userscripts** を開き、**Tap to re-install** → 確認画面の **Install** を選びます。同じ既存スクリプトへの上書きです。
4. Userscriptsのポップアップを一度開いて読み込み完了を待ち、SHOWROOMページを再読み込みします。パネルの **v1.6.6** と同じ時間帯の **10/20件** を確認します。Userscriptsで当該スクリプトが有効、SHOWROOMでの実行が許可されていることも確認します。
5. 公式トップで **「この一覧の未記録0ルーム」→「オンライブ一覧を開く ▶」** を押します。`/onlive` に移り、10/20件のまま未記録候補を読めることを確認します。候補があれば「残り10件を続ける」で次の未記録配信へ進みます。

既存ファイル名が上の標準名と異なる場合は、通常のre-installで同じ保存領域を引き継げるとは断定できません。別名の新規スクリプトを追加せず、既存の**実際のファイル名を維持して内容だけ上書き**する方法を使います。重複ファイルがある場合も、新旧を同時に有効化しないでください。

更新のために「この枠の件数をリセット」、スクリプトの削除、Userscriptsアプリの削除・再インストール、保存先変更、ファイル名変更、Safari／拡張のデータ消去を行う必要はありません。

日本時間03:00／15:00をまたぐと、新しい枠の件数へ切り替わります。そこで0件になったことと、更新で履歴が失われたことは別です。除外履歴と確認台帳は別キーに保持します。

### 保持を確認した範囲

- Userscriptの `@name`、`@namespace`、`srmr_progress_v3` の保存キーを維持。
- 現在枠の完了記録、記録調整値、配信除外履歴、取得確認台帳、あとで見る、秒数・目標・自動ON/OFF設定を保持。
- Userscriptsの公式release/4.x.x実装では、GMデータを `US_filename---key` で保存。インストーラーは `@name` から保存ファイル名を生成します。この実装を根拠に、同じファイル名を保つ手順としています。利用中のiPhoneアプリ版そのものの内部動作は未取得です。
- 端末記録は公式の達成・報酬受取の証明ではありません。画面の「10/20」が公式連動表示の場合と、端末記録の場合も区別します。

一次資料:

- [Userscripts公式導入手順](https://github.com/quoid/userscripts#ios-ipados)
- [GM保存の実装](https://github.com/quoid/userscripts/blob/06900223459036d2a238d93ab1af4d9f26cadbc7/src/ext/content-scripts/api.js)
- [installCheck / installUserscript / saveFile](https://github.com/quoid/userscripts/blob/06900223459036d2a238d93ab1af4d9f26cadbc7/xcode/Ext-Safari/Functions.swift)

## この作業で実行した検証

架空の公式カードDOM・GMストレージを使い、外部通信をfixture応答に置き換えた検証です。ログイン済み公式SHOWROOMやiPhone実機を操作した結果ではありません。

| ケース | Chromium 153（390 / 430 / 1280px） |
| --- | --- |
| 配信カード0件のトップ→/onlive、18/20保持 | 成功 |
| 実記録10件・除外履歴16件のトップで未記録0→/onlive→次の未記録配信 | 成功 |
| 同じ移動で完了10件・調整0・履歴16件・台帳10件・お気に入り・設定を保持 | 成功 |
| /onliveもカード0件なら停止 | 成功 |
| /onliveも全候補記録済みなら停止・更新／ジャンル切替を案内 | 成功 |
| 20/20達成済みのトップは開始不可 | 成功 |
| 記録済み配信から次の未記録へ1タップ、広告ページのSafariログイン案内 | 成功 |

合計7ケース×3幅＝21ケース。ホームのパネルで横overflowなし。旧v1.6.5は同じ10/20・16件除外のfixtureで開始不可となり失敗、v1.6.6は成功しました。

`tools/watch-runners-safari-robust.browser.mjs` に回帰を保存。`RUNNER_TEST_WIDTH`、`RUNNER_SCRIPT_FILE`、`RUNNER_TEST_ARTIFACTS` で幅・旧版比較・スクリーンショットとJSON出力を指定できます。

- 元head `c53ae30086439719e7f2209d8317eb076415ced9` の [CI #38046338892](https://github.com/ackey1007fw-coder/ouen-archive/actions/runs/38046338892) は成功。Lint / Typecheck / Test / Buildを確認。
- ローカルlintはerror 0・既存warning 5、typecheck、138 unit tests、production build成功。`pnpm test` のtsx CLIはこの環境のIPC制限で起動失敗したため、同じ対象を `node --import tsx --test 'src/**/*.test.ts' 'src/**/*.test.tsx'` で実行しました。
- このブラウザー回帰は現行CIの実行対象に入っていません。ローカル実行結果とCI結果を分けて扱います。PRを更新した場合は更新後headのCIも確認します。
- WebKitはバイナリ取得後、必要な共有ライブラリが不足し起動不可。依存導入も環境制限で失敗したため、今回のWebKit実行成功は報告しません。

## 実機で残る確認

1. 同名上書き後のv1.6.6表示と、同じ枠の10/20件・履歴・設定保持。
2. 現行公式DOMからトップ→/onlive→未記録配信へ実際に進めること。/onliveも候補0件なら停止するのが正常です。
3. iPhone Safariの公式プレイヤーで実再生時間が進むこと。ミュート再生・AbortErrorの復帰は別の未検証事項です。
4. 公式のミッション達成・報酬受取は本人が公式画面で確認。端末の時間到達記録だけから「取得成功」と判定しません。

## 統合・配布へ進む順番

依存関係は **main ← #14 ← #16 ← #17 ← #20**。#20を直接mainへ向けると親の未マージ機能もまとめて差分に入ります。

1. #20の現行headのCI・差分レビューを確認し、実機の試用結果を残します。
2. 必要なレビューと実機受入が済んだら、既存#20を#17のbranchへ統合します。新しい重複PRを作りません。
3. 親PRもbase更新後のcurrent-head CI・競合・レビューを再確認し、#17→#16→#14→mainの順に既存PRで統合します。古いheadの成功を流用しません。
4. mainでv1.6.6のファイルと配布ページが一致していることを確認し、productionのinstallerがデプロイcommitの同じ内容を指すことを確認してから、本番反映済みと報告します。

現時点は実機受入待ち。PR #20・#17をDraftのまま維持し、main／productionの更新を完了扱いにしません。

不具合が増えた場合は、同じファイル名への上書きで [v1.6.5固定版](https://raw.githubusercontent.com/ackey1007fw-coder/ouen-archive/c900dd2f152615c69248611e629e6503bf1204f3/SR-Mission-Runner-Mobile.user.js) へ戻せます。候補0件の問題も戻ります。mainのv1.0.2は保存形式が違うため、今回の試用の戻し先として案内しません。

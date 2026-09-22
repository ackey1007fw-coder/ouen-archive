import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

const repo = "ackey1007fw-coder/ouen-archive";
const releaseRef = process.env.VERCEL_GIT_COMMIT_SHA ?? "main";
const rawBase = `https://raw.githubusercontent.com/${repo}/${releaseRef}`;
const srInstaller = `${rawBase}/SR-Mission-Runner-Mobile.user.js`;
const mixchInstaller = `${rawBase}/Mixch-Watch-Helper-Mobile.user.js`;

export const metadata: Metadata = {
  title: "Mission Runner｜iPhone Safari向け配信視聴補助ツール",
  description:
    "SHOWROOMとミクチャの視聴を、手動の次へ操作で進めやすくするiPhone Safari向け非公式Userscript。",
  openGraph: {
    title: "Mission Runner｜配信視聴を、もっと軽やかに。",
    description:
      "SHOWROOM / ミクチャ向け。視聴時間の目安、途中再開、取得済み除外などをまとめた非公式の手動補助ツール。",
    type: "website",
  },
};

const features = [
  ["⏱️", "再生中だけカウント", "画面を見ていて、映像や音声が進んでいる時間だけを計測。"],
  ["🧠", "途中から再開", "時間帯ごとの件数と途中経過を端末内に記録します。"],
  ["🚫", "取得済みを候補外へ", "一度記録した配信を、同じ巡回で何度も開きにくくします。"],
  ["♡", "フォロー画面へ", "気になった配信者は公式プロフィールを別タブで開けます。"],
  ["📺", "広告は別タブ", "SHOWROOMの広告ページを別タブで開き、戻ると計測を自動再開。"],
  ["🔗", "公式回数との連動", "対応できる公式進捗を、明示的にONにしたときだけ読み取ります。"],
] as const;

export default function MissionRunnerPage() {
  return (
    <main className={styles.page} id="main-content">
      <section className={styles.hero}>
        <p className={styles.kicker}>PUBLIC BETA / UNOFFICIAL</p>
        <div className={styles.mark} aria-hidden="true">🚀</div>
        <h1>Mission Runner</h1>
        <p className={styles.lead}>
          配信ミッションの「30秒ずつ見る」を、<strong>自分で見ながら1タップずつ</strong>
          進めやすくするiPhone Safari向けの補助ツールです。
        </p>
        <div className={styles.badges} aria-label="対応状況">
          <span>iPhone / iPad</span>
          <span>Safari + Userscripts</span>
          <span>端末内保存</span>
        </div>
        <div className={styles.actions}>
          <a className={styles.primary} href={srInstaller}>
            🚀 SHOWROOM版をインストール
            <small>v1.4.3</small>
          </a>
          <a className={styles.secondary} href={mixchInstaller}>
            🎬 ミクチャ版をインストール
            <small>v0.3.3 β</small>
          </a>
        </div>
        <p className={styles.installNote}>
          リンクはSafariで開き、Userscriptsの拡張画面から Install / re-install してください。
        </p>
      </section>

      <section className={styles.section} aria-labelledby="features-title">
        <p className={styles.sectionKicker}>WHAT IT DOES</p>
        <h2 id="features-title">面倒なところだけ、軽くする。</h2>
        <div className={styles.grid}>
          {features.map(([icon, title, text]) => (
            <article className={styles.card} key={title}>
              <span className={styles.cardIcon} aria-hidden="true">{icon}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="setup-title">
        <p className={styles.sectionKicker}>SETUP</p>
        <h2 id="setup-title">iPhoneなら、3ステップ。</h2>
        <ol className={styles.steps}>
          <li>
            <strong>Userscriptsを入れる</strong>
            <span>App Storeから無料のSafari拡張「Userscripts」をインストール。</span>
          </li>
          <li>
            <strong>Safari拡張を有効にする</strong>
            <span>SafariでUserscriptsをONにして、対象サイトへのアクセスを許可。</span>
          </li>
          <li>
            <strong>上のインストールボタンをSafariで開く</strong>
            <span>UserscriptsのポップアップからInstall。更新時はre-installでOKです。</span>
          </li>
        </ol>
        <a className={styles.textLink} href="https://apps.apple.com/jp/app/userscripts/id1463298887" target="_blank" rel="noreferrer">
          UserscriptsをApp Storeで開く ↗
        </a>
      </section>

      <section className={styles.section} aria-labelledby="use-title">
        <p className={styles.sectionKicker}>HOW TO USE</p>
        <h2 id="use-title">使い方は、見て、待って、次へ。</h2>
        <div className={styles.flow}>
          <span>配信一覧を開く</span><b>→</b><span>開始</span><b>→</b><span>30〜35秒見る</span><b>→</b><span>次へ</span>
        </div>
        <p className={styles.bodyCopy}>
          自動で配信を巡回したり、報酬を受け取ったりはしません。
          「次へ」「フォロー」「広告を見る」などの操作は、必ず自分で行います。
        </p>
      </section>

      <section className={styles.section} aria-labelledby="privacy-title">
        <p className={styles.sectionKicker}>PRIVACY & LIMITS</p>
        <h2 id="privacy-title">こっそり動くものは、入れていません。</h2>
        <ul className={styles.points}>
          <li>パスワードやCookieを保存しません。</li>
          <li>進捗・お気に入り・取得済み記録はUserscriptsの端末内領域に保存します。</li>
          <li>SHOWROOMの公式進捗読み取りは任意でONにした場合のみです。</li>
          <li>広告中やバックグラウンド中の時間を、配信視聴時間として加算しません。</li>
          <li>公式サービス側の仕様変更により、突然動かなくなる場合があります。</li>
        </ul>
        <div className={styles.notice}>
          <strong>非公式ツールです。</strong>
          <p>
            SHOWROOM株式会社、ミクチャ運営各社、Userscripts開発者とは無関係です。
            ミッション達成や報酬付与を保証するものではありません。各サービスの最新規約・案内を確認して利用してください。
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="status-title">
        <p className={styles.sectionKicker}>RELEASE STATUS</p>
        <h2 id="status-title">現在の公開版</h2>
        <div className={styles.releaseGrid}>
          <div>
            <strong>SHOWROOM</strong>
            <span>v1.4.3</span>
            <p>iPhone Safari向け。公開β。</p>
          </div>
          <div>
            <strong>ミクチャ</strong>
            <span>v0.3.3 β</span>
            <p>公式コイン条件は未検証のためβ扱い。</p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Mission Runner / fan-made unofficial utility</p>
        <div>
          <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer">GitHub source ↗</a>
          <Link href="/">応援アーカイブへ戻る</Link>
        </div>
      </footer>
    </main>
  );
}

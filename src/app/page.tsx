import { MilyRealtimeBanner } from "@/components/MilyRealtimeBanner";
import { PersonCard } from "@/components/PersonCard";
import { PortalFeedSections } from "@/components/PortalFeedSections";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { persons } from "@/data/persons";
import { mergePortalFeedItems } from "@/lib/feed-view";
import { fetchMilyRealtimeSnapshot } from "@/lib/mily-realtime";
import { deriveMilyRealtimeBanner } from "@/lib/mily-realtime-state";
import { fetchPortalFeeds } from "@/lib/portal-feeds";

export default async function Home() {
  const [feeds, realtime] = await Promise.all([
    fetchPortalFeeds(),
    fetchMilyRealtimeSnapshot(),
  ]);
  const feedItems = mergePortalFeedItems(feeds);
  const realtimeBanner = deriveMilyRealtimeBanner(realtime);

  return (
    <div className="page-shell">
      <SiteHeader />

      <main id="main-content">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-orbit" aria-hidden="true">
            {persons.map((person) => (
              <span key={person.id} />
            ))}
          </div>
          <div className="hero-brand">
            <p className="eyebrow">応援アーカイブ</p>
            <p className="hero-brand-subtitle">夢と活動の記録</p>
          </div>
          <h1 id="hero-title">
            <span>応援の入口を、</span>
            <span>ひとつに。</span>
          </h1>
          <p className="hero-copy">
            応援アーカイブは、5つの個人応援サイトをつなぐ
            <br className="desktop-break" />
            ファン制作の非公式ポータルです。
          </p>
          <a className="hero-link" href="#support-sites">
            5つの応援サイトを見る
            <span aria-hidden="true">↓</span>
          </a>
        </section>

        <section
          className="section-container support-section"
          id="support-sites"
          aria-labelledby="support-sites-title"
        >
          <div className="section-heading">
            <p className="eyebrow">SUPPORT SITES</p>
            <h2 id="support-sites-title">それぞれの応援サイトへ</h2>
            <p>それぞれの活動や記録へ、ここから。</p>
          </div>

          <div className="person-grid">
            {persons.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>

          <MilyRealtimeBanner banner={realtimeBanner} />
        </section>

        <PortalFeedSections items={feedItems} />
      </main>

      <SiteFooter />
    </div>
  );
}

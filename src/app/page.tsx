import { CreatorMiniProfile } from "@/components/CreatorMiniProfile";
import { PersonCard } from "@/components/PersonCard";
import { PortalFeedSections } from "@/components/PortalFeedSections";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SupportSpotlight } from "@/components/SupportSpotlight";
import { supportCampaigns } from "@/data/support-campaigns";
import { persons } from "@/data/persons";
import { mergePortalFeedItems } from "@/lib/feed-view";
import { fetchMilyRealtimeSnapshot } from "@/lib/mily-realtime";
import { deriveMilyRealtimeBanner } from "@/lib/mily-realtime-state";
import { fetchPortalFeeds } from "@/lib/portal-feeds";
import { selectSupportSpotlightItems } from "@/lib/support-spotlight";

/**
 * Request-time HTML so live / radio banners re-evaluate freshness on
 * every visit. Keep per-fetch Data Cache (live 60 / radio 180 /
 * schedule 300 / Portal Feed 300) instead of disabling fetch cache.
 */
export const revalidate = 0;

export default async function Home() {
  const [feeds, realtime] = await Promise.all([
    fetchPortalFeeds(),
    fetchMilyRealtimeSnapshot(),
  ]);
  const feedItems = mergePortalFeedItems(feeds);
  const realtimeBanner = deriveMilyRealtimeBanner(realtime);
  const now = new Date();
  const supportSpotlightItems = selectSupportSpotlightItems({
    campaigns: supportCampaigns,
    feedItems,
    now,
  });

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
            <span>“今、応援してほしい”が</span>
            <span>すぐわかる。</span>
          </h1>
          <p className="hero-copy">
            投票、舞台、配信。今できる応援と5つのファンサイトを
            <br className="desktop-break" />
            ひとつにつなぐ、ファン制作の非公式ポータルです。
          </p>
          <a className="hero-link" href="#support-now">
            今の応援を見る
            <span aria-hidden="true">↓</span>
          </a>
        </section>

        <SupportSpotlight
          items={supportSpotlightItems}
          realtimeBanner={realtimeBanner}
        />

        <section
          className="section-container support-section"
          id="support-sites"
          aria-labelledby="support-sites-title"
        >
          <div className="section-heading">
            <p className="eyebrow">SUPPORT SITES</p>
            <h2 id="support-sites-title">5人のファンサイトへ</h2>
            <p>
              プロフィールや活動の記録、詳しい応援方法を、それぞれのサイトで。
            </p>
          </div>

          <div className="person-grid">
            {persons.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>

        </section>

        <PortalFeedSections items={feedItems} now={now} />

        <CreatorMiniProfile />
      </main>

      <SiteFooter />
    </div>
  );
}

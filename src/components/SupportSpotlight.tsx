import { MilyRealtimeBanner } from "@/components/MilyRealtimeBanner";
import { personsById } from "@/data/persons";
import type { MilyRealtimeBanner as RealtimeBanner } from "@/lib/mily-realtime-state";
import type { SupportSpotlightItem } from "@/lib/support-spotlight";

export function SupportSpotlight({
  items,
  realtimeBanner,
}: {
  items: readonly SupportSpotlightItem[];
  realtimeBanner: RealtimeBanner | null;
}) {
  if (items.length === 0 && !realtimeBanner) return null;

  return (
    <section
      className="support-now-section"
      id="support-now"
      aria-labelledby="support-now-title"
    >
      <div className="section-container">
        <div className="support-now-heading">
          <div>
            <p className="eyebrow">SUPPORT NOW</p>
            <h2 id="support-now-title">いま応援してほしいこと</h2>
          </div>
          <p>
            投票や出演予定など、いま動ける応援をまとめています。
            期限を過ぎた案内は自動で表示から外れます。
          </p>
        </div>

        <MilyRealtimeBanner banner={realtimeBanner} />

        {items.length > 0 ? (
          <ol className="support-now-grid">
            {items.map((item) => {
              const person = personsById[item.personId];

              return (
                <li
                  className={`support-now-card support-now-card--${item.state}`}
                  key={item.id}
                >
                  <div className="support-now-meta">
                    <span className="support-now-person">
                      {person.displayName}
                    </span>
                    <span className="support-now-state">{item.stateLabel}</span>
                    <span>{item.kindLabel}</span>
                  </div>
                  <p className="support-now-timing">{item.timingLabel}</p>
                  <h3>{item.title}</h3>
                  {item.summary ? <p>{item.summary}</p> : null}
                  <div className="support-now-actions">
                    <a
                      className="support-now-primary"
                      href={item.href}
                      {...(item.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {item.ctaLabel}
                      <span aria-hidden="true">{item.external ? "↗" : "→"}</span>
                      {item.external ? (
                        <span className="sr-only">（新しいタブで開きます）</span>
                      ) : null}
                    </a>
                    {item.href !== person.siteUrl ? (
                      <a className="support-now-site-link" href={person.siteUrl}>
                        {person.displayName}のファンサイトへ
                        <span aria-hidden="true">→</span>
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

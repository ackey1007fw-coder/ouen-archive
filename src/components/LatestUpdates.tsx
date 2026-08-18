import { personsById } from "@/data/persons";
import type { PortalFeedItem } from "@/lib/feed-schema";
import {
  PORTAL_FEED_ITEM_TYPE_LABELS,
  formatPublishedDate,
} from "@/lib/feed-view";

export function LatestUpdates({
  items,
}: {
  items: readonly PortalFeedItem[];
}) {
  return (
    <section className="latest-section" aria-labelledby="latest-updates-title">
      <div className="section-container latest-layout">
        <div className="latest-heading">
          <p className="eyebrow">LATEST UPDATES</p>
          <h2 id="latest-updates-title">最新のお知らせ</h2>
          <p>5つの応援サイトから、更新情報を時系列でお届けします。</p>
        </div>

        {items.length > 0 ? (
          <ol className="latest-list">
            {items.map((item) => {
              const person = personsById[item.personId];

              return (
                <li className="latest-item" key={item.id}>
                  <a
                    className="latest-item-link"
                    href={item.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <div className="latest-meta">
                      <strong>{person.displayName}</strong>
                      <span>{PORTAL_FEED_ITEM_TYPE_LABELS[item.type]}</span>
                      <time dateTime={item.publishedAt}>
                        {formatPublishedDate(item.publishedAt)}
                      </time>
                    </div>
                    <h3>{item.title}</h3>
                    {item.summary ? (
                      <p className="latest-summary">{item.summary}</p>
                    ) : null}
                    <span className="latest-cta">
                      応援サイトで見る
                      <span aria-hidden="true">↗</span>
                    </span>
                    <span className="sr-only">（新しいタブで開きます）</span>
                  </a>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty-state" role="status">
            <div className="empty-dots" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <strong>各応援サイトの最新情報をご覧ください。</strong>
            <p>このページは、情報を取得できない場合もご利用いただけます。</p>
          </div>
        )}
      </div>
    </section>
  );
}

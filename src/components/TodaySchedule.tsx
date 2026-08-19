import { personsById } from "@/data/persons";
import type { PortalFeedItem } from "@/lib/feed-schema";
import {
  PORTAL_FEED_ITEM_TYPE_LABELS,
  formatTodayTime,
} from "@/lib/feed-view";

export function TodaySchedule({
  items,
}: {
  items: readonly PortalFeedItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="today-section" aria-labelledby="today-title">
      <div className="section-container">
        <div className="today-heading">
          <p className="eyebrow">TODAY</p>
          <h2 id="today-title">今日の予定</h2>
        </div>

        <ol className="today-list">
          {items.map((item) => {
            const person = personsById[item.personId];

            return (
              <li className="today-item" key={item.id}>
                <a
                  className="today-item-link"
                  href={item.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <div className="today-meta">
                    <time dateTime={item.startsAt}>
                      {formatTodayTime(item.startsAt!)}
                    </time>
                    <span>{PORTAL_FEED_ITEM_TYPE_LABELS[item.type]}</span>
                  </div>
                  <div className="today-body">
                    <p>{person.displayName}</p>
                    <h3>{item.title}</h3>
                  </div>
                  <span className="today-arrow" aria-hidden="true">
                    ↗
                  </span>
                  <span className="sr-only">（新しいタブで開きます）</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

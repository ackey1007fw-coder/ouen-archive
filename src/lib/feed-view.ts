import { PERSON_ORDER } from "@/data/persons";
import type { PortalFeed, PortalFeedItem } from "@/lib/feed-schema";

export const LATEST_UPDATES_LIMIT = 15;
export const TOKYO_TIME_ZONE = "Asia/Tokyo";
export const PORTAL_FEED_ITEM_TYPE_LABELS: Record<
  PortalFeedItem["type"],
  string
> = {
  event: "イベント",
  news: "ニュース",
  schedule: "スケジュール",
  story: "ストーリー",
  update: "更新",
};

const personOrder = new Map(
  PERSON_ORDER.map((personId, index) => [personId, index]),
);

const tokyoDateParts = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TOKYO_TIME_ZONE,
  year: "numeric",
});

const publishedDate = new Intl.DateTimeFormat("ja-JP", {
  day: "numeric",
  month: "numeric",
  timeZone: TOKYO_TIME_ZONE,
  year: "numeric",
});

const scheduleTime = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: TOKYO_TIME_ZONE,
});

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function comparePerson(left: PortalFeedItem, right: PortalFeedItem): number {
  return (
    (personOrder.get(left.personId) ?? Number.MAX_SAFE_INTEGER) -
    (personOrder.get(right.personId) ?? Number.MAX_SAFE_INTEGER)
  );
}

function compareStableIdentity(
  left: PortalFeedItem,
  right: PortalFeedItem,
): number {
  return comparePerson(left, right) || compareText(left.id, right.id);
}

function getTokyoDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = tokyoDateParts.formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function mergePortalFeedItems(
  feeds: readonly PortalFeed[],
): PortalFeedItem[] {
  return feeds.flatMap((feed) => feed.items);
}

export function selectLatestUpdates(
  items: readonly PortalFeedItem[],
  limit = LATEST_UPDATES_LIMIT,
): PortalFeedItem[] {
  return [...items]
    .sort((left, right) => {
      const publishedDifference =
        Date.parse(right.publishedAt) - Date.parse(left.publishedAt);

      return publishedDifference || compareStableIdentity(left, right);
    })
    .slice(0, limit);
}

export function selectTodayItems(
  items: readonly PortalFeedItem[],
  now: Date,
): PortalFeedItem[] {
  const today = getTokyoDateKey(now);

  return items
    .filter(
      (item) =>
        (item.type === "schedule" || item.type === "event") &&
        item.startsAt !== undefined &&
        getTokyoDateKey(item.startsAt) === today,
    )
    .sort((left, right) => {
      const startsDifference =
        Date.parse(left.startsAt!) - Date.parse(right.startsAt!);

      return startsDifference || compareStableIdentity(left, right);
    });
}

export function formatPublishedDate(value: string): string {
  return publishedDate.format(new Date(value));
}

export function formatTodayTime(value: string): string {
  return `本日 ${scheduleTime.format(new Date(value))}`;
}

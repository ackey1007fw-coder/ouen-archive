import type { SupportCampaign } from "@/data/support-campaigns";
import { PERSON_ORDER } from "@/data/persons";
import type { PersonId, PortalFeedItem } from "@/lib/feed-schema";

export const SUPPORT_CAMPAIGN_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1_000;
export const SUPPORT_SPOTLIGHT_LIMIT = 4;
export const TOKYO_TIME_ZONE = "Asia/Tokyo";

export type SupportSpotlightItem = Readonly<{
  id: string;
  personId: PersonId;
  state: "active" | "upcoming";
  stateLabel: string;
  kindLabel: string;
  timingLabel: string;
  title: string;
  summary?: string;
  href: string;
  ctaLabel: string;
  external: boolean;
  sortAt: number;
  priority: number;
}>;

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  day: "numeric",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "numeric",
  timeZone: TOKYO_TIME_ZONE,
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function personIndex(personId: PersonId): number {
  return PERSON_ORDER.indexOf(personId);
}

function campaignToSpotlight(
  campaign: SupportCampaign,
  nowMs: number,
): SupportSpotlightItem | null {
  const startsAt = Date.parse(campaign.startsAt);
  const endsAt = Date.parse(campaign.endsAt);

  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    throw new Error(`Invalid campaign schedule: ${campaign.id}`);
  }

  if (endsAt < nowMs) return null;

  if (startsAt > nowMs && startsAt - nowMs > SUPPORT_CAMPAIGN_LOOKAHEAD_MS) {
    return null;
  }

  const active = startsAt <= nowMs;

  return {
    id: `campaign:${campaign.id}`,
    personId: campaign.personId,
    state: active ? "active" : "upcoming",
    stateLabel: active
      ? (campaign.activeStateLabel ?? "受付中")
      : (campaign.upcomingStateLabel ?? "まもなく"),
    kindLabel: campaign.kindLabel,
    timingLabel:
      campaign.timingLabel ??
      (active
        ? `${formatDateTime(campaign.endsAt)}まで`
        : `${formatDateTime(campaign.startsAt)}から`),
    title: campaign.title,
    summary: campaign.summary,
    href: campaign.href,
    ctaLabel: campaign.ctaLabel,
    external: campaign.external,
    sortAt: startsAt,
    priority: campaign.priority,
  };
}

function selectNextSchedulePerPerson(
  items: readonly PortalFeedItem[],
  nowMs: number,
  excludedPeople: ReadonlySet<PersonId>,
): PortalFeedItem[] {
  const candidates = items
    .filter(
      (item) =>
        (item.type === "schedule" || item.type === "event") &&
        !excludedPeople.has(item.personId) &&
        item.startsAt !== undefined &&
        Date.parse(item.startsAt) > nowMs,
    )
    .sort((left, right) => {
      const byStart = Date.parse(left.startsAt!) - Date.parse(right.startsAt!);
      return (
        byStart ||
        personIndex(left.personId) - personIndex(right.personId) ||
        left.id.localeCompare(right.id)
      );
    });

  const selected = new Map<PersonId, PortalFeedItem>();

  for (const item of candidates) {
    if (!selected.has(item.personId)) selected.set(item.personId, item);
  }

  return [...selected.values()].sort(
    (left, right) =>
      Date.parse(left.startsAt!) - Date.parse(right.startsAt!) ||
      personIndex(left.personId) - personIndex(right.personId),
  );
}

export function selectSupportSpotlightItems(input: {
  campaigns: readonly SupportCampaign[];
  feedItems: readonly PortalFeedItem[];
  now: Date;
  limit?: number;
}): SupportSpotlightItem[] {
  const nowMs = input.now.getTime();
  const limit = input.limit ?? SUPPORT_SPOTLIGHT_LIMIT;

  if (!Number.isFinite(nowMs)) throw new Error("now must be a valid Date");
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("limit must be a non-negative integer");
  }

  const campaigns = input.campaigns
    .map((campaign) => campaignToSpotlight(campaign, nowMs))
    .filter((item): item is SupportSpotlightItem => item !== null)
    .sort((left, right) => {
      const byState =
        Number(left.state === "upcoming") -
        Number(right.state === "upcoming");
      return (
        byState || right.priority - left.priority || left.sortAt - right.sortAt
      );
    });

  const campaignPeople = new Set(campaigns.map(({ personId }) => personId));
  const schedules = selectNextSchedulePerPerson(
    input.feedItems,
    nowMs,
    campaignPeople,
  ).map((item): SupportSpotlightItem => ({
      id: `schedule:${item.id}`,
      personId: item.personId,
      state: "upcoming",
      stateLabel: "次の出演",
      kindLabel: item.type === "event" ? "イベント" : "出演予定",
      timingLabel: `次の予定｜${formatDateTime(item.startsAt!)}`,
      title: item.title,
      ...(item.summary ? { summary: item.summary } : {}),
      href: item.url,
      ctaLabel: "ファンサイトで詳しく見る",
      external: false,
      sortAt: Date.parse(item.startsAt!),
      priority: 0,
  }));

  return [...campaigns, ...schedules].slice(0, limit);
}

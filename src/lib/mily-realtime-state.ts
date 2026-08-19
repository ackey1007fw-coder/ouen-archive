import {
  MILY_SHOWROOM_URL,
  MILY_SITE_URL,
  isAllowlistedShowroomUrl,
  sanitizeMilyHref,
} from "@/data/mily-links";
import type { MilyRealtimeSnapshot } from "@/lib/mily-realtime";
import type {
  MilyLivePayload,
  MilyRadioStatus,
  MilyScheduleSlot,
} from "@/lib/mily-realtime-schema";
import { TOKYO_TIME_ZONE } from "@/lib/feed-view";

/**
 * child src/lib/realtimeStore.ts LIVE_STALE_MS。
 * observedAt がこの時間より古い LIVE は unknown 扱い。
 */
export const LIVE_STALE_MS = 90_000;

/**
 * child shared/radio-program.js ONAIR_STALE_MS。
 * NOW ON AIR 確認結果の信頼期間。クライアント poll 180秒の約2回分。
 */
export const RADIO_ONAIR_STALE_MS = 360_000;

/**
 * child radio SSOT. Do not trust API snapshot fields
 * (inScheduledWindow / schedulePhase / todayScheduled) for the current
 * window — recompute from Asia/Tokyo now.
 * Window is [10:00, 13:00) on Sunday.
 */
export const RADIO_WINDOW_WEEKDAY = 0;
export const RADIO_WINDOW_START_MINUTES = 10 * 60;
export const RADIO_WINDOW_END_MINUTES = 13 * 60;

export type MilyRealtimeBannerKind =
  | "showroom-live"
  | "radio-on-air"
  | "upcoming-schedule";

export type MilyRealtimeBanner = Readonly<{
  kind: MilyRealtimeBannerKind;
  stateLabel: string;
  title: string;
  detail?: string;
  href: string;
  linkLabel: string;
}>;

const tokyoDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TOKYO_TIME_ZONE,
});

const tokyoClockFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TOKYO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function tokyoDateKey(now: number = Date.now()): string {
  return tokyoDateFmt.format(new Date(now));
}

export function slotStartMs(slot: MilyScheduleSlot): number {
  return new Date(`${slot.date}T${slot.time}:00+09:00`).getTime();
}

export function isObservationStale(
  observedAt: string | null | undefined,
  now: number = Date.now(),
  staleMs: number = LIVE_STALE_MS,
): boolean {
  if (typeof observedAt !== "string") return true;
  const parsed = Date.parse(observedAt);
  if (Number.isNaN(parsed)) return true;
  if (parsed > now) return true;
  return now - parsed >= staleMs;
}

export function isOnAirObservationStale(
  updatedAt: string | null | undefined,
  now: number = Date.now(),
  staleMs: number = RADIO_ONAIR_STALE_MS,
): boolean {
  return isObservationStale(updatedAt, now, staleMs);
}

function tokyoMinutesOfDay(now: number): number {
  const parts = tokyoClockFmt.formatToParts(new Date(now));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

export function isCurrentRadioScheduledWindow(now: number = Date.now()): boolean {
  const weekday = new Date(`${tokyoDateKey(now)}T12:00:00+09:00`).getUTCDay();
  if (weekday !== RADIO_WINDOW_WEEKDAY) return false;
  const minutes = tokyoMinutesOfDay(now);
  return (
    minutes >= RADIO_WINDOW_START_MINUTES && minutes < RADIO_WINDOW_END_MINUTES
  );
}

function liveIdentityOk(live: MilyLivePayload): boolean {
  if (live.ok !== true) return false;
  if (live.roomUrl == null || live.roomUrl === "") return true;
  return isAllowlistedShowroomUrl(live.roomUrl);
}

export function isVerifiedShowroomLive(
  live: MilyLivePayload | null,
  now: number = Date.now(),
): boolean {
  if (!live) return false;
  if (!liveIdentityOk(live)) return false;
  if (live.live.state !== "live") return false;
  return !isObservationStale(live.live.observedAt, now, LIVE_STALE_MS);
}

export function isVerifiedRadioOnAir(
  radio: MilyRadioStatus | null,
  now: number = Date.now(),
): boolean {
  if (!radio) return false;
  if (radio.ok !== true) return false;
  if (radio.onAirConfirmed !== true) return false;
  if (isOnAirObservationStale(radio.updatedAt, now, RADIO_ONAIR_STALE_MS)) {
    return false;
  }
  return isCurrentRadioScheduledWindow(now);
}

export function nextTodayUpcomingSlot(
  slots: readonly MilyScheduleSlot[],
  now: number = Date.now(),
): MilyScheduleSlot | null {
  const today = tokyoDateKey(now);
  return (
    slots
      .filter((slot) => slot.date === today && slotStartMs(slot) > now)
      .sort((left, right) => slotStartMs(left) - slotStartMs(right))[0] ?? null
  );
}

function showroomLiveBanner(live: MilyLivePayload): MilyRealtimeBanner {
  return {
    kind: "showroom-live",
    stateLabel: "配信中",
    title: "みりぃがSHOWROOMで配信しています",
    href: sanitizeMilyHref(live.roomUrl, MILY_SHOWROOM_URL),
    linkLabel: "配信を見に行く",
  };
}

function radioOnAirBanner(radio: MilyRadioStatus): MilyRealtimeBanner {
  return {
    kind: "radio-on-air",
    stateLabel: "放送中",
    title: `みりぃの担当番組「${radio.programName}」が放送中です`,
    href: MILY_SITE_URL,
    linkLabel: "詳しく見る",
  };
}

function upcomingScheduleBanner(slot: MilyScheduleSlot): MilyRealtimeBanner {
  return {
    kind: "upcoming-schedule",
    stateLabel: "このあと",
    title: "みりぃの配信予定があります",
    detail: `${slot.time}〜`,
    href: MILY_SITE_URL,
    linkLabel: "予定を見る",
  };
}

/**
 * 優先順位（親ポータル仕様）:
 * 1. verified SHOWROOM live
 * 2. verified radio on-air
 * 3. 本日これからの正確な配信予定（/api/mily-schedule）
 * 4. 何も表示しない
 *
 * 予定を verified live へ昇格させない。
 * ラジオは fresh な onAirConfirmed === true かつ
 * 現在の Asia/Tokyo 日曜 10:00–13:00 枠内のときだけ。
 * API の inScheduledWindow / schedulePhase だけでは「放送中」にしない。
 */
export function deriveMilyRealtimeBanner(
  snapshot: MilyRealtimeSnapshot,
  now: number = Date.now(),
): MilyRealtimeBanner | null {
  if (isVerifiedShowroomLive(snapshot.live, now) && snapshot.live) {
    return showroomLiveBanner(snapshot.live);
  }

  if (isVerifiedRadioOnAir(snapshot.radio, now) && snapshot.radio) {
    return radioOnAirBanner(snapshot.radio);
  }

  const slots = snapshot.schedule?.ok === true ? snapshot.schedule.slots : [];
  const upcoming = nextTodayUpcomingSlot(slots, now);
  if (upcoming) {
    return upcomingScheduleBanner(upcoming);
  }

  return null;
}

import assert from "node:assert/strict";
import test from "node:test";

import type { MilyRealtimeSnapshot } from "@/lib/mily-realtime";
import {
  LIVE_STALE_MS,
  RADIO_ONAIR_STALE_MS,
  deriveMilyRealtimeBanner,
  isVerifiedRadioOnAir,
  isVerifiedShowroomLive,
  nextTodayUpcomingSlot,
} from "@/lib/mily-realtime-state";
import type {
  MilyLivePayload,
  MilyRadioStatus,
  MilySchedulePayload,
} from "@/lib/mily-realtime-schema";
import {
  MILY_SHOWROOM_URL,
  MILY_SITE_URL,
} from "@/data/mily-links";

const NOW = Date.parse("2026-08-19T12:00:00+09:00");
const FRESH_OBSERVED_AT = new Date(NOW - 15_000).toISOString();
const STALE_OBSERVED_AT = new Date(NOW - LIVE_STALE_MS).toISOString();
const STALE_RADIO_AT = new Date(NOW - RADIO_ONAIR_STALE_MS).toISOString();

function livePayload(
  overrides: Partial<MilyLivePayload> & {
    live?: Partial<MilyLivePayload["live"]>;
    next?: MilyLivePayload["next"];
  } = {},
): MilyLivePayload {
  return {
    ok: true,
    roomUrl: MILY_SHOWROOM_URL,
    ...overrides,
    live: {
      state: "offline",
      liveId: null,
      startedAt: null,
      observedAt: FRESH_OBSERVED_AT,
      ...overrides.live,
    },
    next: overrides.next ?? { state: "none", at: null },
  };
}

function radioPayload(
  overrides: Partial<MilyRadioStatus> = {},
): MilyRadioStatus {
  return {
    ok: true,
    programName: "湘南シーサイドサークル",
    todayScheduled: false,
    scheduledStart: "10:00",
    scheduledEnd: "13:00",
    inScheduledWindow: false,
    schedulePhase: "idle",
    nextStartAt: null,
    onAirConfirmed: false,
    milyAppearanceConfirmed: null,
    listenUrl: "https://fm-smw.jp/radio",
    sourceUrl: "https://fm-smw.jp/",
    lastVerifiedAt: "2026-08-16",
    updatedAt: FRESH_OBSERVED_AT,
    ...overrides,
  };
}

function schedulePayload(
  slots: MilySchedulePayload["slots"] = [],
  ok = true,
): MilySchedulePayload {
  return {
    ok,
    slots,
    source: { roomUrl: MILY_SHOWROOM_URL },
  };
}

function snapshot(
  overrides: Partial<MilyRealtimeSnapshot> = {},
): MilyRealtimeSnapshot {
  return {
    live: livePayload(),
    radio: radioPayload(),
    schedule: schedulePayload(),
    ...overrides,
  };
}

function renderedText(
  banner: ReturnType<typeof deriveMilyRealtimeBanner>,
): string {
  if (!banner) return "";
  return `${banner.stateLabel} ${banner.title} ${banner.detail ?? ""} ${banner.linkLabel}`;
}

test("1. verified SHOWROOM live shows 配信中", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({ live: { state: "live", observedAt: FRESH_OBSERVED_AT } }),
    }),
    NOW,
  );

  assert.equal(banner?.kind, "showroom-live");
  assert.equal(banner?.stateLabel, "配信中");
  assert.match(banner?.title ?? "", /SHOWROOM/);
  assert.equal(banner?.href, MILY_SHOWROOM_URL);
  assert.equal(isVerifiedShowroomLive(livePayload({ live: { state: "live", observedAt: FRESH_OBSERVED_AT } }), NOW), true);
});

test("2. SHOWROOM scheduled must not show 配信中", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({
        live: { state: "offline", observedAt: FRESH_OBSERVED_AT },
        next: { state: "scheduled", at: "2026-08-19T19:00:00+09:00" },
      }),
    }),
    NOW,
  );

  assert.notEqual(banner?.kind, "showroom-live");
  assert.doesNotMatch(renderedText(banner), /配信中|LIVE NOW|ON AIR/);
  assert.equal(
    isVerifiedShowroomLive(
      livePayload({
        live: { state: "offline" },
        next: { state: "scheduled", at: "2026-08-19T19:00:00+09:00" },
      }),
      NOW,
    ),
    false,
  );
});

test("3. SHOWROOM offline / unknown do not show LIVE", () => {
  for (const state of ["offline", "unknown"] as const) {
    const banner = deriveMilyRealtimeBanner(
      snapshot({
        live: livePayload({ live: { state, observedAt: FRESH_OBSERVED_AT } }),
      }),
      NOW,
    );
    assert.equal(banner, null, state);
    assert.doesNotMatch(renderedText(banner), /配信中|LIVE NOW|ON AIR/);
  }
});

test("4. SHOWROOM stale live is not LIVE", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({ live: { state: "live", observedAt: STALE_OBSERVED_AT } }),
    }),
    NOW,
  );

  assert.equal(banner, null);
  assert.equal(
    isVerifiedShowroomLive(
      livePayload({ live: { state: "live", observedAt: STALE_OBSERVED_AT } }),
      NOW,
    ),
    false,
  );
});

test("future observedAt is treated as stale", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({
        live: { state: "live", observedAt: new Date(NOW + 60_000).toISOString() },
      }),
    }),
    NOW,
  );

  assert.equal(banner, null);
});

test("6. verified radio on-air shows 放送中", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      radio: radioPayload({
        onAirConfirmed: true,
        inScheduledWindow: true,
        schedulePhase: "window",
        todayScheduled: true,
        updatedAt: FRESH_OBSERVED_AT,
      }),
    }),
    NOW,
  );

  assert.equal(banner?.kind, "radio-on-air");
  assert.equal(banner?.stateLabel, "放送中");
  assert.match(banner?.title ?? "", /ラジオ/);
  assert.equal(banner?.href, MILY_SITE_URL);
  assert.equal(
    isVerifiedRadioOnAir(
      radioPayload({ onAirConfirmed: true, updatedAt: FRESH_OBSERVED_AT }),
      NOW,
    ),
    true,
  );
});

test("7. radio schedule window alone must not show 放送中", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      radio: radioPayload({
        onAirConfirmed: null,
        inScheduledWindow: true,
        schedulePhase: "window",
        todayScheduled: true,
      }),
    }),
    NOW,
  );

  assert.notEqual(banner?.kind, "radio-on-air");
  assert.doesNotMatch(renderedText(banner), /放送中|ON AIR|LIVE NOW|配信中/);
  assert.equal(
    isVerifiedRadioOnAir(
      radioPayload({
        onAirConfirmed: null,
        inScheduledWindow: true,
        schedulePhase: "window",
      }),
      NOW,
    ),
    false,
  );
});

test("7b. onAirConfirmed false inside the window is not 放送中", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      radio: radioPayload({
        onAirConfirmed: false,
        inScheduledWindow: true,
        schedulePhase: "window",
        todayScheduled: true,
      }),
    }),
    NOW,
  );

  assert.equal(banner, null);
});

test("8. stale radio on-air is not 放送中", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      radio: radioPayload({
        onAirConfirmed: true,
        inScheduledWindow: true,
        schedulePhase: "window",
        updatedAt: STALE_RADIO_AT,
      }),
    }),
    NOW,
  );

  assert.equal(banner, null);
  assert.equal(
    isVerifiedRadioOnAir(
      radioPayload({ onAirConfirmed: true, updatedAt: STALE_RADIO_AT }),
      NOW,
    ),
    false,
  );
});

test("9. SHOWROOM live wins over radio on-air", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({ live: { state: "live", observedAt: FRESH_OBSERVED_AT } }),
      radio: radioPayload({
        onAirConfirmed: true,
        inScheduledWindow: true,
        updatedAt: FRESH_OBSERVED_AT,
      }),
    }),
    NOW,
  );

  assert.equal(banner?.kind, "showroom-live");
  assert.equal(banner?.stateLabel, "配信中");
});

test("10. radio on-air shows when live is absent", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({ live: { state: "offline", observedAt: FRESH_OBSERVED_AT } }),
      radio: radioPayload({
        onAirConfirmed: true,
        updatedAt: FRESH_OBSERVED_AT,
      }),
    }),
    NOW,
  );

  assert.equal(banner?.kind, "radio-on-air");
});

test("11. upcoming today schedule uses ordinary wording", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      schedule: schedulePayload([{ date: "2026-08-19", time: "21:00" }]),
    }),
    NOW,
  );

  assert.equal(banner?.kind, "upcoming-schedule");
  assert.equal(banner?.stateLabel, "このあと");
  assert.match(banner?.title ?? "", /配信予定/);
  assert.match(banner?.detail ?? "", /21:00/);
  assert.doesNotMatch(
    renderedText(banner),
    /配信中|LIVE NOW|ON AIR|開催中/,
  );
});

test("12. all empty hides the banner", () => {
  const banner = deriveMilyRealtimeBanner(snapshot(), NOW);
  assert.equal(banner, null);
});

test("16. scheduled display must not contain live wording", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({
        live: { state: "offline" },
        next: { state: "scheduled", at: "2026-08-19T21:00:00+09:00" },
      }),
      schedule: schedulePayload([{ date: "2026-08-19", time: "21:00" }]),
    }),
    NOW,
  );

  assert.equal(banner?.kind, "upcoming-schedule");
  assert.doesNotMatch(
    renderedText(banner),
    /配信中|LIVE NOW|ON AIR|開催中/,
  );
});

test("a past-start slot is not promoted to live or upcoming", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      schedule: schedulePayload([{ date: "2026-08-19", time: "09:00" }]),
    }),
    NOW,
  );

  assert.equal(banner, null);
  assert.equal(
    nextTodayUpcomingSlot([{ date: "2026-08-19", time: "09:00" }], NOW),
    null,
  );
});

test("unverified roomUrl identity blocks SHOWROOM live", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({
        roomUrl: "https://evil.example/live",
        live: { state: "live", observedAt: FRESH_OBSERVED_AT },
      }),
    }),
    NOW,
  );

  assert.equal(banner, null);
});

test("ok:false live is not verified", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({
        ok: false,
        live: { state: "live", observedAt: FRESH_OBSERVED_AT },
      }),
    }),
    NOW,
  );

  assert.equal(banner, null);
});

test("schedule ok:false does not surface slots", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      schedule: schedulePayload([{ date: "2026-08-19", time: "21:00" }], false),
    }),
    NOW,
  );

  assert.equal(banner, null);
});

import assert from "node:assert/strict";
import test from "node:test";

import type { MilyRealtimeSnapshot } from "@/lib/mily-realtime";
import {
  LIVE_STALE_MS,
  RADIO_ONAIR_STALE_MS,
  deriveMilyRealtimeBanner,
  isCurrentRadioScheduledWindow,
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
const SUNDAY_NOON = Date.parse("2026-08-16T12:00:00+09:00");
const FRESH_OBSERVED_AT = new Date(NOW - 15_000).toISOString();
const FRESH_RADIO_AT = new Date(SUNDAY_NOON - 15_000).toISOString();
const STALE_OBSERVED_AT = new Date(NOW - LIVE_STALE_MS).toISOString();
const STALE_RADIO_AT = new Date(SUNDAY_NOON - RADIO_ONAIR_STALE_MS).toISOString();

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
    updatedAt: FRESH_RADIO_AT,
    ...overrides,
  };
}

function freshOnAirRadio(
  now: number,
  overrides: Partial<MilyRadioStatus> = {},
): MilyRadioStatus {
  return radioPayload({
    onAirConfirmed: true,
    inScheduledWindow: true,
    schedulePhase: "window",
    todayScheduled: true,
    updatedAt: new Date(now - 15_000).toISOString(),
    ...overrides,
  });
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

const APPEARANCE_CLAIM_COPY =
  /みりぃ出演ラジオ|みりぃが出演中|みりぃが放送中|みりぃ出演中|みりぃがラジオ出演中/;

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

test("same live payload is 配信中 under 90s and hidden at 90s", () => {
  const observedAtMs = Date.parse("2026-08-19T12:00:00.000Z");
  const observedAt = new Date(observedAtMs).toISOString();
  const live = livePayload({ live: { state: "live", observedAt } });

  const fresh = deriveMilyRealtimeBanner(snapshot({ live }), observedAtMs + 89_999);
  const stale = deriveMilyRealtimeBanner(snapshot({ live }), observedAtMs + 90_000);

  assert.equal(fresh?.kind, "showroom-live");
  assert.equal(fresh?.stateLabel, "配信中");
  assert.equal(stale, null);
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
      radio: freshOnAirRadio(SUNDAY_NOON),
    }),
    SUNDAY_NOON,
  );

  assert.equal(banner?.kind, "radio-on-air");
  assert.equal(banner?.stateLabel, "放送中");
  assert.match(banner?.title ?? "", /担当番組/);
  assert.match(banner?.title ?? "", /湘南シーサイドサークル/);
  assert.equal(banner?.href, MILY_SITE_URL);
  assert.equal(isVerifiedRadioOnAir(freshOnAirRadio(SUNDAY_NOON), SUNDAY_NOON), true);
});

test("7. radio schedule window alone must not show 放送中", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      radio: radioPayload({
        onAirConfirmed: null,
        inScheduledWindow: true,
        schedulePhase: "window",
        todayScheduled: true,
        updatedAt: FRESH_RADIO_AT,
      }),
    }),
    SUNDAY_NOON,
  );

  assert.notEqual(banner?.kind, "radio-on-air");
  assert.doesNotMatch(renderedText(banner), /放送中|ON AIR|LIVE NOW|配信中/);
  assert.equal(
    isVerifiedRadioOnAir(
      radioPayload({
        onAirConfirmed: null,
        inScheduledWindow: true,
        schedulePhase: "window",
        updatedAt: FRESH_RADIO_AT,
      }),
      SUNDAY_NOON,
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
        updatedAt: FRESH_RADIO_AT,
      }),
    }),
    SUNDAY_NOON,
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
    SUNDAY_NOON,
  );

  assert.equal(banner, null);
  assert.equal(
    isVerifiedRadioOnAir(
      radioPayload({ onAirConfirmed: true, updatedAt: STALE_RADIO_AT }),
      SUNDAY_NOON,
    ),
    false,
  );
});

test("9. SHOWROOM live wins over radio on-air", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      live: livePayload({ live: { state: "live", observedAt: FRESH_OBSERVED_AT } }),
      radio: freshOnAirRadio(NOW),
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
      radio: freshOnAirRadio(SUNDAY_NOON),
    }),
    SUNDAY_NOON,
  );

  assert.equal(banner?.kind, "radio-on-air");
});

test("radio current window boundaries use Asia/Tokyo Sunday 10:00–13:00", () => {
  const cases: Array<[string, string, boolean]> = [
    ["Sunday 09:59 JST", "2026-08-16T09:59:00+09:00", false],
    ["Sunday 10:00 JST", "2026-08-16T10:00:00+09:00", true],
    ["Sunday 12:59 JST", "2026-08-16T12:59:00+09:00", true],
    ["Sunday 13:00 JST", "2026-08-16T13:00:00+09:00", false],
    ["Sunday 13:01 JST", "2026-08-16T13:01:00+09:00", false],
    ["Monday 11:00 JST", "2026-08-17T11:00:00+09:00", false],
  ];

  for (const [label, iso, expected] of cases) {
    const now = Date.parse(iso);
    const radio = freshOnAirRadio(now);
    assert.equal(isCurrentRadioScheduledWindow(now), expected, label);
    assert.equal(isVerifiedRadioOnAir(radio, now), expected, label);
    const banner = deriveMilyRealtimeBanner(snapshot({ radio }), now);
    if (expected) {
      assert.equal(banner?.kind, "radio-on-air", label);
    } else {
      assert.notEqual(banner?.kind, "radio-on-air", label);
    }
  }
});

test("stale API window snapshot after 13:00 is not 放送中", () => {
  const now = Date.parse("2026-08-16T13:00:00+09:00");
  const radio = freshOnAirRadio(now, {
    inScheduledWindow: true,
    schedulePhase: "window",
    todayScheduled: true,
  });

  assert.equal(isCurrentRadioScheduledWindow(now), false);
  assert.equal(isVerifiedRadioOnAir(radio, now), false);
  assert.equal(deriveMilyRealtimeBanner(snapshot({ radio }), now), null);
});

test("radio copy names the program and does not claim a current appearance", () => {
  const banner = deriveMilyRealtimeBanner(
    snapshot({
      radio: freshOnAirRadio(SUNDAY_NOON),
    }),
    SUNDAY_NOON,
  );
  const text = renderedText(banner);

  assert.equal(banner?.stateLabel, "放送中");
  assert.match(banner?.title ?? "", /担当番組/);
  assert.match(banner?.title ?? "", /湘南シーサイドサークル/);
  assert.doesNotMatch(text, APPEARANCE_CLAIM_COPY);
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

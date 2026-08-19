import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import Home, { revalidate as pageRevalidate } from "@/app/page";
import { PortalFeedSections } from "@/components/PortalFeedSections";
import { PERSON_ORDER } from "@/data/persons";
import { MILY_SHOWROOM_URL } from "@/data/mily-links";
import type { PortalFeedItem } from "@/lib/feed-schema";
import {
  MILY_LIVE_REVALIDATE_SECONDS,
  MILY_LIVE_URL,
  MILY_RADIO_REVALIDATE_SECONDS,
  MILY_RADIO_URL,
  MILY_SCHEDULE_REVALIDATE_SECONDS,
  MILY_SCHEDULE_URL,
} from "@/lib/mily-realtime";
import { LIVE_STALE_MS } from "@/lib/mily-realtime-state";
import { PORTAL_FEED_REVALIDATE_SECONDS } from "@/lib/portal-feeds";

const NOW_ISO = new Date(Date.now() - 10_000).toISOString();

const validLive = {
  ok: true,
  roomUrl: MILY_SHOWROOM_URL,
  live: {
    state: "offline",
    liveId: null,
    startedAt: null,
    observedAt: NOW_ISO,
  },
  next: { state: "none", at: null },
};

const validRadio = {
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
  updatedAt: NOW_ISO,
};

const validSchedule = {
  ok: true,
  slots: [] as Array<{ date: string; time: string }>,
  source: { roomUrl: MILY_SHOWROOM_URL },
};

function jsonResponse(value: unknown, status = 200, url?: string): Response {
  const response = new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  });
  if (url) {
    Object.defineProperty(response, "url", { value: url });
  }
  return response;
}

function realtimeBodies(overrides: {
  live?: unknown;
  radio?: unknown;
  schedule?: unknown;
  liveUrl?: string;
} = {}) {
  return {
    [MILY_LIVE_URL]: {
      body: overrides.live ?? validLive,
      url: overrides.liveUrl ?? MILY_LIVE_URL,
    },
    [MILY_RADIO_URL]: {
      body: overrides.radio ?? validRadio,
      url: MILY_RADIO_URL,
    },
    [MILY_SCHEDULE_URL]: {
      body: overrides.schedule ?? validSchedule,
      url: MILY_SCHEDULE_URL,
    },
  };
}

async function renderHome(fetchImpl: typeof fetch): Promise<string> {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = fetchImpl;
  console.warn = () => undefined;

  try {
    return renderToStaticMarkup(await Home());
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
}

test("page module exports revalidate === 0", () => {
  assert.equal(pageRevalidate, 0);
});

test("page re-evaluates the live banner at request time without disabling fetch cache", () => {
  const source = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
  assert.match(source, /export const revalidate = 0/);
  assert.doesNotMatch(source, /export const dynamic/);
  assert.match(source, /deriveMilyRealtimeBanner\(\s*realtime/);
});

test("the full page renders when all five feeds fail", async () => {
  const html = await renderHome(async () => {
    throw new Error("offline fixture");
  });

  assert.match(html, /応援の入口を、/);
  assert.match(html, /5つの応援サイトを見る/);
  assert.match(html, /LATEST UPDATES/);
  assert.doesNotMatch(html, /realtime-banner/);
});

test("5. SHOWROOM timeout still renders the page", async () => {
  const html = await renderHome((input) => {
    const url = String(input);
    if (url === MILY_LIVE_URL) {
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    }
    const bodies = realtimeBodies();
    const match = bodies[url as keyof typeof bodies];
    if (match) return Promise.resolve(jsonResponse(match.body, 200, match.url));
    throw new Error("feed offline");
  });

  assert.match(html, /応援の入口を、/);
  assert.match(html, /LATEST UPDATES/);
  assert.match(html, /三橋莉子/);
});

test("13. invalid JSON still renders the page", async () => {
  const html = await renderHome(async (input) => {
    const url = String(input);
    if (url === MILY_LIVE_URL) {
      return new Response("{not-json", { status: 200 });
    }
    const bodies = realtimeBodies();
    const match = bodies[url as keyof typeof bodies];
    if (match) return jsonResponse(match.body, 200, match.url);
    throw new Error("feed offline");
  });

  assert.match(html, /応援の入口を、/);
  assert.match(html, /LATEST UPDATES/);
});

test("14. HTTP error still renders the page", async () => {
  const html = await renderHome(async (input) => {
    const url = String(input);
    if (url === MILY_RADIO_URL) {
      return jsonResponse({ error: "nope" }, 502, url);
    }
    const bodies = realtimeBodies();
    const match = bodies[url as keyof typeof bodies];
    if (match) return jsonResponse(match.body, 200, match.url);
    throw new Error("feed offline");
  });

  assert.match(html, /応援の入口を、/);
  assert.match(html, /LATEST UPDATES/);
});

test("15. unexpected redirect hides the live banner", async () => {
  const html = await renderHome(async (input) => {
    const url = String(input);
    const bodies = realtimeBodies({
      live: {
        ...validLive,
        live: { ...validLive.live, state: "live" },
      },
      liveUrl: "https://evil.example/api/mily-live",
    });
    const match = bodies[url as keyof typeof bodies];
    if (match) return jsonResponse(match.body, 200, match.url);
    throw new Error("feed offline");
  });

  assert.doesNotMatch(html, /配信中/);
  assert.doesNotMatch(html, /realtime-banner--showroom-live/);
  assert.match(html, /応援の入口を、/);
});

test("verified live banner appears between person cards and TODAY", async () => {
  const html = await renderHome(async (input) => {
    const url = String(input);
    const bodies = realtimeBodies({
      live: {
        ...validLive,
        live: { ...validLive.live, state: "live" },
      },
    });
    const match = bodies[url as keyof typeof bodies];
    if (match) return jsonResponse(match.body, 200, match.url);
    throw new Error("feed offline");
  });

  const cards = html.indexOf("person-grid");
  const banner = html.indexOf("realtime-banner--showroom-live");
  const latest = html.indexOf("LATEST UPDATES");
  assert.ok(cards !== -1 && banner !== -1 && latest !== -1);
  assert.ok(cards < banner && banner < latest);
  assert.match(html, /配信中/);
  assert.match(html, /みりぃがSHOWROOMで配信しています/);
});

test("same live payload is re-evaluated at request time instead of ISR HTML", async () => {
  const observedAtMs = Date.parse("2026-08-19T12:00:00.000Z");
  const observedAt = new Date(observedAtMs).toISOString();
  const live = {
    ...validLive,
    live: { ...validLive.live, state: "live" as const, observedAt },
  };

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    const bodies = realtimeBodies({ live });
    const match = bodies[url as keyof typeof bodies];
    if (match) return jsonResponse(match.body, 200, match.url);
    throw new Error("feed offline");
  };

  const originalNow = Date.now;
  try {
    Date.now = () => observedAtMs + 10_000;
    const freshHtml = await renderHome(fetchImpl);
    assert.match(freshHtml, /配信中/);
    assert.match(freshHtml, /realtime-banner--showroom-live/);

    Date.now = () => observedAtMs + LIVE_STALE_MS;
    const staleHtml = await renderHome(fetchImpl);
    assert.doesNotMatch(staleHtml, /配信中/);
    assert.doesNotMatch(staleHtml, /realtime-banner--showroom-live/);
  } finally {
    Date.now = originalNow;
  }
});

test("page fetch keeps isolated data-cache revalidate windows", async () => {
  const received = new Map<string, number | undefined>();

  await renderHome(async (input, init) => {
    const url = String(input);
    const nextRevalidate = (init as { next?: { revalidate?: number } } | undefined)
      ?.next?.revalidate;
    received.set(url, nextRevalidate);
    const bodies = realtimeBodies();
    const match = bodies[url as keyof typeof bodies];
    if (match) return jsonResponse(match.body, 200, match.url);
    throw new Error("feed offline");
  });

  assert.equal(received.get(MILY_LIVE_URL), 60);
  assert.equal(received.get(MILY_RADIO_URL), 180);
  assert.equal(received.get(MILY_SCHEDULE_URL), 300);
  assert.equal(MILY_LIVE_REVALIDATE_SECONDS, 60);
  assert.equal(MILY_RADIO_REVALIDATE_SECONDS, 180);
  assert.equal(MILY_SCHEDULE_REVALIDATE_SECONDS, 300);
  assert.equal(PORTAL_FEED_REVALIDATE_SECONDS, 300);

  for (const [url, revalidateSeconds] of received) {
    if (url.includes("portal-feed.json")) {
      assert.equal(revalidateSeconds, 300, url);
    }
  }
});

test("17. existing five person cards stay in fixed order", async () => {
  const html = await renderHome(async () => {
    throw new Error("offline fixture");
  });

  const names = [...html.matchAll(/class="person-name">([^<]+)/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(names, [
    "三橋莉子",
    "吉井優花子",
    "夏凪里季",
    "伊東千鶴",
    "MAKO",
  ]);
  assert.deepEqual(PERSON_ORDER, ["mily", "yukako", "riri", "chizuru", "mako"]);
});

test("18. TODAY / LATEST keep their existing planned wording", () => {
  const item: PortalFeedItem = {
    id: "mily:planned",
    personId: "mily",
    publishedAt: "2026-08-19T08:00:00+09:00",
    startsAt: "2026-08-19T19:30:00+09:00",
    title: "夜の予定",
    type: "schedule",
    url: "https://example.com/mily/planned",
  };
  const html = renderToStaticMarkup(
    <PortalFeedSections
      items={[item]}
      now={new Date("2026-08-19T12:00:00+09:00")}
    />,
  );

  assert.match(html, /TODAY/);
  assert.match(html, /本日 19:30/);
  assert.match(html, /夜の予定/);
  assert.match(html, /LATEST UPDATES/);
  assert.doesNotMatch(html, /配信中|開催中|LIVE NOW|ON AIR/);
});

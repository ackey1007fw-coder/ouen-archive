import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "@/app/page";
import { PortalFeedSections } from "@/components/PortalFeedSections";
import { PERSON_ORDER } from "@/data/persons";
import { MILY_SHOWROOM_URL } from "@/data/mily-links";
import type { PortalFeedItem } from "@/lib/feed-schema";
import {
  MILY_LIVE_URL,
  MILY_RADIO_URL,
  MILY_SCHEDULE_URL,
} from "@/lib/mily-realtime";

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

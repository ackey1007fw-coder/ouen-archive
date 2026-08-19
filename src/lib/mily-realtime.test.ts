import assert from "node:assert/strict";
import test from "node:test";

import { MILY_SHOWROOM_URL } from "@/data/mily-links";
import {
  MILY_LIVE_REVALIDATE_SECONDS,
  MILY_LIVE_URL,
  MILY_RADIO_REVALIDATE_SECONDS,
  MILY_RADIO_URL,
  MILY_SCHEDULE_REVALIDATE_SECONDS,
  MILY_SCHEDULE_URL,
  fetchMilyRealtimeSnapshot,
  type MilyRealtimeFetch,
} from "@/lib/mily-realtime";
import {
  MilyLivePayloadSchema,
  MilyRadioStatusSchema,
  MilySchedulePayloadSchema,
} from "@/lib/mily-realtime-schema";

const silentLogger = { warn: () => undefined };
const NOW_ISO = "2026-08-19T03:00:00.000Z";

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
  slots: [],
  source: { roomUrl: MILY_SHOWROOM_URL },
};

function jsonResponse(
  value: unknown,
  init: { status?: number; url?: string } = {},
): Response {
  const response = new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: init.status ?? 200,
  });
  if (init.url) {
    Object.defineProperty(response, "url", { value: init.url });
  }
  return response;
}

function mappedFetch(
  bodies: Partial<Record<string, unknown>>,
  urls: Partial<Record<string, string>> = {},
): MilyRealtimeFetch {
  return async (input) => {
    if (!(input in bodies)) {
      throw new Error(`unexpected url ${input}`);
    }
    return jsonResponse(bodies[input], { url: urls[input] ?? input });
  };
}

test("accepts the three production-shaped payloads independently", async () => {
  const snapshot = await fetchMilyRealtimeSnapshot({
    fetchImpl: mappedFetch({
      [MILY_LIVE_URL]: validLive,
      [MILY_RADIO_URL]: validRadio,
      [MILY_SCHEDULE_URL]: validSchedule,
    }),
    logger: silentLogger,
  });

  assert.equal(snapshot.live?.live.state, "offline");
  assert.equal(snapshot.radio?.onAirConfirmed, false);
  assert.deepEqual(snapshot.schedule?.slots, []);
});

test("5. live timeout does not block radio or schedule", async () => {
  const fetchImpl: MilyRealtimeFetch = (input, init) => {
    if (input === MILY_LIVE_URL) {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    }
    const body =
      input === MILY_RADIO_URL
        ? validRadio
        : input === MILY_SCHEDULE_URL
          ? validSchedule
          : null;
    return Promise.resolve(jsonResponse(body, { url: input }));
  };

  const snapshot = await fetchMilyRealtimeSnapshot({
    fetchImpl,
    logger: silentLogger,
    timeoutMs: 20,
  });

  assert.equal(snapshot.live, null);
  assert.equal(snapshot.radio?.programName, "湘南シーサイドサークル");
  assert.equal(snapshot.schedule?.ok, true);
});

test("13. invalid JSON is skipped per API", async () => {
  const fetchImpl: MilyRealtimeFetch = async (input) => {
    if (input === MILY_LIVE_URL) {
      return new Response("{not-json", { status: 200 });
    }
    const body = input === MILY_RADIO_URL ? validRadio : validSchedule;
    return jsonResponse(body, { url: input });
  };

  const snapshot = await fetchMilyRealtimeSnapshot({
    fetchImpl,
    logger: silentLogger,
  });

  assert.equal(snapshot.live, null);
  assert.ok(snapshot.radio);
  assert.ok(snapshot.schedule);
});

test("14. HTTP error is skipped per API", async () => {
  const fetchImpl: MilyRealtimeFetch = async (input) => {
    if (input === MILY_RADIO_URL) {
      return jsonResponse({ error: "nope" }, { status: 503, url: input });
    }
    const body = input === MILY_LIVE_URL ? validLive : validSchedule;
    return jsonResponse(body, { url: input });
  };

  const snapshot = await fetchMilyRealtimeSnapshot({
    fetchImpl,
    logger: silentLogger,
  });

  assert.ok(snapshot.live);
  assert.equal(snapshot.radio, null);
  assert.ok(snapshot.schedule);
});

test("15. unexpected redirect origin is rejected", async () => {
  const snapshot = await fetchMilyRealtimeSnapshot({
    fetchImpl: mappedFetch(
      {
        [MILY_LIVE_URL]: validLive,
        [MILY_RADIO_URL]: validRadio,
        [MILY_SCHEDULE_URL]: validSchedule,
      },
      {
        [MILY_LIVE_URL]: "https://evil.example/api/mily-live",
      },
    ),
    logger: silentLogger,
  });

  assert.equal(snapshot.live, null);
  assert.ok(snapshot.radio);
  assert.ok(snapshot.schedule);
});

test("schema mismatch is skipped", async () => {
  const snapshot = await fetchMilyRealtimeSnapshot({
    fetchImpl: mappedFetch({
      [MILY_LIVE_URL]: { ok: true, live: { state: "probably-live" } },
      [MILY_RADIO_URL]: validRadio,
      [MILY_SCHEDULE_URL]: validSchedule,
    }),
    logger: silentLogger,
  });

  assert.equal(snapshot.live, null);
  assert.ok(snapshot.radio);
});

test("requests use isolated revalidate windows", async () => {
  const received = new Map<string, number | undefined>();

  const fetchImpl: MilyRealtimeFetch = async (input, init) => {
    received.set(input, init?.next?.revalidate);
    const body =
      input === MILY_LIVE_URL
        ? validLive
        : input === MILY_RADIO_URL
          ? validRadio
          : validSchedule;
    return jsonResponse(body, { url: input });
  };

  await fetchMilyRealtimeSnapshot({
    fetchImpl,
    logger: silentLogger,
  });

  assert.equal(MILY_LIVE_REVALIDATE_SECONDS, 60);
  assert.equal(MILY_RADIO_REVALIDATE_SECONDS, 180);
  assert.equal(MILY_SCHEDULE_REVALIDATE_SECONDS, 300);
  assert.equal(received.get(MILY_LIVE_URL), 60);
  assert.equal(received.get(MILY_RADIO_URL), 180);
  assert.equal(received.get(MILY_SCHEDULE_URL), 300);
});

test("all three sources failing still returns a snapshot", async () => {
  const snapshot = await fetchMilyRealtimeSnapshot({
    fetchImpl: async () => {
      throw new Error("offline");
    },
    logger: silentLogger,
  });

  assert.deepEqual(snapshot, { live: null, radio: null, schedule: null });
});

test("production-shaped payloads satisfy the child contracts", () => {
  assert.equal(MilyLivePayloadSchema.safeParse(validLive).success, true);
  assert.equal(MilyRadioStatusSchema.safeParse(validRadio).success, true);
  assert.equal(MilySchedulePayloadSchema.safeParse(validSchedule).success, true);
});

import { MILY_SITE_ORIGIN } from "@/data/mily-links";
import {
  MilyLivePayloadSchema,
  MilyRadioStatusSchema,
  MilySchedulePayloadSchema,
  type MilyLivePayload,
  type MilyRadioStatus,
  type MilySchedulePayload,
} from "@/lib/mily-realtime-schema";

/**
 * Portal Feed の 5 分 cache とは分離する。
 * poll 間隔は child の useMilyRealtimeStatus / useStreamSchedule に合わせる。
 *   SHOWROOM: LIVE_POLL_MS = 60_000
 *   radio:    RADIO_POLL_MS = 180_000
 *   schedule: SCHEDULE_TTL_MS = 5 * 60 * 1000
 */
export const MILY_LIVE_REVALIDATE_SECONDS = 60;
export const MILY_RADIO_REVALIDATE_SECONDS = 180;
export const MILY_SCHEDULE_REVALIDATE_SECONDS = 300;
export const MILY_REALTIME_TIMEOUT_MS = 8_000;

export const MILY_LIVE_URL = `${MILY_SITE_ORIGIN}/api/mily-live`;
export const MILY_RADIO_URL = `${MILY_SITE_ORIGIN}/api/mily-radio-status`;
export const MILY_SCHEDULE_URL = `${MILY_SITE_ORIGIN}/api/mily-schedule`;

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

export type MilyRealtimeFetch = (
  input: string,
  init?: NextFetchInit,
) => Promise<Response>;

type MilyRealtimeLogger = Pick<Console, "warn">;

export type MilyRealtimeSnapshot = Readonly<{
  live: MilyLivePayload | null;
  radio: MilyRadioStatus | null;
  schedule: MilySchedulePayload | null;
}>;

export type FetchMilyRealtimeOptions = Readonly<{
  fetchImpl?: MilyRealtimeFetch;
  timeoutMs?: number;
  logger?: MilyRealtimeLogger;
}>;

function expectedOrigin(url: string): string {
  return new URL(url).origin;
}

function assertExpectedOrigin(response: Response, requestUrl: string): void {
  const expected = expectedOrigin(requestUrl);
  const finalUrl = response.url || requestUrl;
  let origin: string;

  try {
    origin = new URL(finalUrl).origin;
  } catch {
    throw new Error("Response URL is not a valid absolute URL");
  }

  if (origin !== expected) {
    throw new Error(`Unexpected origin ${origin}, expected ${expected}`);
  }
}

async function fetchJsonFromMily(
  url: string,
  fetchImpl: MilyRealtimeFetch,
  timeoutMs: number,
  revalidateSeconds: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: revalidateSeconds },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    assertExpectedOrigin(response, url);

    try {
      return await response.json();
    } catch (error) {
      throw new Error("Invalid JSON", { cause: error });
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Timed out after ${timeoutMs}ms`, { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOne<T>(
  label: string,
  url: string,
  revalidateSeconds: number,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  fetchImpl: MilyRealtimeFetch,
  timeoutMs: number,
  logger: MilyRealtimeLogger,
): Promise<T | null> {
  try {
    const payload = await fetchJsonFromMily(
      url,
      fetchImpl,
      timeoutMs,
      revalidateSeconds,
    );
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      throw new Error(`${label} schema validation failed`);
    }

    return parsed.data;
  } catch (error) {
    logger.warn(`[mily-realtime] ${label} skipped`, error);
    return null;
  }
}

export async function fetchMilyRealtimeSnapshot(
  options: FetchMilyRealtimeOptions = {},
): Promise<MilyRealtimeSnapshot> {
  const fetchImpl = options.fetchImpl ?? (fetch as MilyRealtimeFetch);
  const timeoutMs = options.timeoutMs ?? MILY_REALTIME_TIMEOUT_MS;
  const logger = options.logger ?? console;

  const [live, radio, schedule] = await Promise.all([
    fetchOne(
      "live",
      MILY_LIVE_URL,
      MILY_LIVE_REVALIDATE_SECONDS,
      MilyLivePayloadSchema,
      fetchImpl,
      timeoutMs,
      logger,
    ),
    fetchOne(
      "radio",
      MILY_RADIO_URL,
      MILY_RADIO_REVALIDATE_SECONDS,
      MilyRadioStatusSchema,
      fetchImpl,
      timeoutMs,
      logger,
    ),
    fetchOne(
      "schedule",
      MILY_SCHEDULE_URL,
      MILY_SCHEDULE_REVALIDATE_SECONDS,
      MilySchedulePayloadSchema,
      fetchImpl,
      timeoutMs,
      logger,
    ),
  ]);

  return { live, radio, schedule };
}

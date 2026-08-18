import {
  PortalFeedSchema,
  type PersonId,
  type PortalFeed,
} from "@/lib/feed-schema";

export const PORTAL_FEED_REVALIDATE_SECONDS = 300;
export const PORTAL_FEED_TIMEOUT_MS = 7_000;

export type PortalFeedSource = Readonly<{
  personId: PersonId;
  url: string;
}>;

export const PORTAL_FEED_SOURCES = [
  {
    personId: "mily",
    url: "https://mily-fan-site.vercel.app/portal-feed.json",
  },
  {
    personId: "yukako",
    url: "https://yukako-schedule-2026.vercel.app/portal-feed.json",
  },
  {
    personId: "riri",
    url: "https://riri-schedule-2026.vercel.app/portal-feed.json",
  },
  {
    personId: "chizuru",
    url: "https://chizuru-ito-archive.tasty-mite-7025.chatgpt.site/portal-feed.json",
  },
  {
    personId: "mako",
    url: "https://mako-schedule-2026.vercel.app/portal-feed.json",
  },
] as const satisfies readonly PortalFeedSource[];

type NextFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

export type PortalFeedFetch = (
  input: string,
  init?: NextFetchInit,
) => Promise<Response>;

type PortalFeedLogger = Pick<Console, "warn">;

type FetchPortalFeedsOptions = Readonly<{
  sources?: readonly PortalFeedSource[];
  fetchImpl?: PortalFeedFetch;
  timeoutMs?: number;
  logger?: PortalFeedLogger;
}>;

async function fetchPortalFeed(
  source: PortalFeedSource,
  fetchImpl: PortalFeedFetch,
  timeoutMs: number,
): Promise<PortalFeed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(source.url, {
      headers: { Accept: "application/json" },
      next: { revalidate: PORTAL_FEED_REVALIDATE_SECONDS },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("Invalid JSON", { cause: error });
    }

    const parsed = PortalFeedSchema.safeParse(payload);

    if (!parsed.success) {
      throw new Error("PortalFeedSchema validation failed", {
        cause: parsed.error,
      });
    }

    if (parsed.data.personId !== source.personId) {
      throw new Error(
        `Expected personId ${source.personId}, received ${parsed.data.personId}`,
      );
    }

    const sourceOrigin = new URL(source.url).origin;
    const feedOrigin = new URL(parsed.data.siteUrl).origin;

    if (feedOrigin !== sourceOrigin) {
      throw new Error(
        `Expected site origin ${sourceOrigin}, received ${feedOrigin}`,
      );
    }

    return parsed.data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Timed out after ${timeoutMs}ms`, { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPortalFeeds(
  options: FetchPortalFeedsOptions = {},
): Promise<PortalFeed[]> {
  const sources = options.sources ?? PORTAL_FEED_SOURCES;
  const fetchImpl = options.fetchImpl ?? (fetch as PortalFeedFetch);
  const timeoutMs = options.timeoutMs ?? PORTAL_FEED_TIMEOUT_MS;
  const logger = options.logger ?? console;

  const results = await Promise.allSettled(
    sources.map((source) => fetchPortalFeed(source, fetchImpl, timeoutMs)),
  );

  const feeds: PortalFeed[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      feeds.push(result.value);
      return;
    }

    const source = sources[index];
    logger.warn(`[portal-feed] ${source.personId} feed skipped`, result.reason);
  });

  return feeds;
}

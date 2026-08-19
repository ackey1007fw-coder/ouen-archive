import assert from "node:assert/strict";
import test from "node:test";

import type { PersonId, PortalFeed } from "@/lib/feed-schema";
import {
  PORTAL_FEED_REVALIDATE_SECONDS,
  PORTAL_FEED_SOURCES,
  fetchPortalFeeds,
  type PortalFeedFetch,
  type PortalFeedSource,
} from "@/lib/portal-feeds";

const silentLogger = { warn: () => undefined };

function getSourceSiteUrl(personId: PersonId): string {
  const source = PORTAL_FEED_SOURCES.find(
    (candidate) => candidate.personId === personId,
  )!;

  return `${new URL(source.url).origin}/`;
}

function makeFeed(
  personId: PersonId,
  itemCount = 1,
  siteUrl = getSourceSiteUrl(personId),
): PortalFeed {
  const siteOrigin = new URL(siteUrl).origin;

  return {
    generatedAt: "2026-08-19T00:00:00+09:00",
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `${personId}:item-${index}`,
      personId,
      publishedAt: `2026-08-1${9 - index}T12:00:00+09:00`,
      title: `${personId} update ${index}`,
      type: "news" as const,
      url: `${siteOrigin}/${personId}/${index}`,
    })),
    personId,
    siteName: `${personId} support site`,
    siteUrl,
    version: 1,
  };
}

function responseFor(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function sourceMap(): Map<string, PortalFeed> {
  return new Map(
    PORTAL_FEED_SOURCES.map((source) => [
      source.url,
      makeFeed(source.personId),
    ]),
  );
}

function mappedFetch(feeds: Map<string, PortalFeed>): PortalFeedFetch {
  return async (input) => responseFor(feeds.get(input));
}

test("accepts all five valid feeds in fixed source order", async () => {
  const feeds = await fetchPortalFeeds({
    fetchImpl: mappedFetch(sourceMap()),
    logger: silentLogger,
  });

  assert.deepEqual(
    feeds.map((feed) => feed.personId),
    ["mily", "yukako", "riri", "chizuru", "mako"],
  );
});

test("keeps four feeds when one source times out", async () => {
  const feeds = sourceMap();
  const timeoutUrl = PORTAL_FEED_SOURCES[2].url;
  const fetchImpl: PortalFeedFetch = (input, init) => {
    if (input !== timeoutUrl) return Promise.resolve(responseFor(feeds.get(input)));

    return new Promise((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  };

  const result = await fetchPortalFeeds({
    fetchImpl,
    logger: silentLogger,
    timeoutMs: 20,
  });

  assert.deepEqual(
    result.map((feed) => feed.personId),
    ["mily", "yukako", "chizuru", "mako"],
  );
});

test("skips invalid JSON and keeps the remaining feeds", async () => {
  const feeds = sourceMap();
  const invalidUrl = PORTAL_FEED_SOURCES[1].url;
  const fetchImpl: PortalFeedFetch = async (input) =>
    input === invalidUrl
      ? new Response("{not-json", { status: 200 })
      : responseFor(feeds.get(input));

  const result = await fetchPortalFeeds({
    fetchImpl,
    logger: silentLogger,
  });

  assert.equal(result.length, 4);
  assert.ok(result.every((feed) => feed.personId !== "yukako"));
});

test("skips a Zod-invalid feed", async () => {
  const source = PORTAL_FEED_SOURCES[0];
  const invalidFeed = { ...makeFeed("mily"), version: 2 };

  const result = await fetchPortalFeeds({
    fetchImpl: async () => responseFor(invalidFeed),
    logger: silentLogger,
    sources: [source],
  });

  assert.deepEqual(result, []);
});

test("skips a valid feed whose personId does not match its source", async () => {
  const source = PORTAL_FEED_SOURCES[0];
  const sourceSiteUrl = `${new URL(source.url).origin}/`;

  const result = await fetchPortalFeeds({
    fetchImpl: async () =>
      responseFor(makeFeed("yukako", 1, sourceSiteUrl)),
    logger: silentLogger,
    sources: [source],
  });

  assert.deepEqual(result, []);
});

test("skips a feed whose siteUrl origin does not match its source", async () => {
  const source = PORTAL_FEED_SOURCES[0];
  const wrongSiteFeed = makeFeed("mily", 1, "https://wrong.example/");

  const result = await fetchPortalFeeds({
    fetchImpl: async () => responseFor(wrongSiteFeed),
    logger: silentLogger,
    sources: [source],
  });

  assert.deepEqual(result, []);
});

test("accepts an empty MAKO feed", async () => {
  const source: PortalFeedSource = PORTAL_FEED_SOURCES[4];

  const result = await fetchPortalFeeds({
    fetchImpl: async () => responseFor(makeFeed("mako", 0)),
    logger: silentLogger,
    sources: [source],
  });

  assert.equal(result.length, 1);
  assert.deepEqual(result[0].items, []);
});

test("returns an empty collection when every source fails", async () => {
  const result = await fetchPortalFeeds({
    fetchImpl: async () => {
      throw new Error("offline");
    },
    logger: silentLogger,
  });

  assert.deepEqual(result, []);
});

test("requests feeds with a timeout signal and a 300-second revalidate", async () => {
  const source = PORTAL_FEED_SOURCES[0];
  let receivedInit: Parameters<PortalFeedFetch>[1];

  await fetchPortalFeeds({
    fetchImpl: async (_input, init) => {
      receivedInit = init;
      return responseFor(makeFeed("mily"));
    },
    logger: silentLogger,
    sources: [source],
  });

  assert.equal(PORTAL_FEED_REVALIDATE_SECONDS, 300);
  assert.ok(receivedInit?.signal instanceof AbortSignal);
  assert.equal(receivedInit?.next?.revalidate, 300);
});

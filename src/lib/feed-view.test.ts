import assert from "node:assert/strict";
import test from "node:test";

import type { PersonId, PortalFeedItem } from "@/lib/feed-schema";
import { selectLatestUpdates, selectTodayItems } from "@/lib/feed-view";

function makeItem(
  personId: PersonId,
  id: string,
  overrides: Partial<PortalFeedItem> = {},
): PortalFeedItem {
  return {
    id: `${personId}:${id}`,
    personId,
    publishedAt: "2026-08-19T12:00:00+09:00",
    title: id,
    type: "schedule",
    url: `https://example.com/${personId}/${id}`,
    ...overrides,
  };
}

test("sorts LATEST by publishedAt descending", () => {
  const result = selectLatestUpdates([
    makeItem("mily", "older", {
      publishedAt: "2026-08-18T12:00:00+09:00",
    }),
    makeItem("mako", "newer", {
      publishedAt: "2026-08-19T12:00:00+09:00",
    }),
  ]);

  assert.deepEqual(
    result.map((item) => item.id),
    ["mako:newer", "mily:older"],
  );
});

test("uses fixed person order and item id for deterministic LATEST ties", () => {
  const result = selectLatestUpdates([
    makeItem("yukako", "b"),
    makeItem("mily", "z"),
    makeItem("yukako", "a"),
  ]);

  assert.deepEqual(
    result.map((item) => item.id),
    ["mily:z", "yukako:a", "yukako:b"],
  );
});

test("uses Asia/Tokyo rather than the UTC date for TODAY", () => {
  const now = new Date("2026-08-19T03:00:00Z");
  const result = selectTodayItems(
    [
      makeItem("mily", "tokyo-today", {
        startsAt: "2026-08-19T00:30:00+09:00",
      }),
      makeItem("yukako", "utc-same-but-tokyo-tomorrow", {
        startsAt: "2026-08-20T00:30:00+09:00",
      }),
    ],
    now,
  );

  assert.deepEqual(result.map((item) => item.id), ["mily:tokyo-today"]);
});

test("sorts TODAY by startsAt, fixed person order, then item id", () => {
  const now = new Date("2026-08-19T00:00:00+09:00");
  const result = selectTodayItems(
    [
      makeItem("riri", "later", {
        startsAt: "2026-08-19T19:30:00+09:00",
      }),
      makeItem("yukako", "b", {
        startsAt: "2026-08-19T12:30:00+09:00",
      }),
      makeItem("mily", "z", {
        startsAt: "2026-08-19T12:30:00+09:00",
      }),
      makeItem("yukako", "a", {
        startsAt: "2026-08-19T12:30:00+09:00",
      }),
    ],
    now,
  );

  assert.deepEqual(
    result.map((item) => item.id),
    ["mily:z", "yukako:a", "yukako:b", "riri:later"],
  );
});

test("excludes items without startsAt and non-schedule item types", () => {
  const now = new Date("2026-08-19T00:00:00+09:00");
  const result = selectTodayItems(
    [
      makeItem("mily", "missing-start"),
      makeItem("yukako", "news-with-start", {
        startsAt: "2026-08-19T12:30:00+09:00",
        type: "news",
      }),
    ],
    now,
  );

  assert.deepEqual(result, []);
});

test("keeps a started item while it remains the same JST day", () => {
  const now = new Date("2026-08-19T20:00:00+09:00");
  const result = selectTodayItems(
    [
      makeItem("mily", "started", {
        startsAt: "2026-08-19T12:30:00+09:00",
      }),
    ],
    now,
  );

  assert.deepEqual(result.map((item) => item.id), ["mily:started"]);
});

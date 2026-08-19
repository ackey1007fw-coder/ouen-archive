import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { PortalFeedSections } from "@/components/PortalFeedSections";
import type { PortalFeedItem } from "@/lib/feed-schema";

test("renders safely with no feed items", () => {
  const html = renderToStaticMarkup(
    <PortalFeedSections
      items={[]}
      now={new Date("2026-08-19T12:00:00+09:00")}
    />,
  );

  assert.match(html, /LATEST UPDATES/);
  assert.doesNotMatch(html, /TODAY/);
});

test("renders a static planned item without realtime wording", () => {
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

  assert.match(html, /本日 19:30/);
  assert.match(html, /夜の予定/);
  assert.doesNotMatch(html, /配信中|開催中|LIVE NOW|ON AIR/);
});

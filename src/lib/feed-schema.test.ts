import assert from "node:assert/strict";
import test from "node:test";

import { PortalFeedSchema } from "@/lib/feed-schema";

function makeFeed(itemOverrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-08-19T00:00:00+09:00",
    items: [
      {
        id: "riri:update-1",
        personId: "riri",
        publishedAt: "2026-08-18T12:00:00+09:00",
        title: "Riri update",
        type: "news",
        url: "https://riri-schedule-2026.vercel.app/updates/1",
        ...itemOverrides,
      },
    ],
    personId: "riri",
    siteName: "Riri support site",
    siteUrl: "https://riri-schedule-2026.vercel.app/",
    version: 1,
  };
}

test("accepts the shared contract without arbitrary string maximums", () => {
  const longTitle = "里季".repeat(101);
  const feed = {
    ...makeFeed({
      id: `riri:${"i".repeat(200)}`,
      summary: "s".repeat(501),
      title: longTitle,
    }),
    siteName: "Riri".repeat(26),
  };

  assert.ok(longTitle.length > 200);

  const result = PortalFeedSchema.safeParse(feed);

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.items[0].title, longTitle);
  }
});

test("accepts a same-origin item URL", () => {
  const result = PortalFeedSchema.safeParse(makeFeed());

  assert.equal(result.success, true);
});

test("rejects an external item URL", () => {
  const result = PortalFeedSchema.safeParse(
    makeFeed({ url: "https://external.example/riri/update-1" }),
  );

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(
      result.error.issues.some(
        (issue) => issue.path.join(".") === "items.0.url",
      ),
    );
  }
});

test("accepts an external sourceUrl", () => {
  const result = PortalFeedSchema.safeParse(
    makeFeed({ sourceUrl: "https://x.com/example/status/1" }),
  );

  assert.equal(result.success, true);
});

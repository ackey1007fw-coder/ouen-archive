import assert from "node:assert/strict";
import test from "node:test";

import { supportCampaigns } from "@/data/support-campaigns";
import type { PersonId, PortalFeedItem } from "@/lib/feed-schema";
import { selectSupportSpotlightItems } from "@/lib/support-spotlight";

function schedule(
  personId: PersonId,
  id: string,
  startsAt: string,
  title = id,
): PortalFeedItem {
  return {
    id: `${personId}:${id}`,
    personId,
    publishedAt: "2026-08-29T00:00:00+09:00",
    startsAt,
    title,
    type: "schedule",
    url: `https://${personId}.example/${id}`,
  };
}

test("shows the active Paton vote and the upcoming third round on August 30", () => {
  const items = selectSupportSpotlightItems({
    campaigns: supportCampaigns,
    feedItems: [],
    now: new Date("2026-08-30T12:00:00+09:00"),
  });

  assert.deepEqual(
    items.slice(0, 2).map(({ id, state }) => [id, state]),
    [
      ["campaign:mily-campus-girls-paton-final-2026", "active"],
      ["campaign:mily-miss-circle-third-round-2026", "upcoming"],
    ],
  );
  assert.match(items[0].timingLabel, /9\/1 23:59まで/);
  assert.match(items[1].timingLabel, /9\/3 12:00から/);
});

test("expires Paton automatically and activates the third round", () => {
  const items = selectSupportSpotlightItems({
    campaigns: supportCampaigns,
    feedItems: [],
    now: new Date("2026-09-03T12:00:00+09:00"),
  });

  assert.ok(
    !items.some(({ id }) =>
      id.includes("mily-campus-girls-paton-final-2026"),
    ),
  );
  const thirdRound = items.find(({ id }) =>
    id.includes("mily-miss-circle-third-round-2026"),
  );
  assert.equal(thirdRound?.state, "active");
});

test("adds only the nearest future schedule for each person", () => {
  const items = selectSupportSpotlightItems({
    campaigns: [],
    feedItems: [
      schedule("riri", "later", "2026-09-15T18:00:00+09:00"),
      schedule("yukako", "fukuyama", "2026-09-19T11:30:00+09:00"),
      schedule("riri", "homin", "2026-09-11T19:00:00+09:00"),
      schedule("mako", "past", "2026-08-20T12:00:00+09:00"),
    ],
    now: new Date("2026-08-30T12:00:00+09:00"),
  });

  assert.deepEqual(items.map(({ id }) => id), [
    "schedule:riri:homin",
    "schedule:yukako:fukuyama",
  ]);
  assert.ok(items.every(({ external }) => !external));
});

test("keeps time-bounded campaigns ahead of upcoming schedules", () => {
  const items = selectSupportSpotlightItems({
    campaigns: supportCampaigns,
    feedItems: [
      schedule("riri", "homin", "2026-09-11T19:00:00+09:00"),
      schedule("yukako", "fukuyama", "2026-09-19T11:30:00+09:00"),
      schedule("chizuru", "later", "2026-09-21T12:00:00+09:00"),
    ],
    now: new Date("2026-08-30T12:00:00+09:00"),
  });

  assert.equal(items.length, 4);
  assert.deepEqual(items.slice(0, 2).map(({ id }) => id), [
    "campaign:mily-campus-girls-paton-final-2026",
    "campaign:mily-miss-circle-third-round-2026",
  ]);
});

test("shows the confirmed Riri and Yukako stage notices without feed data", () => {
  const items = selectSupportSpotlightItems({
    campaigns: supportCampaigns,
    feedItems: [],
    now: new Date("2026-08-30T12:00:00+09:00"),
  });

  assert.deepEqual(items.slice(2).map(({ personId }) => personId), [
    "riri",
    "yukako",
  ]);
  assert.equal(items[2].stateLabel, "出演予定");
  assert.equal(items[2].external, false);
  assert.equal(items[3].timingLabel, "9/19 福山・9/20 久留米");
});

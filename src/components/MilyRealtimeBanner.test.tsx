import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MilyRealtimeBanner } from "@/components/MilyRealtimeBanner";
import type { MilyRealtimeBanner as Banner } from "@/lib/mily-realtime-state";
import { MILY_SHOWROOM_URL, MILY_SITE_URL } from "@/data/mily-links";

const css = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

const liveBanner: Banner = {
  kind: "showroom-live",
  stateLabel: "配信中",
  title: "みりぃがSHOWROOMで配信しています",
  href: MILY_SHOWROOM_URL,
  linkLabel: "配信を見に行く",
};

const radioBanner: Banner = {
  kind: "radio-on-air",
  stateLabel: "放送中",
  title: "みりぃの担当番組「湘南シーサイドサークル」が放送中です",
  href: MILY_SITE_URL,
  linkLabel: "詳しく見る",
};

const upcomingBanner: Banner = {
  kind: "upcoming-schedule",
  stateLabel: "このあと",
  title: "みりぃの配信予定があります",
  detail: "21:00〜",
  href: MILY_SITE_URL,
  linkLabel: "予定を見る",
};

test("renders nothing when the banner is hidden", () => {
  const html = renderToStaticMarkup(<MilyRealtimeBanner banner={null} />);
  assert.equal(html, "");
});

test("verified live uses a red accent and external safety attrs", () => {
  const html = renderToStaticMarkup(
    <MilyRealtimeBanner banner={liveBanner} />,
  );

  assert.match(html, /配信中/);
  assert.match(html, /realtime-banner--showroom-live/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, new RegExp(MILY_SHOWROOM_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("radio and upcoming do not use the live class", () => {
  const radio = renderToStaticMarkup(
    <MilyRealtimeBanner banner={radioBanner} />,
  );
  const upcoming = renderToStaticMarkup(
    <MilyRealtimeBanner banner={upcomingBanner} />,
  );

  assert.match(radio, /放送中/);
  assert.match(radio, /担当番組/);
  assert.match(radio, /湘南シーサイドサークル/);
  assert.doesNotMatch(
    radio,
    /みりぃ出演ラジオ|みりぃが出演中|みりぃが放送中|みりぃ出演中|みりぃがラジオ出演中/,
  );
  assert.doesNotMatch(radio, /realtime-banner--showroom-live/);
  assert.match(upcoming, /このあと/);
  assert.doesNotMatch(upcoming, /配信中|LIVE NOW|ON AIR/);
  assert.doesNotMatch(upcoming, /realtime-banner--showroom-live/);
});

test("20. prefers-reduced-motion disables the live pulse", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /realtime-banner--showroom-live \.realtime-dot/);
  assert.match(css, /animation:\s*none\s*!important/);
  assert.match(css, /prefers-reduced-motion:\s*no-preference/);
  assert.match(css, /realtime-live-pulse/);
  assert.match(css, /min-height:\s*2\.75rem/);
});

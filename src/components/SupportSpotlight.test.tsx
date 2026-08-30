import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SupportSpotlight } from "@/components/SupportSpotlight";
import type { SupportSpotlightItem } from "@/lib/support-spotlight";

const directAction: SupportSpotlightItem = {
  id: "campaign:paton",
  personId: "mily",
  state: "active",
  stateLabel: "受付中",
  kindLabel: "投票",
  timingLabel: "9/1 23:59まで",
  title: "Paton投票",
  summary: "1日1回応援できます。",
  href: "https://paton.jp/event/entrant/11380",
  ctaLabel: "Patonで投票する",
  external: true,
  sortAt: 1,
  priority: 100,
};

test("renders a direct action plus a clear fan-site route", () => {
  const html = renderToStaticMarkup(
    <SupportSpotlight items={[directAction]} realtimeBanner={null} />,
  );

  assert.match(html, /いま応援してほしいこと/);
  assert.match(html, /Patonで投票する/);
  assert.match(html, /受付中/);
  assert.match(html, /三橋莉子のファンサイトへ/);
  assert.match(
    html,
    /href="https:\/\/paton\.jp\/event\/entrant\/11380"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
  );
  assert.match(
    html,
    /href="https:\/\/mily-fan-site\.vercel\.app\/"/,
  );
});

test("renders nothing when there is no current action or realtime banner", () => {
  const html = renderToStaticMarkup(
    <SupportSpotlight items={[]} realtimeBanner={null} />,
  );

  assert.equal(html, "");
});

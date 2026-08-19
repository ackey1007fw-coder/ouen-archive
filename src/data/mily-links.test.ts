import assert from "node:assert/strict";
import test from "node:test";

import {
  MILY_RADIO_LISTEN_URL,
  MILY_RADIO_PLAYER_URL,
  MILY_SHOWROOM_URL,
  MILY_SITE_URL,
  isAllowlistedHref,
  isAllowlistedShowroomUrl,
  sanitizeMilyHref,
} from "@/data/mily-links";

test("19. allowlists only confirmed SHOWROOM / radio / mily origins", () => {
  assert.equal(isAllowlistedShowroomUrl(MILY_SHOWROOM_URL), true);
  assert.equal(isAllowlistedHref(MILY_SITE_URL), true);
  assert.equal(isAllowlistedHref(MILY_RADIO_LISTEN_URL), true);
  assert.equal(isAllowlistedHref(MILY_RADIO_PLAYER_URL), true);

  assert.equal(isAllowlistedHref("https://evil.example/live"), false);
  assert.equal(isAllowlistedHref("http://www.showroom-live.com/r/circle2026_0734"), false);
  assert.equal(
    isAllowlistedShowroomUrl("https://www.showroom-live.com/r/someone_else"),
    false,
  );
  assert.equal(
    isAllowlistedHref("https://www.showroom-live.com/r/circle2026_0734?q=1"),
    false,
  );
  assert.equal(isAllowlistedHref("javascript:alert(1)"), false);
});

test("sanitizeMilyHref falls back to the mily site", () => {
  assert.equal(sanitizeMilyHref("https://evil.example"), MILY_SITE_URL);
  assert.equal(sanitizeMilyHref(null), MILY_SITE_URL);
  assert.equal(sanitizeMilyHref(MILY_SHOWROOM_URL), MILY_SHOWROOM_URL);
  assert.equal(
    sanitizeMilyHref("https://evil.example", MILY_SHOWROOM_URL),
    MILY_SHOWROOM_URL,
  );
});

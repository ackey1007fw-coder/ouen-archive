import assert from "node:assert/strict";
import test from "node:test";

import { PERSON_ORDER } from "@/data/persons";
import {
  OG_ACCENT_HEIGHT,
  OG_BAND_HEIGHT,
  OG_HEIGHT,
  OG_PORTRAITS,
  OG_STRIP_HEIGHT,
  OG_WIDTH,
  ogPortraitOrderMatchesPortal,
} from "@/lib/og-portraits";

test("share image keeps the portal's fixed person order", () => {
  assert.equal(ogPortraitOrderMatchesPortal(), true);
  assert.deepEqual(
    OG_PORTRAITS.map((portrait) => portrait.personId),
    ["mily", "yukako", "riri", "chizuru"],
  );
});

test("share image omits MAKO by owner decision", () => {
  assert.ok(PERSON_ORDER.includes("mako"));
  assert.equal(
    OG_PORTRAITS.some((portrait) => portrait.personId === "mako"),
    false,
  );
});

test("portrait tiles fill the canvas width exactly", () => {
  const total = OG_PORTRAITS.reduce(
    (sum, portrait) => sum + portrait.width,
    0,
  );
  assert.equal(total, OG_WIDTH);
});

test("Mily's tile is the widest so she reads first", () => {
  const widest = Math.max(...OG_PORTRAITS.map((portrait) => portrait.width));
  assert.equal(OG_PORTRAITS[0]?.personId, "mily");
  assert.equal(OG_PORTRAITS[0]?.width, widest);
});

test("strip, accent rule and title band fill the canvas height", () => {
  assert.equal(
    OG_STRIP_HEIGHT + OG_ACCENT_HEIGHT + OG_BAND_HEIGHT,
    OG_HEIGHT,
  );
});

test("every tile is cropped from an in-repo portrait", () => {
  for (const portrait of OG_PORTRAITS) {
    assert.match(portrait.sourcePortrait, /^\/portraits\/.+\.jpg$/);
    assert.match(portrait.file, /^[a-z-]+\.jpg$/);
  }
});

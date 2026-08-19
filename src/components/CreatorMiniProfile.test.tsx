import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CreatorMiniProfile } from "@/components/CreatorMiniProfile";
import {
  CREATOR_GITHUB_URL,
  CREATOR_LINKS,
  CREATOR_X_URL,
} from "@/data/creator";

const html = renderToStaticMarkup(<CreatorMiniProfile />);

test("creator section shows the creator display name", () => {
  assert.match(html, /あっきー 🌻🌴/);
  assert.match(html, /ABOUT THIS ARCHIVE/);
  assert.match(html, /このサイトをつくっている人/);
});

test("creator X URL is the fixed constant", () => {
  assert.equal(CREATOR_X_URL, "https://x.com/ackey_RiRi_supp");
  assert.match(html, /href="https:\/\/x\.com\/ackey_RiRi_supp"/);
});

test("creator GitHub URL is the fixed constant", () => {
  assert.equal(CREATOR_GITHUB_URL, "https://github.com/ackey1007fw-coder");
  assert.match(html, /href="https:\/\/github\.com\/ackey1007fw-coder"/);
});

test("creator links open in a new tab safely and announce it", () => {
  const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
  assert.equal(anchors.length, CREATOR_LINKS.length);

  for (const anchor of anchors) {
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
  }

  const announcements = [...html.matchAll(/新しいタブで開きます/g)];
  assert.equal(announcements.length, CREATOR_LINKS.length);
});

test("creator section ships only the two approved external origins", () => {
  const origins = new Set(
    [...html.matchAll(/href="(https?:\/\/[^/"]+)/g)].map((match) => match[1]),
  );

  assert.deepEqual(
    [...origins].sort(),
    ["https://github.com", "https://x.com"],
  );
});

test("creator section is labelled by its own heading", () => {
  assert.match(html, /<section[^>]*aria-labelledby="creator-title"/);
  assert.match(html, /<h2 id="creator-title">/);
  assert.doesNotMatch(html, /<h1\b/);
});

test("creator section does not reuse the person card component", () => {
  assert.doesNotMatch(html, /person-card|person-grid|person-name/);
});

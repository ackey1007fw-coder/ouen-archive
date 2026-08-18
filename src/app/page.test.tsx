import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "@/app/page";

test("the full page renders when all five feeds fail", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;

  globalThis.fetch = async () => {
    throw new Error("offline fixture");
  };
  console.warn = () => undefined;

  try {
    const html = renderToStaticMarkup(await Home());

    assert.match(html, /応援の入口を、/);
    assert.match(html, /5つの応援サイトを見る/);
    assert.match(html, /LATEST UPDATES/);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

/**
 * みりぃ応援サイト内の確認済みリンク（Single Source of Truth）。
 * 出典: ackey1007fw-coder/mily-fan-site
 *   - SHOWROOM: src/data/socials.ts (id: showroom-circle2026-0734)
 *   - ラジオ聴取: shared/radio-program.js listenUrl
 *   - ラジオ再生: src/components/ActivityBanner.tsx RADIO_PLAYER_URL
 *
 * API レスポンスの任意 URL は、ここへ照合してからしか href に出さない。
 */

export const MILY_SITE_ORIGIN = "https://mily-fan-site.vercel.app";
export const MILY_SITE_URL = `${MILY_SITE_ORIGIN}/`;

export const MILY_SHOWROOM_URL =
  "https://www.showroom-live.com/r/circle2026_0734";

export const MILY_RADIO_LISTEN_URL = "https://fm-smw.jp/radio";
export const MILY_RADIO_PLAYER_URL = "https://www.jcbasimul.com/magicwave";

const SHOWROOM_ORIGIN = "https://www.showroom-live.com";
const SHOWROOM_PATHS = new Set([
  "/r/circle2026_0734",
  "/r/circle2026_0734/",
]);

const ALLOWED_ORIGINS = new Set([
  MILY_SITE_ORIGIN,
  SHOWROOM_ORIGIN,
  "https://fm-smw.jp",
  "https://www.jcbasimul.com",
]);

const ALLOWED_EXACT_HREFS = new Set([
  MILY_SITE_URL,
  MILY_SITE_ORIGIN,
  MILY_SHOWROOM_URL,
  `${MILY_SHOWROOM_URL}/`,
  MILY_RADIO_LISTEN_URL,
  `${MILY_RADIO_LISTEN_URL}/`,
  MILY_RADIO_PLAYER_URL,
  `${MILY_RADIO_PLAYER_URL}/`,
]);

export function normalizeHref(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function isAllowlistedOrigin(value: string): boolean {
  const url = normalizeHref(value);
  return url !== null && ALLOWED_ORIGINS.has(url.origin);
}

export function isAllowlistedShowroomUrl(value: string): boolean {
  const url = normalizeHref(value);
  if (!url) return false;
  if (url.origin !== SHOWROOM_ORIGIN) return false;
  return SHOWROOM_PATHS.has(url.pathname) && url.search === "" && url.hash === "";
}

export function isAllowlistedHref(value: string): boolean {
  const url = normalizeHref(value);
  if (!url) return false;
  if (ALLOWED_EXACT_HREFS.has(url.href) || ALLOWED_EXACT_HREFS.has(value)) {
    return true;
  }
  if (url.origin === MILY_SITE_ORIGIN) {
    return url.search === "" && url.hash === "";
  }
  return isAllowlistedShowroomUrl(value);
}

export function sanitizeMilyHref(
  candidate: string | null | undefined,
  fallback: string = MILY_SITE_URL,
): string {
  if (typeof candidate === "string" && isAllowlistedHref(candidate)) {
    const url = normalizeHref(candidate);
    return url?.href ?? fallback;
  }
  return isAllowlistedHref(fallback) ? fallback : MILY_SITE_URL;
}

import { PERSON_ORDER } from "@/data/persons";
import type { PersonId } from "@/lib/feed-schema";

/**
 * Layout constants for the Open Graph share image (`src/app/opengraph-image.tsx`).
 *
 * The card is a portrait strip above a solid title band:
 *
 *   0                                     1200
 *   ┌──────────────────────────────────────┐ 0
 *   │  portrait strip (4 tiles, no gaps)   │
 *   ├──────────────────────────────────────┤ 420
 *   │  accent rule                          │ 426
 *   │  応援アーカイブ            夢と活動の記録 │
 *   └──────────────────────────────────────┘ 630
 */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_STRIP_HEIGHT = 420;
export const OG_ACCENT_HEIGHT = 6;
export const OG_BAND_HEIGHT = OG_HEIGHT - OG_STRIP_HEIGHT - OG_ACCENT_HEIGHT;

export type OgPortrait = Readonly<{
  personId: PersonId;
  /** Tile width on the 1200px canvas. Widths must total `OG_WIDTH`. */
  width: number;
  /**
   * Face-focused crop of the person's existing portrait in `public/portraits/`,
   * rendered at 1.5x the tile size. Cropping only — the source frames are never
   * retouched, recombined, or generated.
   */
  file: string;
  sourcePortrait: string;
}>;

/**
 * Who appears on the share image, in the portal's fixed person order.
 *
 * MAKO is intentionally absent: the owner asked for a share image built from
 * the other four members (see `docs/DECISION_LOG.md`, 2026-08-20). This is a
 * share-image-only exception — the portal itself still renders all five people
 * in the same fixed order with equal weight.
 */
export const OG_PORTRAITS: readonly OgPortrait[] = [
  {
    personId: "mily",
    width: 360,
    file: "mily.jpg",
    sourcePortrait: "/portraits/mily-b02-p46-1600.jpg",
  },
  {
    personId: "yukako",
    width: 290,
    file: "yukako.jpg",
    sourcePortrait: "/portraits/yukako-portrait.jpg",
  },
  {
    personId: "riri",
    width: 280,
    file: "riri.jpg",
    sourcePortrait: "/portraits/riri-portrait.jpg",
  },
  {
    personId: "chizuru",
    width: 270,
    file: "chizuru.jpg",
    sourcePortrait: "/portraits/chizuru-ito-portrait.jpg",
  },
] as const;

/** Person order on the share image must never diverge from the portal order. */
export function ogPortraitOrderMatchesPortal(): boolean {
  const shown = OG_PORTRAITS.map((portrait) => portrait.personId);
  const expected = PERSON_ORDER.filter((personId) => shown.includes(personId));
  return shown.join(",") === expected.join(",");
}

import type { PersonId } from "@/lib/feed-schema";

export const PERSON_ORDER = [
  "mily",
  "yukako",
  "riri",
  "chizuru",
  "mako",
] as const satisfies readonly PersonId[];

export type Person = Readonly<{
  id: PersonId;
  displayName: string;
  alternateName: string;
  description: string;
  siteUrl: string;
  image: string;
  imagePosition: string;
}>;

const PERSONS_BY_ID = {
  mily: {
    id: "mily",
    displayName: "三橋莉子",
    alternateName: "Mily / みりぃ",
    description:
      "みりぃの活動や最新情報をまとめる、ファン制作の応援サイトです。",
    siteUrl: "https://mily-fan-site.vercel.app/",
    // Source: mily-fan-site/public/media/gallery/mily-b01-03-bouquet-smile-960.jpg
    image: "/portraits/mily-b01-03-bouquet-smile-960.jpg",
    imagePosition: "49% 28%",
  },
  yukako: {
    id: "yukako",
    displayName: "吉井優花子",
    alternateName: "Yukako / 優花子",
    description:
      "優花子の活動や最新情報をまとめる、ファン制作の応援サイトです。",
    siteUrl: "https://yukako-schedule-2026.vercel.app/",
    // Source: yukako-schedule-2026/public/images/yukako-portrait.jpg
    image: "/portraits/yukako-portrait.jpg",
    imagePosition: "top",
  },
  riri: {
    id: "riri",
    displayName: "夏凪里季",
    alternateName: "Riri / 里季",
    description:
      "里季の活動や最新情報をまとめる、ファン制作の応援サイトです。",
    siteUrl: "https://riri-schedule-2026.vercel.app/",
    // Source: riri-schedule-2026/public/images/riri-portrait.jpg
    image: "/portraits/riri-portrait.jpg",
    imagePosition: "top",
  },
  chizuru: {
    id: "chizuru",
    displayName: "伊東千鶴",
    alternateName: "Chizuru Ito / 千鶴",
    description:
      "千鶴の活動や最新情報をまとめる、ファン制作の応援サイトです。",
    siteUrl:
      "https://chizuru-ito-archive.tasty-mite-7025.chatgpt.site/",
    // Source: chizuru-ito-archive/public/chizuru-ito-portrait.jpg
    image: "/portraits/chizuru-ito-portrait.jpg",
    imagePosition: "48% center",
  },
  mako: {
    id: "mako",
    displayName: "MAKO",
    alternateName: "まこ",
    description:
      "まこの活動や最新情報をまとめる、ファン制作の応援サイトです。",
    siteUrl: "https://mako-schedule-2026.vercel.app/",
    // Source: mako-schedule-2026/public/images/mako-portrait.jpg
    image: "/portraits/mako-portrait.jpg",
    imagePosition: "top",
  },
} satisfies Record<PersonId, Person>;

export const persons = PERSON_ORDER.map((personId) => PERSONS_BY_ID[personId]);

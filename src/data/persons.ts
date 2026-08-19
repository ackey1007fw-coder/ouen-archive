import type { PersonId } from "@/lib/feed-schema";

export const PERSON_ORDER = [
  "mily",
  "yukako",
  "riri",
  "chizuru",
  "mako",
] as const satisfies readonly PersonId[];

export type PersonProfileFact = Readonly<{
  label: string;
  value: string;
}>;

/**
 * A confirmed public URL for the person: their own SNS, streaming rooms, or an
 * official programme page. Only links verified as the person's own (or an
 * official page about them) belong here — never a guessed or probable URL.
 */
export type PersonProfileLink = Readonly<{
  label: string;
  url: string;
}>;

export type PersonProfile = Readonly<{
  headline: string;
  bio: string;
  facts: readonly PersonProfileFact[];
  tags: readonly string[];
  /** SNS / streaming / official programme pages for following the person. */
  links: readonly PersonProfileLink[];
  /**
   * Pages that lead directly to supporting the person, such as an official
   * contest entry. Kept separate from `links` so the UI can label the intent,
   * and left empty for everyone who has no confirmed support page.
   */
  supportLinks: readonly PersonProfileLink[];
}>;

export type Person = Readonly<{
  id: PersonId;
  displayName: string;
  alternateName: string;
  description: string;
  siteUrl: string;
  image: string;
  imagePosition: string;
  profile: PersonProfile;
}>;

const PERSONS_BY_ID = {
  mily: {
    id: "mily",
    displayName: "三橋莉子",
    alternateName: "Mily / みりぃ",
    description:
      "みりぃの活動や最新情報をまとめる、ファン制作の応援サイトです。",
    siteUrl: "https://mily-fan-site.vercel.app/",
    // Source: mily-fan-site/public/media/drive-gallery/mily-b02-p46-1600.jpg
    image: "/portraits/mily-b02-p46-1600.jpg",
    imagePosition: "50% 22%",
    // Public profile source audit: MISS CIRCLE / SHOWROOM /本人公開プロフィール.
    profile: {
      headline: "ラジオ・SHOWROOM・大学生コンテストで活動",
      bio:
        "神奈川県出身、日本大学3年。話すこと、歌うこと、挑戦することが好きで、一歩を踏み出す勇気を届けられる存在を目指しています。",
      facts: [
        { label: "誕生日", value: "2005年8月2日" },
        { label: "出身", value: "神奈川県" },
        { label: "大学", value: "日本大学 3年" },
        { label: "特技", value: "篠笛" },
      ],
      tags: ["ラジオ", "SHOWROOM", "英会話", "ENFP"],
      // SHOWROOM uses the stable room_id URL so a contest slug change cannot break it.
      links: [
        { label: "X", url: "https://x.com/Mily_chan36" },
        {
          label: "Instagram",
          url: "https://www.instagram.com/mily_chan36/",
        },
        { label: "TikTok", url: "https://www.tiktok.com/@mily_chan36" },
        {
          label: "SHOWROOM",
          url: "https://www.showroom-live.com/room/profile?room_id=573253",
        },
        { label: "MixChannel", url: "https://mixch.tv/u/10114673" },
        {
          label: "FM湘南マジックウェイブ",
          url: "https://fm-smw.jp/staff/mily%EF%BC%88%E3%83%9F%E3%83%AA%E3%83%BC%EF%BC%89",
        },
        {
          label: "湘南シーサイドサークル",
          url: "https://fm-smw.jp/program/%E3%80%8E-%E6%B9%98%E5%8D%97%E3%82%B7%E3%83%BC%E3%82%B5%E3%82%A4%E3%83%89%E3%82%B5%E3%83%BC%E3%82%AF%E3%83%AB-%E3%80%8F%E3%80%80%EF%BC%83ssc",
        },
      ],
      // The label stays meaningful after voting closes, so no deadline wording here.
      supportLinks: [
        {
          label: "MISS CIRCLE 2026｜公式プロフィール・投票",
          url: "https://2026.misscircle.jp/entry/734",
        },
      ],
    },
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
    // Public profile source audit: SHOWROOM / CLOUDCASTING / Miss Grand Japan related public pages.
    // Blood type AB is owner-confirmed and retained intentionally even though the audit did not find it on current first-party pages.
    profile: {
      headline: "俳優・タレント・モデル・ライバー",
      bio:
        "秋田で公務員として働いた後、上京して俳優活動を本格化。舞台・映像・配信に加え、#ゆかJET のプロデュースにも取り組んでいます。",
      facts: [
        { label: "誕生日", value: "1997年4月27日" },
        { label: "出身", value: "秋田県秋田市" },
        { label: "身長", value: "161cm" },
        { label: "血液型", value: "AB型" },
      ],
      tags: ["スポーツ", "歌唱", "料理", "写真撮影"],
      // The #ゆかJET produce account is listed separately from the personal X.
      links: [
        { label: "X", url: "https://x.com/mokoopy" },
        { label: "Instagram", url: "https://www.instagram.com/yoppy_777/" },
        { label: "TikTok", url: "https://www.tiktok.com/@yukakoyoshii" },
        {
          label: "SHOWROOM",
          url: "https://www.showroom-live.com/room/profile?room_id=347571",
        },
        { label: "X（#ゆかJET）", url: "https://x.com/yukako_produce" },
      ],
      supportLinks: [],
    },
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
    // Public profile source audit: SHOWROOM /本人Instagram・X / FRECAMP official.
    profile: {
      headline: "世界中の人の心を動かす役者を目指して活動",
      bio:
        "青山学院大学2年。陸上部とダンス部で培った身体性を生かし、舞台・配信・SNSで表現の幅を広げています。フレキャン2025では審査員特別賞を受賞。",
      facts: [
        { label: "誕生日", value: "2006年6月24日" },
        { label: "出身", value: "三重県生まれ、神奈川県育ち" },
        { label: "大学", value: "青山学院大学 2年" },
        { label: "身長", value: "163cm" },
      ],
      tags: ["数独", "映画鑑賞", "スポーツ", "お菓子作り"],
      // Current accounts only: the former X handle and the former SHOWROOM slug are not listed.
      links: [
        { label: "X", url: "https://x.com/frecam2025_0306" },
        {
          label: "Instagram",
          url: "https://www.instagram.com/__ririri__24/",
        },
        {
          label: "Threads",
          url: "https://www.threads.com/@__ririri__24",
        },
        { label: "TikTok", url: "https://www.tiktok.com/@ririchannel__" },
        {
          label: "SHOWROOM",
          url: "https://www.showroom-live.com/room/profile?room_id=550336",
        },
      ],
      supportLinks: [],
    },
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
    // Public profile source audit: Sophian's Contest 2024 / JJ / public model profiles.
    profile: {
      headline: "社会福祉を学びながら、モデル・メディア活動に挑戦",
      bio:
        "上智大学総合人間科学部社会福祉学科で学びながら、撮影会モデルやメディア活動に挑戦。Sophian’s Contest 2024では準グランプリを受賞しました。",
      facts: [
        { label: "誕生日", value: "2005年3月12日" },
        {
          label: "学び",
          value: "上智大学 総合人間科学部 社会福祉学科",
        },
        { label: "身長", value: "172cm" },
        { label: "受賞", value: "Sophian’s Contest 2024 準グランプリ" },
      ],
      tags: ["社会福祉", "トーク", "モデル", "ボランティア"],
      // Only the two confirmed accounts. Do not add unverified TikTok / SHOWROOM / YouTube.
      links: [
        { label: "X", url: "https://x.com/chizuruito_" },
        {
          label: "Instagram",
          url: "https://www.instagram.com/chizuru.ito_/",
        },
      ],
      supportLinks: [],
    },
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
    // Public profile source audit: current SHOWROOM profile. Birth year is not public; do not infer it.
    profile: {
      headline: "日々の暮らしと好きなことを、自分らしく発信",
      bio:
        "鹿児島県徳之島出身。大阪・千葉・名古屋での暮らしを経て、現在は和歌山県。料理や旅行、ウォーキングなど幅広い趣味を楽しんでいます。",
      facts: [
        { label: "誕生日", value: "4月6日" },
        { label: "故郷", value: "鹿児島県 徳之島" },
        { label: "現在", value: "和歌山県" },
        { label: "身長", value: "161cm" },
      ],
      tags: ["料理", "旅行", "ウォーキング", "ヨガ"],
      // X and SHOWROOM are intentionally omitted, matching the child site's publishing policy.
      links: [
        {
          label: "Instagram",
          url: "https://www.instagram.com/mako_hawaiian/",
        },
        { label: "TikTok", url: "https://www.tiktok.com/@maaako0406" },
      ],
      supportLinks: [],
    },
  },
} satisfies Record<PersonId, Person>;

export const personsById: Readonly<Record<PersonId, Person>> = PERSONS_BY_ID;

export const persons = PERSON_ORDER.map((personId) => personsById[personId]);

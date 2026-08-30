import type { PersonId } from "@/lib/feed-schema";

export type SupportCampaign = Readonly<{
  id: string;
  personId: PersonId;
  kindLabel: string;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string;
  href: string;
  ctaLabel: string;
  external: boolean;
  activeStateLabel?: string;
  upcomingStateLabel?: string;
  timingLabel?: string;
  priority: number;
}>;

/**
 * Confirmed, time-bounded actions that cannot be represented by the current
 * Portal Feed contract. The server filters these by the current Tokyo time, so
 * expired calls to action disappear without a deployment.
 */
export const supportCampaigns = [
  {
    id: "mily-campus-girls-paton-final-2026",
    personId: "mily",
    kindLabel: "投票",
    title: "CAMPUS GIRLS 2027｜Paton投票",
    summary:
      "Patonの三橋莉子（みりぃ）ページから、1日1回の無料拍手で応援できます。",
    startsAt: "2026-08-26T18:00:00+09:00",
    endsAt: "2026-09-01T23:59:00+09:00",
    href: "https://paton.jp/event/entrant/11380",
    ctaLabel: "Patonで投票する",
    external: true,
    priority: 100,
  },
  {
    id: "mily-miss-circle-third-round-2026",
    personId: "mily",
    kindLabel: "審査",
    title: "MISS CIRCLE 2026｜3次審査",
    summary:
      "WEB投票審査は9月3日12:00から9月13日23:59まで。ENTRY 734から応援できます。",
    startsAt: "2026-09-03T12:00:00+09:00",
    endsAt: "2026-09-13T23:59:00+09:00",
    href: "https://2026.misscircle.jp/entry/734",
    ctaLabel: "ENTRY 734を見る",
    external: true,
    priority: 90,
  },
  {
    id: "riri-homin-stage-2026",
    personId: "riri",
    kindLabel: "舞台",
    title: "Homin'｜全4公演",
    summary:
      "名曲から生まれた5つの短編集にA sideとして出演。9月11日・12日・13日・15日の全4公演です。",
    startsAt: "2026-09-11T19:00:00+09:00",
    endsAt: "2026-09-15T23:59:00+09:00",
    href:
      "https://riri-schedule-2026.vercel.app/#event-aitoki-homin-2026-09",
    ctaLabel: "里季の出演情報を見る",
    external: false,
    activeStateLabel: "公演日程",
    upcomingStateLabel: "出演予定",
    timingLabel: "9/11・12・13・15｜全4公演",
    priority: 80,
  },
  {
    id: "yukako-baby-shark-live-september-2026",
    personId: "yukako",
    kindLabel: "舞台",
    title: "BABY SHARK LIVE!｜福山・久留米公演",
    summary:
      "9月19日は広島・福山、9月20日は福岡・久留米へ。各日2回公演です。",
    startsAt: "2026-09-19T11:30:00+09:00",
    endsAt: "2026-09-20T23:59:00+09:00",
    href:
      "https://yukako-schedule-2026.vercel.app/#event-babyshark-live-2026-09-19",
    ctaLabel: "優花子の出演情報を見る",
    external: false,
    activeStateLabel: "公演日程",
    upcomingStateLabel: "出演予定",
    timingLabel: "9/19 福山・9/20 久留米",
    priority: 70,
  },
] as const satisfies readonly SupportCampaign[];

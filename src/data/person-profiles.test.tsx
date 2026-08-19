import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PersonCard } from "@/components/PersonCard";
import { PERSON_ORDER, persons, personsById } from "@/data/persons";

describe("five person profiles", () => {
  it("keeps the five-person order and gives everyone the same profile density", () => {
    assert.deepEqual(
      persons.map((person) => person.id),
      [...PERSON_ORDER],
    );
    assert.equal(persons.length, 5);

    for (const person of persons) {
      assert.ok(person.profile.headline.length > 0);
      assert.ok(person.profile.bio.length > 0);
      assert.equal(person.profile.facts.length, 4);
      assert.equal(person.profile.tags.length, 4);
      assert.ok(
        person.profile.facts.every((fact) => fact.label !== "年齢"),
        `${person.id}: 年齢ではなく誕生日など長期運用できる事実を使う`,
      );
      assert.equal(
        person.profile.facts[0]?.label,
        "誕生日",
        `${person.id}: 5人全員のプロフィール先頭に誕生日を掲載する`,
      );
    }
  });

  it("uses the verified source facts selected for each person", () => {
    assert.equal(personsById.mily.profile.facts[0].value, "2005年8月2日");
    assert.equal(personsById.yukako.profile.facts[0].value, "1997年4月27日");
    assert.equal(personsById.riri.profile.facts[0].value, "2006年6月24日");
    assert.equal(personsById.chizuru.profile.facts[0].value, "2005年3月12日");
    assert.equal(personsById.mako.profile.facts[0].value, "4月6日");

    assert.equal(personsById.yukako.profile.facts[1].value, "秋田県秋田市");
    assert.equal(personsById.yukako.profile.facts[3].label, "血液型");
    assert.equal(personsById.yukako.profile.facts[3].value, "AB型");
    assert.ok(!personsById.yukako.profile.bio.includes("2022年"));
    assert.equal(personsById.riri.profile.facts[2].value, "青山学院大学 2年");
    assert.equal(
      personsById.chizuru.profile.facts[1].value,
      "上智大学 総合人間科学部 社会福祉学科",
    );
    assert.equal(personsById.chizuru.profile.facts[2].value, "172cm");
    assert.equal(personsById.mako.profile.facts[2].value, "和歌山県");
  });

  it("renders an expandable profile and a separate support-site CTA", () => {
    const html = renderToStaticMarkup(
      createElement(PersonCard, { person: personsById.yukako }),
    );

    assert.match(html, /^<article/);
    assert.match(html, /<details/);
    assert.match(
      html,
      /<summary[^>]*>[\s\S]*PROFILE｜プロフィールを見る/,
    );
    assert.match(html, /俳優・タレント・モデル・ライバー/);
    assert.match(html, /1997年4月27日/);
    assert.match(html, /AB型/);
    assert.match(html, /#ゆかJET/);
    assert.match(
      html,
      /href="https:\/\/yukako-schedule-2026\.vercel\.app\/"/,
    );
  });

  it("keeps the confirmed direct link counts per person without padding them out", () => {
    const expectedLinkCounts = {
      mily: 7,
      yukako: 5,
      riri: 5,
      chizuru: 2,
      mako: 2,
    } as const;
    const expectedSupportCounts = {
      mily: 1,
      yukako: 0,
      riri: 0,
      chizuru: 0,
      mako: 0,
    } as const;

    for (const person of persons) {
      assert.equal(
        person.profile.links.length,
        expectedLinkCounts[person.id],
        `${person.id}: 確認できた公開リンクだけを掲載し、件数を揃えるために補完しない`,
      );
      assert.equal(
        person.profile.supportLinks.length,
        expectedSupportCounts[person.id],
        `${person.id}: SUPPORTは確認できた公式応援ページがある人物にだけ掲載する`,
      );
      assert.ok(
        person.profile.links.every(
          (link) => link.label.length > 0 && link.url.startsWith("https://"),
        ),
        `${person.id}: リンクはlabelとhttps URLを持つ`,
      );
    }
  });

  it("uses the owner-confirmed link set for Mily including radio and support", () => {
    const labels = personsById.mily.profile.links.map((link) => link.label);
    assert.ok(labels.includes("FM湘南マジックウェイブ"));
    assert.ok(labels.includes("湘南シーサイドサークル"));

    assert.equal(
      personsById.mily.profile.links.find((link) => link.label === "SHOWROOM")
        ?.url,
      "https://www.showroom-live.com/room/profile?room_id=573253",
      "コンテストslugではなく安定したroom_id URLを保存する",
    );

    const support = personsById.mily.profile.supportLinks[0];
    assert.ok(support.label.includes("MISS CIRCLE 2026"));
    assert.equal(support.url, "https://2026.misscircle.jp/entry/734");
    assert.ok(
      !personsById.mily.profile.links.some((link) =>
        link.url.includes("misscircle"),
      ),
      "MISS CIRCLE ENTRYはSUPPORTにのみ掲載しLINKSへ重複させない",
    );
    assert.ok(
      !/投票受付中|今すぐ投票|本日最終日|投票できます/.test(support.label),
      "期限で事実でなくなる状態文言を静的UIへ固定しない",
    );
  });

  it("respects the accounts each person asked not to publish", () => {
    const makoLabels = personsById.mako.profile.links.map((link) => link.label);
    assert.ok(!makoLabels.includes("X"), "MAKOのXは本人希望により非掲載");
    assert.ok(
      !makoLabels.includes("SHOWROOM"),
      "MAKOのSHOWROOMは本人希望により非掲載",
    );
    assert.ok(
      !personsById.mako.profile.links.some(
        (link) =>
          link.url.includes("x.com") || link.url.includes("showroom-live"),
      ),
    );
  });

  it("lists Riri's current accounts instead of the retired ones", () => {
    const urls = personsById.riri.profile.links.map((link) => link.url);
    assert.ok(urls.includes("https://x.com/frecam2025_0306"));
    assert.ok(!urls.includes("https://x.com/__ririri__24"));
    assert.ok(!urls.some((url) => url.includes("tps_0511")));
    assert.ok(!urls.some((url) => url.includes("lit.link")));
  });

  it("renders LINKS and SUPPORT inside the profile, with the site CTA left outside", () => {
    const html = renderToStaticMarkup(
      createElement(PersonCard, { person: personsById.mily }),
    );

    const detailsBody = html.slice(
      html.indexOf("<details"),
      html.indexOf("</details>"),
    );
    const afterDetails = html.slice(html.indexOf("</details>"));

    assert.ok(detailsBody.includes("LINKS｜SNS・配信"));
    assert.ok(detailsBody.includes("SUPPORT｜応援・投票"));
    assert.ok(detailsBody.includes("https://2026.misscircle.jp/entry/734"));
    assert.ok(detailsBody.includes("https://mixch.tv/u/10114673"));

    // The support-site CTA stays a separate control outside <details>.
    assert.ok(afterDetails.includes("応援サイトへ"));
    assert.ok(afterDetails.includes("https://mily-fan-site.vercel.app/"));
    assert.ok(!detailsBody.includes("https://mily-fan-site.vercel.app/"));

    for (const link of [
      ...personsById.mily.profile.links,
      ...personsById.mily.profile.supportLinks,
    ]) {
      const anchor = new RegExp(
        `<a[^>]*href="${link.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`,
      ).exec(detailsBody)?.[0];
      assert.ok(anchor, `${link.label}: リンクが描画される`);
      assert.match(anchor, /target="_blank"/);
      assert.match(anchor, /rel="noopener noreferrer"/);
    }

    // The existing support-site CTA keeps its current same-tab behaviour.
    assert.ok(!/target="_blank"/.test(afterDetails));
  });

  it("hides the SUPPORT heading for people without a support link", () => {
    for (const person of persons.filter(
      (candidate) => candidate.profile.supportLinks.length === 0,
    )) {
      const html = renderToStaticMarkup(createElement(PersonCard, { person }));
      assert.ok(
        !html.includes("SUPPORT｜応援・投票"),
        `${person.id}: SUPPORTが0件なら見出し自体を出さない`,
      );
      assert.ok(html.includes("LINKS｜SNS・配信"));
    }
  });
});

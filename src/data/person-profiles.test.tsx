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
});

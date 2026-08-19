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
    }
  });

  it("uses the child-site source facts selected for each person", () => {
    assert.equal(personsById.mily.profile.facts[0].value, "2005年8月2日");
    assert.equal(personsById.yukako.profile.facts[1].value, "秋田県秋田市");
    assert.equal(personsById.riri.profile.facts[2].value, "青山学院大学 2年");
    assert.equal(personsById.chizuru.profile.facts[1].value, "172cm");
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
    assert.match(html, /#ゆかJET/);
    assert.match(
      html,
      /href="https:\/\/yukako-schedule-2026\.vercel\.app\/"/,
    );
  });
});

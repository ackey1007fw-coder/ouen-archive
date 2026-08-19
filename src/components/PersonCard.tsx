import Image from "next/image";

import type { Person } from "@/data/persons";

export function PersonCard({ person }: { person: Person }) {
  return (
    <article className="person-card">
      <div className="person-image">
        <Image
          src={person.image}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 767px) calc(100vw - 3.3rem), (max-width: 1279px) calc(50vw - 3.5rem), 18vw"
          style={{ objectFit: "cover", objectPosition: person.imagePosition }}
        />
      </div>

      <div className="person-body">
        <h3 className="person-name">{person.displayName}</h3>
        <p className="person-alternate-name">{person.alternateName}</p>
        <p className="person-description">{person.profile.headline}</p>

        <details className="group mt-5 mb-3 border-t border-[color:var(--line)] pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-[color:var(--leaf)] underline decoration-[color:var(--line)] underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--apricot)]">
            <span>PROFILE｜プロフィールを見る</span>
            <span
              aria-hidden="true"
              className="shrink-0 text-[color:var(--apricot)] transition-transform group-open:rotate-180"
            >
              ↓
            </span>
          </summary>

          <div className="pb-2 pt-3">
            <p className="text-sm leading-7 text-[color:var(--ink-soft)]">
              {person.profile.bio}
            </p>

            <dl className="mt-4 grid gap-2 border-y border-[color:var(--line)] py-3">
              {person.profile.facts.map((fact) => (
                <div
                  key={fact.label}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-xs leading-5"
                >
                  <dt className="font-bold text-[color:var(--leaf)]">
                    {fact.label}
                  </dt>
                  <dd className="min-w-0 text-[color:var(--ink-soft)]">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>

            <ul
              className="mt-3 flex list-none flex-wrap gap-1.5 p-0"
              aria-label={`${person.displayName}のキーワード`}
            >
              {person.profile.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-[color:var(--line)] bg-[color:var(--paper)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--ink-soft)]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </details>

        <a
          className="person-cta min-h-11 no-underline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--apricot)]"
          href={person.siteUrl}
          aria-label={`${person.displayName}の応援サイトへ`}
        >
          応援サイトへ
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

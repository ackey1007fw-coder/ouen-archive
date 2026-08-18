import Image from "next/image";

import type { Person } from "@/data/persons";

export function PersonCard({ person }: { person: Person }) {
  return (
    <a className="person-card" href={person.siteUrl}>
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
        <p className="person-description">{person.description}</p>
        <p className="person-cta">
          応援サイトへ
          <span aria-hidden="true">→</span>
        </p>
      </div>
    </a>
  );
}

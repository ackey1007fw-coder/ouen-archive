import {
  CREATOR_DESCRIPTION,
  CREATOR_DISPLAY_NAME,
  CREATOR_LINKS,
} from "@/data/creator";

/**
 * Quiet bottom-only creator note. Sits between LATEST UPDATES and the
 * footer, and stays visually lighter than the five person cards — it is
 * a footnote, not a sixth card.
 */
export function CreatorMiniProfile() {
  return (
    <section className="creator-section" aria-labelledby="creator-title">
      <div className="section-container creator-layout">
        <div className="creator-note">
          <p className="eyebrow">ABOUT THIS ARCHIVE</p>
          <h2 id="creator-title">このサイトをつくっている人</h2>

          <p className="creator-name">{CREATOR_DISPLAY_NAME}</p>
          <p className="creator-description">{CREATOR_DESCRIPTION}</p>

          <ul className="creator-links">
            {CREATOR_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  className="creator-link"
                  href={link.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span aria-hidden="true" className="creator-link-mark" />
                  {link.label}
                  <span className="sr-only">（新しいタブで開きます）</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

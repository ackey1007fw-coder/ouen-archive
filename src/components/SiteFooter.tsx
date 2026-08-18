import { persons } from "@/data/persons";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <strong>応援アーカイブ</strong>
          <p>
            5つの個人応援サイトをつなぐ、ファン制作の非公式ポータルです。
          </p>
        </div>

        <nav aria-label="個人応援サイト">
          <ul className="footer-links">
            {persons.map((person) => (
              <li key={person.id}>
                <a className="footer-link" href={person.siteUrl}>
                  {person.displayName}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

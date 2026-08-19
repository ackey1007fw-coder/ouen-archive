import type { MilyRealtimeBanner as Banner } from "@/lib/mily-realtime-state";

export function MilyRealtimeBanner({
  banner,
}: {
  banner: Banner | null;
}) {
  if (!banner) return null;

  return (
    <div
      className={`realtime-banner realtime-banner--${banner.kind}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <a
        className="realtime-banner-link"
        href={banner.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span
          className="realtime-dot"
          aria-hidden="true"
          data-kind={banner.kind}
        />
        <span className="realtime-copy">
          <span className="realtime-label">{banner.stateLabel}</span>
          <span className="realtime-title">{banner.title}</span>
          {banner.detail ? (
            <span className="realtime-detail">{banner.detail}</span>
          ) : null}
        </span>
        <span className="realtime-cta">
          {banner.linkLabel}
          <span aria-hidden="true">↗</span>
        </span>
        <span className="sr-only">（新しいタブで開きます）</span>
      </a>
    </div>
  );
}

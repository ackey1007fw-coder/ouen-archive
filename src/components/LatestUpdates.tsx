export function LatestUpdates() {
  return (
    <section className="latest-section" aria-labelledby="latest-updates-title">
      <div className="section-container latest-layout">
        <div className="latest-heading">
          <p className="eyebrow">LATEST UPDATES</p>
          <h2 id="latest-updates-title">最新のお知らせ</h2>
          <p>
            将来は各サイトの更新を、公開日時が新しい順にここへまとめます。
          </p>
        </div>

        <div className="empty-state" role="status">
          <div className="empty-dots" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <strong>更新連携を準備中です</strong>
          <p>
            各サイトの更新をここに自動表示予定です。
            最新情報は、それぞれの応援サイトでご確認ください。
          </p>
        </div>
      </div>
    </section>
  );
}

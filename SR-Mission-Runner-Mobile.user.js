// ==UserScript==
// @name         SR Mission Runner Mobile
// @namespace    https://nao.qa/
// @version      1.0.1
// @description  SHOWROOMの30秒視聴ミッションを、手動の「次へ」操作でサクサク進めるiPhone/iPad Safari向け補助ツール。
// @author       ackey + ChatGPT
// @match        https://nao.qa/ap/*
// @match        https://showroom-live.com/r/*
// @match        https://www.showroom-live.com/r/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @inject-into  content
// @run-at       document-end
// @noframes
// ==/UserScript==

(async () => {
  'use strict';

  const KEY = 'srmr_mobile_session_v1';
  const isNao = location.hostname === 'nao.qa';
  const isShowroom = /(^|\.)showroom-live\.com$/.test(location.hostname);

  if (document.getElementById('srmr-mobile')) return;

  const css = `
#srmr-mobile{position:fixed;left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));z-index:2147483647;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;background:rgba(16,18,24,.96);
border:1px solid rgba(255,255,255,.16);border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.38);
padding:12px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#srmr-mobile *{box-sizing:border-box} #srmr-mobile .top{display:flex;align-items:center;gap:8px}
#srmr-mobile .title{font-weight:800;font-size:16px;flex:1} #srmr-mobile .sub{font-size:12px;opacity:.78;margin-top:3px}
#srmr-mobile .count{font-variant-numeric:tabular-nums;font-size:42px;line-height:1;font-weight:900;text-align:center;margin:10px 0 7px}
#srmr-mobile .bar{height:8px;background:#343843;border-radius:99px;overflow:hidden}
#srmr-mobile .bar>i{display:block;width:0;height:100%;background:#fff;border-radius:99px;transition:width .2s linear}
#srmr-mobile .row{display:flex;gap:8px;margin-top:9px} #srmr-mobile button,#srmr-mobile select{
appearance:none;-webkit-appearance:none;border:0;border-radius:13px;font-size:16px;font-weight:800;min-height:48px}
#srmr-mobile button{flex:1;background:#fff;color:#111;padding:10px 12px} #srmr-mobile button:disabled{opacity:.38}
#srmr-mobile button.secondary{background:#343843;color:#fff} #srmr-mobile button.danger{background:#47292d;color:#fff;flex:.55}
#srmr-mobile select{background:#343843;color:#fff;padding:0 12px} #srmr-mobile.ready{outline:3px solid rgba(255,255,255,.72)}
#srmr-mobile .pill{display:inline-flex;align-items:center;gap:5px;background:#343843;border-radius:99px;padding:5px 9px;font-size:12px}
#srmr-mobile .status{font-size:13px;line-height:1.35;margin-top:8px;opacity:.92}
#srmr-mobile .tiny{font-size:11px;opacity:.65;margin-top:6px}
@keyframes srmrPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
#srmr-mobile.ready{animation:srmrPulse .8s ease-in-out infinite}
`;

  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const normalizeRoom = (url) => {
    try {
      const u = new URL(url, location.href);
      return u.pathname.replace(/\/+$/, '');
    } catch {
      return '';
    }
  };

  async function loadSession() {
    return await GM.getValue(KEY, null);
  }

  async function saveSession(session) {
    await GM.setValue(KEY, session);
  }

  async function resetSession() {
    await GM.deleteValue(KEY);
  }

  function roomList() {
    const root = document.querySelector('#roomlist') || document;
    const links = [...root.querySelectorAll('a[href*="showroom-live.com/r/"]')];
    const seen = new Set();
    return links.map(a => {
      const url = a.href;
      const key = normalizeRoom(url);
      if (!key || seen.has(key)) return null;
      seen.add(key);
      const row = a.closest('tr')?.querySelector('td:first-child');
      let name = row?.textContent?.trim() || a.title || key.split('/').pop();
      name = name.replace(/\s+/g, ' ').slice(0, 100);
      return { url, key, name };
    }).filter(Boolean);
  }

  if (isNao) {
    const panel = document.createElement('section');
    panel.id = 'srmr-mobile';
    panel.innerHTML = `
      <div class="top">
        <div>
          <div class="title">🚀 SR Mission Runner</div>
          <div class="sub">iPhone / iPad Safari版</div>
        </div>
        <span class="pill" id="srmr-detected">0 rooms</span>
      </div>
      <div class="status" id="srmr-nao-status">配信中ルームを読み取り中…</div>
      <div class="row">
        <select id="srmr-seconds" aria-label="視聴目安秒数">
          <option value="30">30秒</option>
          <option value="32" selected>32秒</option>
          <option value="35">35秒</option>
        </select>
        <select id="srmr-limit" aria-label="ルーム数">
          <option value="10">10件</option>
          <option value="20" selected>20件</option>
        </select>
      </div>
      <div class="row">
        <button id="srmr-start" disabled>上から20件で開始 ▶</button>
        <button class="danger" id="srmr-reset">リセット</button>
      </div>
      <div class="tiny">現在表示中の「配信中」一覧だけを対象にします。検索やジャンル絞り込みも反映されます。</div>
    `;
    document.body.appendChild(panel);

    const detected = panel.querySelector('#srmr-detected');
    const status = panel.querySelector('#srmr-nao-status');
    const start = panel.querySelector('#srmr-start');
    const reset = panel.querySelector('#srmr-reset');
    const seconds = panel.querySelector('#srmr-seconds');
    const limit = panel.querySelector('#srmr-limit');

    const refresh = () => {
      const rooms = roomList();
      const max = Number(limit.value);
      detected.textContent = `${rooms.length} rooms`;
      start.disabled = rooms.length === 0;
      start.textContent = `上から${Math.min(max, rooms.length || max)}件で開始 ▶`;
      status.textContent = rooms.length
        ? `現在 ${rooms.length} ルーム検出。先頭から ${Math.min(max, rooms.length)} 件を使います。`
        : '配信中ルームがまだ見つかりません。少し待つか、一覧を更新してね。';
    };

    seconds.addEventListener('change', refresh);
    limit.addEventListener('change', refresh);
    setInterval(refresh, 1200);
    refresh();

    start.addEventListener('click', async () => {
      const rooms = roomList().slice(0, Number(limit.value));
      if (!rooms.length) return;
      const session = {
        active: true,
        queue: rooms,
        currentIndex: 0,
        seconds: Number(seconds.value),
        completed: [],
        skipped: [],
        startedAt: Date.now()
      };
      await saveSession(session);
      location.assign(rooms[0].url);
    });

    reset.addEventListener('click', async () => {
      await resetSession();
      status.textContent = '進行状況をリセットしました。';
      panel.classList.remove('ready');
    });
    return;
  }

  if (!isShowroom) return;

  const session = await loadSession();
  if (!session?.active || !Array.isArray(session.queue) || !session.queue.length) return;

  const currentKey = normalizeRoom(location.href);
  const matchedIndex = session.queue.findIndex(r => r.key === currentKey || normalizeRoom(r.url) === currentKey);
  if (matchedIndex >= 0 && matchedIndex !== session.currentIndex) {
    session.currentIndex = matchedIndex;
    await saveSession(session);
  }

  const total = session.queue.length;
  const current = session.currentIndex;
  if (current < 0 || current >= total) return;

  const targetMs = Math.max(30000, Number(session.seconds || 32) * 1000);
  let remainingMs = targetMs;
  let ready = false;
  let lastTick = Date.now();

  const panel = document.createElement('section');
  panel.id = 'srmr-mobile';
  panel.innerHTML = `
    <div class="top">
      <div>
        <div class="title">🚀 ${current + 1} / ${total}</div>
        <div class="sub">${esc(session.queue[current]?.name || 'SHOWROOM')}</div>
      </div>
      <span class="pill" id="srmr-visibility">視聴中</span>
    </div>
    <div class="count" id="srmr-count">${Math.ceil(targetMs / 1000)}</div>
    <div class="bar"><i id="srmr-progress"></i></div>
    <div class="status" id="srmr-status">このタブを表示したまま視聴してね。</div>
    <div class="row">
      <button id="srmr-next" disabled>次へ ▶</button>
      <button class="secondary" id="srmr-skip">スキップ</button>
    </div>
    <div class="row">
      <button class="secondary" id="srmr-list">一覧へ戻る</button>
      <button class="danger" id="srmr-stop">終了</button>
    </div>
    <div class="tiny">時間到達はあくまで移動の目安です。ミッション成立はSHOWROOM側で確認してください。</div>
  `;
  document.body.appendChild(panel);

  const count = panel.querySelector('#srmr-count');
  const progress = panel.querySelector('#srmr-progress');
  const status = panel.querySelector('#srmr-status');
  const vis = panel.querySelector('#srmr-visibility');
  const next = panel.querySelector('#srmr-next');
  const skip = panel.querySelector('#srmr-skip');
  const list = panel.querySelector('#srmr-list');
  const stop = panel.querySelector('#srmr-stop');

  function isVisible() {
    return document.visibilityState === 'visible';
  }

  function flashReady() {
    panel.classList.add('ready');
    if ('vibrate' in navigator) {
      try { navigator.vibrate([120, 60, 120]); } catch {}
    }
  }

  async function markComplete() {
    const item = session.queue[session.currentIndex];
    if (!session.completed.some(x => x.key === item.key)) {
      session.completed.push({ key: item.key, at: Date.now() });
      await saveSession(session);
    }
  }

  async function becomeReady() {
    if (ready) return;
    ready = true;
    remainingMs = 0;
    count.textContent = 'OK';
    status.textContent = '目安時間に到達。確認して「次へ」をタップしてね 🔔';
    next.disabled = false;
    progress.style.width = '100%';
    flashReady();
    await markComplete();
  }

  function tick() {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    if (!ready && isVisible()) {
      remainingMs -= Math.min(Math.max(delta, 0), 1000);
    }

    if (!ready) {
      const sec = Math.max(0, Math.ceil(remainingMs / 1000));
      count.textContent = String(sec);
      progress.style.width = `${Math.min(100, Math.max(0, ((targetMs - remainingMs) / targetMs) * 100))}%`;
      vis.textContent = isVisible() ? '視聴中' : '停止中';
      status.textContent = isVisible()
        ? 'カウント中。このタブを表示したまま視聴してね。'
        : '一時停止中。Safariに戻ると再開します。';
      if (remainingMs <= 0) void becomeReady();
    }
  }

  document.addEventListener('visibilitychange', () => {
    lastTick = Date.now();
    tick();
  });

  async function goNext(skipped = false) {
    const idx = session.currentIndex;
    const item = session.queue[idx];

    if (skipped && !session.skipped.some(x => x.key === item.key)) {
      session.skipped.push({ key: item.key, at: Date.now() });
    }

    const nextIndex = idx + 1;
    if (nextIndex >= total) {
      session.active = false;
      await saveSession(session);
      panel.classList.add('ready');
      count.textContent = '🎉';
      status.textContent = `${total}ルーム分のランナー終了。SHOWROOMのミッション画面で結果を確認してね。`;
      next.disabled = true;
      skip.disabled = true;
      list.textContent = 'nao.qaへ戻る';
      return;
    }

    session.currentIndex = nextIndex;
    await saveSession(session);
    location.assign(session.queue[nextIndex].url);
  }

  next.addEventListener('click', () => { if (!next.disabled) void goNext(false); });
  skip.addEventListener('click', () => void goNext(true));
  list.addEventListener('click', () => location.assign('https://nao.qa/ap/search.php?kw=&genre=103'));
  stop.addEventListener('click', async () => {
    session.active = false;
    await saveSession(session);
    panel.remove();
  });

  tick();
  setInterval(tick, 250);
})();

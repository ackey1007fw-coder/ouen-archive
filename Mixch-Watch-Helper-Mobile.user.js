// ==UserScript==
// @name         Mixch Watch Helper Mobile
// @namespace    https://mixch.tv/
// @version      0.1.0
// @description  ミクチャの手動視聴メモβ。コイン付与・現行獲得条件は未検証。時間・件数は端末内の目安です。
// @author       ackey + ChatGPT
// @match        https://mixch.tv/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @inject-into  content
// @run-at       document-end
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const CONFIG = {"kind": "mx", "version": "0.1.0", "home": "https://mixch.tv/", "title": "🎬 ミクチャ視聴メモ β", "key": "mxwh_progress_v1", "id": "mxwh-mobile"};
  const HOUR = 3600000;
  const DAY = 24 * HOUR;
  const integer = (n, min, max, fallback) => Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  const cleanName = s => String(s || '').replace(/\s+/g, ' ').slice(0, 100);
  const validSlug = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(s);

  // Period arithmetic is always JST, independent of the device's timezone.
  // Mixch's midnight is a LOCAL RECORD convention, not a verified reward rule.
  function periodAt(now, kind = CONFIG.kind) {
    if (!Number.isFinite(now)) throw new Error('Invalid time');
    const jst = now + 9 * HOUR;
    const day = Math.floor(jst / DAY) * DAY;
    const hour = (jst - day) / HOUR;
    let start, end, label;
    if (kind === 'sr') {
      start = hour >= 15 ? day + 15 * HOUR : hour >= 3 ? day + 3 * HOUR : day - 9 * HOUR;
      end = start + 12 * HOUR;
      label = hour >= 3 && hour < 15 ? '昼枠 3:00〜15:00' : '夜枠 15:00〜翌3:00';
    } else { start = day; end = day + DAY; label = '本日の視聴メモ（0時区切り）'; }
    return { key: String(start - 9 * HOUR), start: start - 9 * HOUR, end: end - 9 * HOUR, label };
  }
  function parseRoom(value, base = CONFIG.home) {
    try {
      const u = new URL(value, base);
      if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
      if (CONFIG.kind === 'sr') {
        if (!['www.showroom-live.com', 'showroom-live.com'].includes(u.hostname)) return null;
        const m = u.pathname.match(/^\/(r|lite)\/([A-Za-z0-9_-]{1,100})\/?$/);
        return m ? { slug: m[2], viewing: m[1] === 'lite' } : null;
      }
      if (u.hostname !== 'mixch.tv') return null;
      const m = u.pathname.match(/^\/u\/(\d{1,12})(\/live)?\/?$/);
      return m ? { slug: m[1], viewing: !!m[2] } : null;
    } catch { return null; }
  }
  const liveUrl = slug => validSlug(slug) ? CONFIG.kind === 'sr'
    ? `https://www.showroom-live.com/lite/${slug}` : /^\d+$/.test(slug) ? `https://mixch.tv/u/${slug}/live` : '' : '';
  const profileUrl = slug => validSlug(slug) ? CONFIG.kind === 'sr'
    ? `https://www.showroom-live.com/r/${slug}` : /^\d+$/.test(slug) ? `https://mixch.tv/u/${slug}` : '' : '';
  function roomsOnly(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.slice(0, 300).filter(r => {
      if (!r || !liveUrl(r.slug) || seen.has(r.slug)) return false;
      seen.add(r.slug); return true;
    }).map(r => ({ slug: r.slug, name: cleanName(r.name || r.slug) }));
  }
  function normalizeState(value, period) {
    const s = value && value.period === period.key ? value : {};
    const seen = new Set();
    const done = (Array.isArray(s.done) ? s.done : []).filter(r => {
      if (!r || !liveUrl(r.slug) || !Number.isFinite(r.at) || r.at < period.start || r.at >= period.end || seen.has(r.slug)) return false;
      seen.add(r.slug); return true;
    }).slice(0, 300).map(r => ({ slug: r.slug, at: r.at }));
    const queue = roomsOnly(s.queue);
    const index = integer(s.index, 0, Math.max(0, queue.length - 1), 0);
    const cp = s.checkpoint;
    return { period: period.key, done, adjustment: integer(s.adjustment, -300, 100, 0), queue, index,
      run: typeof s.run === 'string' ? s.run.slice(0, 100) : '', active: s.active === true && queue.length > 0,
      checkpoint: cp && validSlug(cp.slug) && Number.isFinite(cp.elapsed) && cp.elapsed >= 0 && cp.elapsed <= 120000
        ? { slug: cp.slug, elapsed: cp.elapsed } : null };
  }
  const countDone = (s, target) => Math.max(0, Math.min(target, s.done.length + s.adjustment));
  function addDone(s, slug, now, period) {
    if (s.period !== period.key || now < period.start || now >= period.end || !liveUrl(slug)) return false;
    if (!s.done.some(r => r.slug === slug)) s.done.push({ slug, at: now });
    s.checkpoint = null;
    return true;
  }
  function adjustCount(s, n) { s.adjustment = n - s.done.length; }
  function migrateLegacy(legacy, period) {
    return normalizeState({ period: period.key, done: legacy?.completed }, period);
  }
  // Only media time that advanced while visible is counted. No play(), API,
  // auto-follow, reward claims, or background viewing is performed.
  function timerDelta(wall, mediaDelta, visible, playing) {
    return visible && playing && wall > 0 && wall <= 1500 && mediaDelta > 0 && mediaDelta <= 2
      ? Math.min(wall, mediaDelta * 1000, 1000) : 0;
  }
  const api = { periodAt, parseRoom, liveUrl, profileUrl, normalizeState, countDone, addDone, adjustCount, migrateLegacy, timerDelta, roomsOnly };
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = api;
    return;
  }
  void main().catch(() => {
    const box = document.getElementById(CONFIG.id) || document.createElement('div');
    box.id = CONFIG.id;
    box.textContent = `${CONFIG.title}: 保存領域を読み込めませんでした。Userscriptsのサイト権限を確認し、再読み込みしてください。`;
    box.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483647;background:#161b24;color:white;padding:16px';
    document.body.appendChild(box);
  });

  async function main() {
    const current = parseRoom(location.href);
    const isList = CONFIG.kind === 'sr' ? location.hostname === 'nao.qa' && location.pathname.startsWith('/ap/')
      : location.hostname === 'mixch.tv' && /^\/(?:live\/?)?$/.test(location.pathname);
    // Normal profile/follow pages must never be redirected or timed.
    if (!isList && !current?.viewing) return;
    if (document.getElementById(CONFIG.id)) return;
    const prefix = CONFIG.key;
    let prefs = await GM.getValue(`${prefix}_prefs`, {});
    prefs = { seconds: [30, 32, 35].includes(prefs?.seconds) ? prefs.seconds : 32,
      target: [10, 20].includes(prefs?.target) ? prefs.target : 20 };
    let favorites = roomsOnly(await GM.getValue(`${prefix}_favorites`, []));
    let period = periodAt(Date.now());
    const storageKey = p => `${prefix}_${p.key}`;
    async function readState(p) {
      let raw = await GM.getValue(storageKey(p), null);
      if (raw === null && CONFIG.kind === 'sr') raw = migrateLegacy(await GM.getValue('srmr_mobile_session_v2', null), p);
      return normalizeState(raw, p);
    }
    let state = await readState(period);
    await GM.setValue(storageKey(period), state);
    let busy = false, elapsed = 0, paused = false, ready = false, notice = '', ended = false, boundaryStop = false;
    let lastWall = performance.now(), lastMedia = null, lastTime = null, pending = Promise.resolve();
    const titleFromPage = () => cleanName(document.querySelector('h1')?.textContent || document.title || current?.slug);
    const activeHere = () => !isList && state.active && state.queue[state.index]?.slug === current.slug && !ended;
    function resetTimer() {
      elapsed = activeHere() && state.checkpoint?.slug === current.slug ? Math.min(state.checkpoint.elapsed, prefs.seconds * 1000) : 0;
      ready = elapsed >= prefs.seconds * 1000;
      lastWall = performance.now(); lastMedia = null; lastTime = null;
    }
    resetTimer();
    const host = document.createElement('section'); host.id = CONFIG.id;
    host.style.cssText = 'position:fixed;left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));z-index:2147483647';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;color-scheme:dark}
      *{box-sizing:border-box} .box{background:rgba(16,20,28,.97);padding:12px;border:1px solid #424956;border-radius:18px;box-shadow:0 6px 24px #0005;max-height:70vh;overflow:auto}
      .top,.row{display:flex;gap:8px;align-items:center}.top strong{flex:1;min-width:0;font-size:16px}.row{margin-top:8px;flex-wrap:wrap}
      .sub,.note{font-size:12px;color:#cdd4de}.sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .progress{font-weight:800;margin:6px 0}.time{font-size:36px;font-weight:900;line-height:1.1;text-align:center;margin:4px}
      button,select,a.action,input{font:inherit;min-height:44px;border:0;border-radius:10px;padding:9px;}
      button,a.action{cursor:pointer;font-weight:700;background:#343b49;color:white;flex:1;text-align:center;text-decoration:none;touch-action:manipulation}
      button.primary{background:white;color:#10141c} button:disabled{opacity:.4;cursor:default} button.small{flex:0 0 auto;font-size:12px}
      button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #9ad7ff;outline-offset:2px} select,input{background:#343b49;color:white} input{width:75px}
      [hidden]{display:none!important} summary{cursor:pointer;padding:8px 0;min-height:44px} details{margin-top:4px}
      .fav{display:flex;gap:6px;margin:6px 0}.fav a{color:#bee6ff;flex:1}.status{font-size:13px;min-height:20px;margin:4px 0}.warn{color:#ffdc9e}
      .compact .fold,.compact details,.compact .name,.compact .time{display:none}.box.compact{padding:8px 12px}
    </style><div class="box">
      <div class="top"><strong id="title"></strong><button id="compact" class="small">小さく</button></div>
      <div class="sub" id="period"></div><div class="progress" id="total"></div>
      <div class="sub name" id="name"></div><div class="time" id="time"></div><div class="status" id="status" role="status"></div>
      <div class="row" id="listControls"><select id="seconds" aria-label="視聴目安秒数"><option value="30">30秒</option><option value="32">32秒</option><option value="35">35秒</option></select><select id="target" aria-label="目標ルーム数"><option value="10">10件</option><option value="20">20件</option></select><button class="primary" id="start">続きから開始</button></div>
      <div class="row" id="watchControls"><button class="primary" id="next" disabled>記録して次へ</button><button id="skip">スキップ</button></div>
      <div class="row fold" id="discover"><a class="action" id="follow" target="_blank" rel="noopener noreferrer">♡ フォロー画面</a><button id="favorite">☆ あとで見る</button></div>
      <div class="row fold" id="pauseControls"><button id="pause">一時停止</button><button id="back">中断・一覧へ</button></div>
      <details class="fold"><summary>記録の調整・あとで見る</summary>
        <div class="note">この端末の記録です。公式の達成・受取件数とは同期しません。別アプリで視聴した分は件数を合わせてください。同一期間・同一ルームは重複計上しません。</div>
        <div class="row"><label>確認した件数 <input id="actual" type="number" min="0" max="20" value="0" inputmode="numeric"></label><button id="adjust">件数を合わせる</button></div>
        <div class="row"><button id="reset">この枠の記録を消す</button></div><div id="favorites"></div>
        <div class="note">保存先はこのUserscriptsのローカル領域です。お気に入りは時間帯が変わっても残ります。複数アカウント・端末とは自動同期しません。</div>
      </details><div class="note fold" id="caution"></div>
    </div>`;
    document.body.appendChild(host);
    const el = id => root.getElementById(id);
    el('title').textContent = `${CONFIG.title} v${CONFIG.version}`;
    el('seconds').value = String(prefs.seconds); el('target').value = String(prefs.target);
    el('caution').textContent = CONFIG.kind === 'sr'
      ? '目安到達はミッション成立ではありません。公式の達成・受取を確認してください。切替をまたぐ同じ配信では再達成できません。手動補助の規約適合も保証しません。'
      : 'β版: ブラウザでの視聴コイン付与・現行条件は未検証。まず1ルームで確認してください。0時はこのメモの区切りで、公式条件ではありません。';
    if (!isList) el('follow').href = profileUrl(current.slug);

    function listRooms() {
      const scope = CONFIG.kind === 'sr' ? document.querySelector('#roomlist') : document;
      if (!scope) return [];
      const found = [];
      for (const a of scope.querySelectorAll('a[href]')) {
        const r = parseRoom(a.getAttribute('href'), location.href);
        if (!r || (CONFIG.kind === 'mx' && !r.viewing)) continue;
        if (a.closest('[hidden]')) continue;
        const row = a.closest('tr')?.querySelector('td:first-child');
        const text = row?.textContent || a.getAttribute('title') || a.textContent || r.slug;
        found.push({ slug: r.slug, name: cleanName(text.split(/\(\d{4}\/\d{2}\/\d{2}/)[0]) });
      }
      return roomsOnly(found);
    }
    function available() { return listRooms().filter(r => !state.done.some(d => d.slug === r.slug)); }
    function renderFavorites() {
      el('favorites').replaceChildren();
      for (const r of favorites) {
        const row = document.createElement('div'); row.className = 'fav';
        const a = document.createElement('a'); a.href = profileUrl(r.slug); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = r.name;
        const b = document.createElement('button'); b.textContent = '削除'; b.className = 'small';
        b.addEventListener('click', () => run(async () => {
          favorites = roomsOnly(await GM.getValue(`${prefix}_favorites`, [])).filter(v => v.slug !== r.slug);
          await GM.setValue(`${prefix}_favorites`, favorites); renderFavorites(); render();
        }));
        row.append(a, b); el('favorites').appendChild(row);
      }
    }
    function render() {
      const count = countDone(state, prefs.target), left = Math.max(0, prefs.target - count);
      const cutoff = CONFIG.kind === 'sr' ? period.label.startsWith('昼') ? '15:00' : '3:00' : '0:00';
      el('period').textContent = `${period.label} / 日本時間`;
      el('total').textContent = `端末の記録 ${count} / ${prefs.target}　あと${left}件（${cutoff}まで）`;
      el('listControls').hidden = !isList;
      el('watchControls').hidden = isList;
      el('pauseControls').hidden = isList;
      el('discover').hidden = isList;
      el('time').hidden = isList;
      if (isList) {
        const candidates = available();
        el('name').textContent = `この一覧の未記録 ${candidates.length}ルーム`;
        el('start').textContent = count ? `残り${left}件を続ける ▶` : '開始 ▶';
        el('start').disabled = busy || !left || !candidates.length;
        el('status').textContent = notice || (left ? '途中で閉じても、この枠の記録は残ります。' : '目標件数まで記録済み。公式の結果も確認してください。');
      } else {
        const room = state.queue.find(r => r.slug === current.slug);
        el('name').textContent = room?.name || titleFromPage();
        const counted = state.done.some(d => d.slug === current.slug);
        el('time').textContent = counted ? '記録済み' : ready ? '目安到達' : String(Math.max(0, Math.ceil(prefs.seconds - elapsed / 1000)));
        el('next').textContent = !activeHere() ? 'この配信を計測' : ready ? '記録して次へ ▶' : '再生を確認中';
        el('next').disabled = busy || boundaryStop || !left || (activeHere() && !ready);
        el('skip').disabled = busy || !activeHere();
        el('pause').disabled = busy || !activeHere();
        el('pause').textContent = paused ? '再開' : '一時停止';
        el('status').textContent = notice || (counted ? '同じ枠で記録済み。二重計上はしません。' : !activeHere() ? '計測を始めるか、一覧から続けてください。' : paused ? '一時停止中' : ready ? '公式側を確認してから、記録して次へ進んでください。' : '映像・音声の再生進行中だけ計測。未再生・停止・画面外は数えません。');
        el('favorite').textContent = favorites.some(r => r.slug === current.slug) ? '★ 保存済み' : '☆ あとで見る';
      }
      el('adjust').disabled = busy; el('reset').disabled = busy;
    }
    async function rollover() {
      const p = periodAt(Date.now());
      if (p.key === period.key) return false;
      period = p; state = await readState(p); await GM.setValue(storageKey(p), state);
      ended = true; elapsed = 0; ready = false; lastTime = null; lastMedia = null;
      boundaryStop = CONFIG.kind === 'sr' && !isList;
      notice = boundaryStop ? '時間帯が切り替わりました。同じ配信の継続では再達成できません。一覧に戻り、別の配信へ進んでください。' : '時間帯が切り替わりました。新しい枠の記録に切り替えています。';
      render(); return true;
    }
    function transact(fn, requireActive = false) {
      const p = period, runId = state.run, expectedIndex = state.index;
      const work = pending.then(async () => {
        if (periodAt(Date.now()).key !== p.key) { await rollover(); return false; }
        const latest = await readState(p);
        if (periodAt(Date.now()).key !== p.key) { await rollover(); return false; }
        if (requireActive && (!latest.active || latest.run !== runId || latest.index !== expectedIndex)) {
          state = latest; ended = true; notice = '別の画面で進んだため、この画面の計測を停止しました。'; render(); return false;
        }
        fn(latest); await GM.setValue(storageKey(p), latest);
        if (period.key === p.key) state = latest;
        return true;
      });
      pending = work.catch(() => {});
      return work;
    }
    async function run(fn) {
      if (busy) return;
      busy = true; render();
      try { if (!await rollover()) await fn(); }
      catch { paused = true; notice = '保存できませんでした。移動せず再読み込みし、記録を確認してください。'; }
      finally { busy = false; render(); }
    }
    function bind(id, fn) { el(id).addEventListener('click', () => void run(fn)); }
    const checkpoint = () => activeHere() ? transact(s => { s.checkpoint = { slug: current.slug, elapsed }; }, true) : Promise.resolve(true);
    bind('start', async () => {
      const rooms = available();
      if (!rooms.length) return;
      if (state.checkpoint) {
        const i = rooms.findIndex(r => r.slug === state.checkpoint.slug);
        if (i > 0) rooms.unshift(...rooms.splice(i, 1));
      }
      const ok = await transact(s => { s.queue = rooms.filter(r => !s.done.some(d => d.slug === r.slug)); s.index = 0; s.active = s.queue.length > 0; s.run = `${Date.now()}-${Math.random()}`; });
      if (ok && state.active && periodAt(Date.now()).key === period.key) location.assign(liveUrl(state.queue[0].slug));
    });
    async function advance(skip) {
      if (boundaryStop) return;
      if (!activeHere()) {
        if (skip) return;
        const ok = await transact(s => { s.queue = [{ slug: current.slug, name: titleFromPage() }]; s.index = 0; s.run = `${Date.now()}-${Math.random()}`; s.active = true; });
        if (ok) { ended = false; notice = ''; resetTimer(); } return;
      }
      if (!skip && !ready) return;
      let destination = '';
      const ok = await transact(s => {
        if (!skip) addDone(s, current.slug, Date.now(), period);
        s.checkpoint = null;
        if (countDone(s, prefs.target) < prefs.target) {
          for (let i = s.index + 1; i < s.queue.length; i++) {
            if (!s.done.some(r => r.slug === s.queue[i].slug)) { s.index = i; destination = liveUrl(s.queue[i].slug); break; }
          }
        }
        if (!destination) s.active = false;
      }, true);
      if (!ok || periodAt(Date.now()).key !== period.key) return;
      if (destination) location.assign(destination);
      else { ended = true; notice = countDone(state, prefs.target) >= prefs.target ? '目標まで記録しました。公式の結果・受取も確認してください。' : 'この一覧はここまで。中断・一覧へ戻ると、残りから続けられます。'; }
    }
    bind('next', () => advance(false)); bind('skip', () => advance(true));
    bind('pause', async () => { paused = !paused; lastTime = null; await checkpoint(); });
    bind('back', async () => { await checkpoint(); location.assign(CONFIG.home); });
    bind('favorite', async () => {
      favorites = roomsOnly(await GM.getValue(`${prefix}_favorites`, []));
      if (favorites.some(r => r.slug === current.slug)) favorites = favorites.filter(r => r.slug !== current.slug);
      else favorites.push({ slug: current.slug, name: state.queue.find(r => r.slug === current.slug)?.name || titleFromPage() });
      favorites = roomsOnly(favorites); await GM.setValue(`${prefix}_favorites`, favorites); renderFavorites();
    });
    bind('adjust', async () => {
      const n = Number(el('actual').value);
      if (!Number.isInteger(n) || n < 0 || n > prefs.target) { notice = `0〜${prefs.target}の整数を入力してください。`; return; }
      await transact(s => adjustCount(s, n)); notice = 'この端末の記録件数を合わせました。公式側は変更していません。';
    });
    bind('reset', async () => {
      if (!window.confirm('この時間帯の端末記録だけを消しますか？公式のミッション・報酬・フォローは変更しません。')) return;
      await transact(s => Object.assign(s, normalizeState(null, period)));
      ended = true; resetTimer(); notice = 'この枠の端末記録をリセットしました。';
    });
    for (const id of ['seconds', 'target']) el(id).addEventListener('change', () => void run(async () => {
      prefs.seconds = [30, 32, 35].includes(Number(el('seconds').value)) ? Number(el('seconds').value) : 32;
      prefs.target = [10, 20].includes(Number(el('target').value)) ? Number(el('target').value) : 20;
      await GM.setValue(`${prefix}_prefs`, prefs); el('actual').max = String(prefs.target); render();
    }));
    el('compact').addEventListener('click', () => { const compact = root.querySelector('.box').classList.toggle('compact'); el('compact').textContent = compact ? '戻す' : '小さく'; });
    // Keep no media samples across app switches, pauses, or bfcache restores.
    document.addEventListener('visibilitychange', () => { lastMedia = null; lastTime = null; lastWall = performance.now(); if (document.hidden) void checkpoint().catch(() => {}); else void run(async () => { await pending; state = await readState(period); resetTimer(); }); });
    window.addEventListener('pageshow', () => { lastMedia = null; lastTime = null; lastWall = performance.now(); void run(async () => { await pending; state = await readState(period); resetTimer(); }); });
    setInterval(() => {
      if (periodAt(Date.now()).key !== period.key) { void run(async () => {}); return; }
      const now = performance.now(), wall = now - lastWall; lastWall = now;
      if (!activeHere() || paused || busy || ready || document.hidden) { lastMedia = null; lastTime = null; return; }
      const media = [...document.querySelectorAll('video,audio')].find(m => !m.paused && !m.ended && !m.error && m.readyState >= 2);
      const time = media && Number.isFinite(media.currentTime) ? media.currentTime : null;
      elapsed += timerDelta(wall, media === lastMedia && time !== null && lastTime !== null ? time - lastTime : 0, true, !!media);
      lastMedia = media; lastTime = time;
      if (elapsed >= prefs.seconds * 1000) { elapsed = prefs.seconds * 1000; ready = true; }
      render();
    }, 250);
    setInterval(() => { if (!busy) void run(async () => { if (activeHere()) await checkpoint(); else state = await readState(period); }); }, 2500);
    renderFavorites(); render();
  }
})();

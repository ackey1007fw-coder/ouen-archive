// ==UserScript==
// @name         Mixch Watch Helper Mobile
// @namespace    https://mixch.tv/
// @version      0.2.1
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
  const CONFIG = {"kind": "mx", "version": "0.2.1", "home": "https://mixch.tv/", "title": "🎬 ミクチャ視聴メモ β", "key": "mxwh_progress_v1", "id": "mxwh-mobile"};
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

  function listSource(value) {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password || u.port) return '';
      if (CONFIG.kind === 'sr') {
        if (u.hostname === 'nao.qa' && u.pathname.startsWith('/ap/')) return 'nao';
        if (['showroom-live.com', 'www.showroom-live.com'].includes(u.hostname) && /^\/(?:onlive\/?)?$/.test(u.pathname)) return 'official';
      } else if (u.hostname === 'mixch.tv' && /^\/(?:live\/?)?$/.test(u.pathname)) return 'mixch';
      return '';
    } catch { return ''; }
  }
  function returnListUrl(value) {
    const source = listSource(value);
    if (!source) return CONFIG.home;
    const u = new URL(value);
    if (source === 'mixch') return 'https://mixch.tv/';
    if (source === 'official') {
      const dest = new URL(u.pathname.startsWith('/onlive') ? '/onlive' : '/', 'https://www.showroom-live.com');
      for (const key of ['genre_id', 'genre']) if (/^\d{1,5}$/.test(u.searchParams.get(key) || '')) dest.searchParams.set(key, u.searchParams.get(key));
      return dest.href;
    }
    return 'https://nao.qa/ap/search.php?' + new URLSearchParams({ kw: (u.searchParams.get('kw') || '').slice(0, 100), genre: /^\d{1,5}$/.test(u.searchParams.get('genre') || '') ? u.searchParams.get('genre') : '103' });
  }
  // Use only rendered first-party onlive cards with an explicit live marker.
  // A HH:MM label has no date: never fabricate a broadcast start from it.
  function officialRooms(doc, base) {
    const found = [];
    for (const card of doc.querySelectorAll('article.onlivecard:not(.todays-pick)')) {
      if (card.closest('[hidden], [aria-hidden="true"]') || !card.getClientRects().length || doc.defaultView.getComputedStyle(card).visibility === 'hidden') continue;
      const item = card.closest('li');
      const live = item?.querySelector('.onlivecard-time.is-onlive');
      const a = card.querySelector('a.ga-onlive-click[href]');
      const r = a && parseRoom(a.getAttribute('href'), base);
      if (!r || !live || live.closest('li') !== item) continue;
      const startedAt = parseStartedAt(live.textContent);
      if (startedAt && startedAt > Date.now()) continue;
      const name = item.querySelector('.onlivecard-name')?.textContent || card.querySelector('img.onlivecard-bg')?.alt || r.slug;
      found.push({ slug: r.slug, roomId: validRoomId(a.getAttribute('data-room-id')), startedAt, name: cleanName(name) });
    }
    return roomsOnly(found);
  }

  const validStart = n => Number.isSafeInteger(n) && n > 0 ? n : null;
  const asRoom = r => typeof r === 'string' ? { slug: r, startedAt: null } : r;
  const recordKey = r => `${r.slug}:${validStart(r.startedAt) || 'unknown'}`;
  function parseStartedAt(text) {
    const matches = [...String(text).matchAll(/[（(](\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})[）)]/g)];
    if (!matches.length) return null;
    const [y,m,d,h,mi,se] = matches.at(-1).slice(1).map(Number);
    const t = Date.UTC(y,m-1,d,h,mi,se), dt = new Date(t);
    if (y < 2000 || y > 2100 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m-1 || dt.getUTCDate() !== d || h > 23 || mi > 59 || se > 59) return null;
    return t - 9 * HOUR;
  }

  // One high-water mark per room survives queue restarts and period changes.
  // A later observed start is eligible; unknown/stale starts stay excluded.
  function normalizeHistory(value) {
    const result = new Map();
    for (const r of Array.isArray(value) ? value : []) {
      if (!r || !liveUrl(r.slug) || !Number.isSafeInteger(r.at) || r.at <= 0) continue;
      const startedAt = validStart(r.startedAt);
      if (startedAt && startedAt > r.at) continue;
      if (!result.has(r.slug) || result.get(r.slug).at < r.at) result.set(r.slug, { slug: r.slug, startedAt, at: r.at });
    }
    return [...result.values()];
  }
  function isRecorded(room, records) {
    const r = asRoom(room);
    return records.some(d => d.slug === r.slug && (CONFIG.kind !== 'sr' || !validStart(r.startedAt) || r.startedAt <= d.at));
  }

  function roomsOnly(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.slice(0, 300).filter(r => {
      if (!r || !liveUrl(r.slug) || seen.has(r.slug)) return false;
      seen.add(r.slug); return true;
    }).map(r => ({ slug: r.slug, name: cleanName(r.name || r.slug), roomId: validRoomId(r.roomId), startedAt: validStart(r.startedAt) }));
  }
  function normalizeState(value, period) {
    const s = value && value.period === period.key ? value : {};
    const seen = new Set();
    const done = (Array.isArray(s.done) ? s.done : []).filter(r => {
      if (!r || !liveUrl(r.slug) || !Number.isFinite(r.at) || r.at < period.start || r.at >= period.end || seen.has(recordKey(r)) || (validStart(r.startedAt) && r.startedAt > r.at)) return false;
      seen.add(recordKey(r)); return true;
    }).slice(0, 300).map(r => ({ slug: r.slug, startedAt: validStart(r.startedAt), at: r.at }));
    const queue = roomsOnly(s.queue);
    const index = integer(s.index, 0, Math.max(0, queue.length - 1), 0);
    const cp = s.checkpoint;
    return { period: period.key, listUrl: returnListUrl(s.listUrl), done, adjustment: integer(s.adjustment, -300, 100, 0), queue, index,
      run: typeof s.run === 'string' ? s.run.slice(0, 100) : '', active: s.active === true && queue.length > 0,
      checkpoint: cp && validSlug(cp.slug) && Number.isFinite(cp.elapsed) && cp.elapsed >= 0 && cp.elapsed <= 120000
        ? { slug: cp.slug, startedAt: validStart(cp.startedAt), elapsed: cp.elapsed } : null };
  }
  const countDone = (s, target) => Math.max(0, Math.min(target, s.done.length + s.adjustment));
  function addDone(s, room, now, period) {
    const r = asRoom(room);
    if (s.period !== period.key || now < period.start || now >= period.end || !liveUrl(r.slug)) return false;
    if (!isRecorded(r, s.done)) s.done.push({ slug: r.slug, startedAt: validStart(r.startedAt), at: now });
    s.checkpoint = null;
    return true;
  }
  function adjustCount(s, n) { s.adjustment = n - s.done.length; }
  function migrateLegacy(legacy, period) {
    return normalizeState({ period: period.key, done: legacy?.completed }, period);
  }
  // Only media time that advanced while visible is counted. No play(), reward API,
  // auto-follow, reward claims, or background viewing is performed.
  function timerDelta(wall, mediaDelta, visible, playing) {
    return visible && playing && wall > 0 && wall <= 1500 && mediaDelta > 0 && mediaDelta <= 2
      ? Math.min(wall, mediaDelta * 1000, 1000) : 0;
  }

  const validRoomId = n => /^[1-9][0-9]{0,11}$/.test(String(n || '')) ? String(n) : '';
  function missionReadUrl(pageUrl, roomId) {
    if (CONFIG.kind !== 'sr' || !validRoomId(roomId)) return '';
    try {
      const u = new URL(pageUrl);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || !['showroom-live.com', 'www.showroom-live.com'].includes(u.hostname)) return '';
      if (listSource(u.href) !== 'official' && !parseRoom(u.href)?.viewing) return '';
      return `${u.origin}/api/mission?room_id=${validRoomId(roomId)}`;
    } catch { return ''; }
  }
  function officialMissionSummary(payload, now) {
    if (!Array.isArray(payload?.genre_list)) return [];
    const daily = payload.genre_list.filter(g => g?.genre === 'daily');
    const slot = periodAt(now).label.startsWith('昼') ? 'day' : 'night';
    if (daily.length !== 1 || daily[0].current_period !== slot) return [];
    const group = daily[0][slot];
    if (!Array.isArray(group?.continuous_mission) || !Array.isArray(group?.single_mission)) return [];

    const rows = [...group.continuous_mission, ...group.single_mission];
    const seen = new Set(), out = [];
    for (const r of rows.slice(0, 100)) {
      if (!r || !Number.isSafeInteger(r.mission_id) || r.mission_id < 1 || typeof r.title !== 'string' || !r.title.includes('視聴') || r.is_active !== 1) continue;
      if (!Number.isSafeInteger(r.current_value) || !Number.isSafeInteger(r.target_value) || r.current_value < 0 || r.target_value < 1 || r.current_value > r.target_value || r.target_value > 100000) continue;
      if (seen.has(r.mission_id)) return [];
      seen.add(r.mission_id); out.push({ id:r.mission_id, title:cleanName(r.title), current:r.current_value, target:r.target_value });
    }
    return out;
  }

  const api = { officialMissionSummary, missionReadUrl, listSource, returnListUrl, officialRooms, parseStartedAt, normalizeHistory, isRecorded, recordKey, periodAt, parseRoom, liveUrl, profileUrl, normalizeState, countDone, addDone, adjustCount, migrateLegacy, timerDelta, roomsOnly };
  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined') module.exports = api;
    return;
  }

  const lifetimeKey = `${CONFIG.id}_runtime_v2`;
  if (window[lifetimeKey]) return;
  window[lifetimeKey] = true;
  let instance = null, mounting = false;
  function context() {
    const abort = new AbortController(), tasks = [];
    return { href: location.href, alive: true, host: null, signal: abort.signal,
      every(fn, delay) { const id = setInterval(fn, delay); tasks.push(() => clearInterval(id)); },
      dispose() { this.alive = false; abort.abort(); tasks.forEach(f => f()); this.host?.remove(); } };
  }

  async function supervise() {
    if (instance && instance.href !== location.href) { instance.dispose(); instance = null; }
    if (mounting) return;
    if (instance) {
      if (instance.host && !instance.host.isConnected && document.body) document.body.appendChild(instance.host);
      return;
    }
    if (!document.body || (!listSource(location.href) && !parseRoom(location.href)?.viewing)) return;
    const ctx = context(); instance = ctx; mounting = true;
    try { await main(ctx); }
    catch {
      if (!ctx.alive) return;
      ctx.host?.remove(); ctx.host = document.createElement('section'); ctx.host.id = CONFIG.id;
      ctx.host.textContent = `${CONFIG.title}: 起動できませんでした。SafariのUserscriptsで、このサイトの許可とスクリプトの有効化を確認して再読み込みしてください。`;
      ctx.host.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483647;background:#161b24;color:white;padding:16px';
      document.body.appendChild(ctx.host);
    } finally { mounting = false; }
  }
  setInterval(() => { if (!document.hidden) void supervise(); }, 600);
  void supervise();
  async function main(ctx) {
    const alive = () => ctx.alive && location.href === ctx.href;
    const every = (fn, delay) => ctx.every(() => { if (alive()) fn(); }, delay);
    const navigate = url => { if (alive()) location.assign(url); };
    const current = parseRoom(location.href);
    const source = listSource(location.href);
    const isList = !!source;
    // Normal profile/follow pages must never be redirected or timed.
    if (!isList && !current?.viewing) return;
    if (!alive() || document.getElementById(CONFIG.id)) return;
    const prefix = CONFIG.key;
    let prefs = await GM.getValue(`${prefix}_prefs`, {});
    prefs = { seconds: [30, 32, 35].includes(prefs?.seconds) ? prefs.seconds : 32,
      target: [10, 20].includes(prefs?.target) ? prefs.target : 20 };
    let favorites = roomsOnly(await GM.getValue(`${prefix}_favorites`, []));
    let period = periodAt(Date.now());
    const storageKey = p => `${prefix}_${p.key}`;
    const listCacheKey = `${prefix}_recent_list`;
    const readListCache = async () => {
      const raw = await GM.getValue(listCacheKey, null);
      if (!raw || !Number.isFinite(raw.at) || Date.now() - raw.at > 15 * 60 * 1000) return { rooms: [], listUrl: backUrl };
      return { rooms: roomsOnly(raw.rooms), listUrl: returnListUrl(raw.listUrl) };
    };
    async function readState(p) {
      let raw = await GM.getValue(storageKey(p), null);
      if (raw === null && CONFIG.kind === 'sr') raw = migrateLegacy(await GM.getValue('srmr_mobile_session_v2', null), p);
      return normalizeState(raw, p);
    }
    let state = await readState(period);
    if (!alive()) return;
    const backUrl = isList ? returnListUrl(location.href) : returnListUrl(state.listUrl);
    const historyKey = `${prefix}_broadcast_history`;
    const readHistory = async () => CONFIG.kind === 'sr' ? normalizeHistory(await GM.getValue(historyKey, [])) : [];
    let history = await readHistory();
    if (!alive()) return;
    if (CONFIG.kind === 'sr') {
      const legacy = await GM.getValue('srmr_mobile_session_v2', null);
      const seed = await GM.getValue(`${historyKey}_seeded`, false);
      history = normalizeHistory([...history, ...state.done, ...(!seed && Array.isArray(legacy?.completed) ? legacy.completed : [])]);
      if (!alive()) return;
      await GM.setValue(historyKey, history); if (!alive()) return; await GM.setValue(`${historyKey}_seeded`, true);
    }
    if (!alive()) return;
    await GM.setValue(storageKey(period), state);
    let busy = false, elapsed = 0, paused = false, ready = false, notice = '', ended = false, boundaryStop = false;
    let lastWall = performance.now(), lastMedia = null, lastTime = null, pending = Promise.resolve();
    const titleFromPage = () => cleanName(document.querySelector('h1')?.textContent || document.title || current?.slug);
    const activeHere = () => !isList && state.active && state.queue[state.index]?.slug === current.slug && !ended;
    const roomHere = () => state.queue[state.index]?.slug === current?.slug ? state.queue[state.index] : { slug: current?.slug, startedAt: null };
    const blocked = r => isRecorded(r, [...history, ...state.done]);
    const blockedHere = () => !isList && blocked(roomHere());
    function resetTimer() {
      elapsed = activeHere() && state.checkpoint && recordKey(state.checkpoint) === recordKey(roomHere()) ? Math.min(state.checkpoint.elapsed, prefs.seconds * 1000) : 0;
      ready = elapsed >= prefs.seconds * 1000;
      lastWall = performance.now(); lastMedia = null; lastTime = null;
    }
    resetTimer();
    if (!alive()) return;
    const host = document.createElement('section'); host.id = CONFIG.id; ctx.host = host;
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
      <div class="sub" id="source"></div><div class="sub" id="period"></div><div class="progress" id="total"></div>
      <div class="sub name" id="name"></div><div class="time" id="time"></div><div class="status" id="status" role="status"></div>
      <div class="row" id="listControls"><select id="seconds" aria-label="視聴目安秒数"><option value="30">30秒</option><option value="32">32秒</option><option value="35">35秒</option></select><select id="target" aria-label="目標ルーム数"><option value="10">10件</option><option value="20">20件</option></select><button class="primary" id="start">続きから開始</button></div>
      <div class="row" id="watchControls"><button class="primary" id="next" disabled>記録して次へ</button><button id="skip">スキップ</button></div>
      <div class="row fold" id="discover"><a class="action" id="follow" target="_blank" rel="noopener noreferrer">♡ フォロー画面</a><button id="favorite">☆ あとで見る</button></div><div class="row fold" id="excludeControls"><button id="exclude">取得済みなので除外</button></div>
      <div class="row fold" id="pauseControls"><button id="pause">一時停止</button><button id="back">中断・一覧へ</button></div>
      <details class="fold" id="officialBox"><summary>公式の進捗（読取専用・試用）</summary>
        <button id="officialRead">公式の進捗を読む</button><label class="note"><input id="officialAuto" type="checkbox" style="width:auto;min-height:24px">この画面で60秒ごとに読む</label>
        <div class="note" id="officialResult" role="status">公式の達成数と配信別の獲得履歴は別です。読み取った進捗は端末件数に自動加算せず、表示だけします。</div>
      </details>
      <details class="fold"><summary>記録の調整・あとで見る</summary>
        <div class="note">この端末の記録です。公式の達成・受取件数とは同期しません。別アプリで視聴した分は件数を合わせてください。取得済みの配信をこの端末に記録して除外します。開始時刻が分からない記録済みルームも安全側で除外します。</div>
        <div class="row"><label>確認した件数 <input id="actual" type="number" min="0" max="20" value="0" inputmode="numeric"></label><button id="adjust">件数を合わせる</button></div>
        <div class="row"><button id="reset">この枠の件数をリセット</button></div><div id="favorites"></div>
        <div class="note">保存先はこのUserscriptsのローカル領域です。お気に入りは時間帯が変わっても残ります。複数アカウント・端末とは自動同期しません。</div>
      </details><div class="note fold" id="caution"></div>
    </div>`;
    document.body.appendChild(host);
    const el = id => root.getElementById(id);
    el('title').textContent = `${CONFIG.title} v${CONFIG.version}`;
    el('source').textContent = isList ? source === 'official' ? '公式の配信中一覧から開始' : source === 'nao' ? 'nao.qa の配信中一覧から開始' : 'ミクチャの配信中一覧から開始' : '';
    el('source').hidden = !isList;
    el('seconds').value = String(prefs.seconds); el('target').value = String(prefs.target);
    el('caution').textContent = CONFIG.kind === 'sr'
      ? '目安到達はミッション成立ではありません。公式の達成・受取を確認してください。切替をまたぐ同じ配信では再達成できません。手動補助の規約適合も保証しません。'
      : 'β版: ブラウザでの視聴コイン付与・現行条件は未検証。まず1ルームで確認してください。0時はこのメモの区切りで、公式条件ではありません。';
    if (!isList) el('follow').href = profileUrl(current.slug);

    const officialAllowed = CONFIG.kind === 'sr' && ['www.showroom-live.com', 'showroom-live.com'].includes(location.hostname);
    el('officialBox').hidden = !officialAllowed;
    let officialLoading = false, officialLastAttempt = -Infinity, officialSnapshot = null;
    function currentRoomId() {
      if (!isList) return validRoomId(roomHere().roomId);
      return listRooms().map(r => validRoomId(r.roomId)).find(Boolean) || '';
    }
    async function readOfficial() {
      if (!officialAllowed || !alive() || document.hidden || officialLoading || performance.now() - officialLastAttempt < 5000) return;
      const url = missionReadUrl(location.href, currentRoomId());
      if (!url) { el('officialResult').textContent = '公式一覧から開始した後に読み取ってください。対象ルームIDを確認できないため通信していません。'; return; }
      const readPeriod = periodAt(Date.now()).key;
      officialLastAttempt = performance.now(); officialLoading = true; el('officialRead').disabled = true;
      officialSnapshot = null; el('officialResult').textContent = '公式の進捗を読取中…';



      const controller = new AbortController();
      const abort = () => controller.abort(); ctx.signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 8000);
      try {
        // Exact first-party GET seen in the official client. Never call /receive.
        const response = await fetch(url, { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const text = await response.text(); if (text.length > 1000000) throw new Error('Oversized');
        const rows = officialMissionSummary(JSON.parse(text), Date.now());
        if (!alive() || periodAt(Date.now()).key !== readPeriod) return;
        if (!rows.length) { el('officialAuto').checked = false; el('officialResult').textContent = '対応する公式データを確認できません。ログイン状態・ミッション画面を確認してください。0件とは扱わず、端末記録も変更していません。'; return; }
        officialSnapshot = { rows, period: readPeriod, at: Date.now() };
        const time = new Date(officialSnapshot.at).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
        el('officialResult').textContent = `公式の進捗（${time}取得）: ` + officialSnapshot.rows.map(r => `${r.title} ${r.current}/${r.target}`).join(' ／ ') + '。受取済み件数・配信別履歴ではありません。';
      } catch {
        if (alive()) { el('officialAuto').checked = false; el('officialResult').textContent = '公式データを読み取れませんでした。端末の記録は変更していません。'; }
      } finally { clearTimeout(timeout); ctx.signal.removeEventListener('abort', abort); officialLoading = false; if (alive()) el('officialRead').disabled = false; }
    }
    el('officialRead').addEventListener('click', () => void readOfficial());
    el('officialAuto').addEventListener('change', () => { if (el('officialAuto').checked) void readOfficial(); });
    if (officialAllowed) every(() => { if (el('officialAuto').checked && performance.now() - officialLastAttempt >= 60000) void readOfficial(); }, 2500);
    function listRooms() {

      if (source === 'official') return officialRooms(document, location.href);
      const scope = CONFIG.kind === 'sr' ? document.querySelector('#roomlist') : document;
      if (!scope) return [];
      const found = [];
      for (const a of scope.querySelectorAll('a[href]')) {
        const r = parseRoom(a.getAttribute('href'), location.href);
        if (!r || (CONFIG.kind === 'mx' && !r.viewing)) continue;
        if (a.closest('[hidden]')) continue;
        const row = a.closest('tr')?.querySelector('td:first-child');
        const text = row?.textContent || a.getAttribute('title') || a.textContent || r.slug;
        const startedAt = CONFIG.kind === 'sr' ? parseStartedAt(text) : null;
        if (startedAt && startedAt > Date.now()) continue;
        found.push({ slug: r.slug, startedAt, name: cleanName(text.split(/[（(]\d{4}\/\d{2}\/\d{2}/)[0]) });
      }
      return roomsOnly(found);
    }
    function available() { return listRooms().filter(r => !blocked(r)); }
    async function cacheCurrentList() {
      if (!isList || !alive()) return;
      const rooms = listRooms();
      if (!rooms.length) return;
      await GM.setValue(listCacheKey, { at: Date.now(), listUrl: returnListUrl(location.href), rooms });
    }
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
      el('excludeControls').hidden = isList || CONFIG.kind !== 'sr';
      el('exclude').disabled = busy || blockedHere();
      el('time').hidden = isList;
      if (isList) {
        const allRooms = listRooms();
        const candidates = allRooms.filter(r => !blocked(r));
        el('name').textContent = `この一覧の未記録 ${candidates.length}ルーム / 記録済み ${allRooms.length - candidates.length}件は候補外`;
        el('start').textContent = count ? `残り${left}件を続ける ▶` : '開始 ▶';
        el('start').disabled = busy || !left || !candidates.length;
        el('status').textContent = notice || (!allRooms.length ? '配信中カードの読込待ち。配信一覧を表示するか、ページを更新してください。' : left ? '途中で閉じても、この枠の記録は残ります。' : '目標件数まで記録済み。公式の結果も確認してください。');
      } else {
        const room = state.queue.find(r => r.slug === current.slug);
        el('name').textContent = room?.name || titleFromPage();
        const counted = blockedHere();
        el('time').textContent = counted ? '記録済み' : ready ? '目安到達' : String(Math.max(0, Math.ceil(prefs.seconds - elapsed / 1000)));
        el('next').textContent = counted && activeHere() ? '次の未記録へ ▶' : !activeHere() ? 'この配信を計測' : ready ? '記録して次へ ▶' : '再生を確認中';
        el('next').disabled = busy || boundaryStop || !left || (activeHere() && !ready && !counted) || (!activeHere() && counted);
        el('skip').disabled = busy || !activeHere();
        el('pause').disabled = busy || !activeHere();
        el('pause').textContent = paused ? '再開' : '一時停止';
        el('status').textContent = notice || (counted ? 'この配信は記録済み。計測・再計上せず、候補から外します。' : !activeHere() ? '計測を始めるか、一覧から続けてください。' : paused ? '一時停止中' : ready ? '公式側を確認してから、記録して次へ進んでください。' : '映像・音声の再生進行中だけ計測。未再生・停止・画面外は数えません。');
        el('favorite').textContent = favorites.some(r => r.slug === current.slug) ? '★ 保存済み' : '☆ あとで見る';
      }
      el('adjust').disabled = busy; el('reset').disabled = busy;
    }
    async function rollover() {
      const p = periodAt(Date.now());
      if (p.key === period.key) return false;
      officialSnapshot = null; el('officialAuto').checked = false; el('officialResult').textContent = '時間帯が切り替わりました。公式データは再読取が必要です。';
      period = p; history = await readHistory(); state = await readState(p); if (!state.active) state.listUrl = backUrl; await GM.setValue(storageKey(p), state);
      ended = true; elapsed = 0; ready = false; lastTime = null; lastMedia = null;
      boundaryStop = CONFIG.kind === 'sr' && !isList;
      notice = boundaryStop ? '時間帯が切り替わりました。同じ配信の継続では再達成できません。一覧に戻り、別の配信へ進んでください。' : '時間帯が切り替わりました。新しい枠の記録に切り替えています。';
      render(); return true;
    }
    function transact(fn, requireActive = false) {
      const p = period, runId = state.run, expectedIndex = state.index;
      const work = pending.then(async () => {
        if (periodAt(Date.now()).key !== p.key) { await rollover(); return false; }
        if (!alive()) return false;
        const latest = await readState(p);
        if (!alive()) return false;
        if (periodAt(Date.now()).key !== p.key) { await rollover(); return false; }
        if (requireActive && (!latest.active || latest.run !== runId || latest.index !== expectedIndex)) {
          state = latest; ended = true; notice = '別の画面で進んだため、この画面の計測を停止しました。'; render(); return false;
        }
        history = await readHistory();
        await fn(latest); if (!alive()) return false; await GM.setValue(storageKey(p), latest);
        if (period.key === p.key) state = latest;
        return true;
      });
      pending = work.catch(() => {});
      return work;
    }
    async function run(fn) {
      if (!alive() || busy) return;
      busy = true; render();
      try { if (!await rollover()) await fn(); }
      catch { paused = true; notice = '保存できませんでした。移動せず再読み込みし、記録を確認してください。'; }
      finally { busy = false; render(); }
    }
    async function remember(room, at = Date.now()) {
      if (CONFIG.kind !== 'sr') return;
      const latest = await readHistory();
      history = normalizeHistory([...latest, { slug: room.slug, startedAt: validStart(room.startedAt), at }]);
      await GM.setValue(historyKey, history);
    }
    function bind(id, fn) { el(id).addEventListener('click', () => void run(fn)); }
    const checkpoint = () => activeHere() ? transact(s => { s.checkpoint = { slug: current.slug, startedAt: validStart(roomHere().startedAt), elapsed }; }, true) : Promise.resolve(true);
    bind('start', async () => {
      await pending; history = await readHistory(); state = await readState(period);
      const rooms = available();
      if (!rooms.length) return;
      if (state.checkpoint) {
        const i = rooms.findIndex(r => recordKey(r) === recordKey(state.checkpoint));
        if (i > 0) rooms.unshift(...rooms.splice(i, 1));
      }
      const ok = await transact(s => { s.listUrl = returnListUrl(location.href); s.queue = rooms.filter(r => !isRecorded(r, [...history, ...s.done])); s.index = 0; s.active = s.queue.length > 0; s.run = `${Date.now()}-${Math.random()}`; });
      if (ok && state.active && periodAt(Date.now()).key === period.key) navigate(liveUrl(state.queue[0].slug));
    });
    async function advance(skip) {
      if (boundaryStop) return;
      if (!activeHere()) {
        if (skip) return;
        const cache = await readListCache();
        const currentRoom = { slug: current.slug, name: titleFromPage(), startedAt: null };
        const ok = await transact(s => {
          const rest = roomsOnly([...cache.rooms, ...s.queue]).filter(r => r.slug !== current.slug && !isRecorded(r, [...history, ...s.done]));
          s.listUrl = cache.listUrl || backUrl;
          s.queue = [currentRoom, ...rest]; s.index = 0; s.run = `${Date.now()}-${Math.random()}`; s.active = true;
        });
        if (ok) { ended = false; notice = ''; resetTimer(); } return;
      }
      if (!skip && !ready && !blockedHere()) return;
      let destination = '';
      const ok = await transact(async s => {
        const room = s.queue[s.index], at = Date.now();
        if (!skip && !isRecorded(room, [...history, ...s.done])) {
          if (!addDone(s, room, at, period)) throw new Error('Period changed');
          await remember(room, at);
        }
        s.checkpoint = null;
        if (countDone(s, prefs.target) < prefs.target) {
          for (let i = s.index + 1; i < s.queue.length; i++) {
            if (!isRecorded(s.queue[i], [...history, ...s.done])) { s.index = i; destination = liveUrl(s.queue[i].slug); break; }
          }
        }
        if (!destination) s.active = false;
      }, true);
      if (!ok || periodAt(Date.now()).key !== period.key) return;
      if (destination) navigate(destination);
      else if (countDone(state, prefs.target) < prefs.target) navigate(backUrl);
      else { ended = true; notice = '目標まで記録しました。公式の結果・受取も確認してください。'; }
    }
    bind('next', () => advance(false)); bind('skip', () => advance(true));
    bind('exclude', async () => {
      await remember(roomHere());
      notice = '取得済みとして候補から除外しました。件数は増やしていません。';
      if (activeHere()) await advance(true);
    });
    bind('pause', async () => { paused = !paused; lastTime = null; await checkpoint(); });
    bind('back', async () => { await checkpoint(); navigate(backUrl); });
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
      const message = CONFIG.kind === 'sr' ? 'この時間帯の件数だけをリセットしますか？取得済み配信の除外履歴とお気に入りは残します。公式側は変更しません。' : '今日の端末の視聴記録をリセットしますか？お気に入りと公式側は変更しません。';
      if (!window.confirm(message)) return;
      await transact(s => Object.assign(s, normalizeState(null, period)));
      ended = true; resetTimer(); notice = CONFIG.kind === 'sr' ? '件数をリセットしました。取得済み配信の除外履歴は残っています。' : '今日の端末の視聴記録をリセットしました。';
    });
    for (const id of ['seconds', 'target']) el(id).addEventListener('change', () => void run(async () => {
      prefs.seconds = [30, 32, 35].includes(Number(el('seconds').value)) ? Number(el('seconds').value) : 32;
      prefs.target = [10, 20].includes(Number(el('target').value)) ? Number(el('target').value) : 20;
      await GM.setValue(`${prefix}_prefs`, prefs); el('actual').max = String(prefs.target); render();
    }));
    el('compact').addEventListener('click', () => { const compact = root.querySelector('.box').classList.toggle('compact'); el('compact').textContent = compact ? '戻す' : '小さく'; });
    // Keep no media samples across app switches, pauses, or bfcache restores.
    document.addEventListener('visibilitychange', () => { lastMedia = null; lastTime = null; lastWall = performance.now(); if (document.hidden) void checkpoint().catch(() => {}); else void run(async () => { await pending; state = await readState(period); resetTimer(); }); }, { signal: ctx.signal });
    window.addEventListener('pageshow', () => { lastMedia = null; lastTime = null; lastWall = performance.now(); void run(async () => { await pending; state = await readState(period); resetTimer(); }); }, { signal: ctx.signal });
    every(() => {
      if (periodAt(Date.now()).key !== period.key) { void run(async () => {}); return; }
      const now = performance.now(), wall = now - lastWall; lastWall = now;
      if (!activeHere() || blockedHere() || paused || busy || ready || document.hidden) { lastMedia = null; lastTime = null; return; }
      const media = [...document.querySelectorAll('video,audio')].find(m => !m.paused && !m.ended && !m.error && m.readyState >= 2);
      const time = media && Number.isFinite(media.currentTime) ? media.currentTime : null;
      elapsed += timerDelta(wall, media === lastMedia && time !== null && lastTime !== null ? time - lastTime : 0, true, !!media);
      lastMedia = media; lastTime = time;
      if (elapsed >= prefs.seconds * 1000) { elapsed = prefs.seconds * 1000; ready = true; }
      render();
    }, 250);
    every(() => { if (!busy) void run(async () => { history = await readHistory(); if (activeHere()) await checkpoint(); else state = await readState(period); }); }, 2500);
    renderFavorites(); render();
    if (isList) { void cacheCurrentList().catch(() => {}); every(() => { void cacheCurrentList().catch(() => {}); }, 5000); }
  }
})();

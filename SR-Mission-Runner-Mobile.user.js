// ==UserScript==
// @name         SR Mission Runner Mobile
// @namespace    https://nao.qa/
// @version      1.6.3
// @description  SHOWROOMの実再生時間を計測し、時間到達で端末へ自動記録して次の配信へ移動。公式回数は読取専用で常時連動。
// @author       ackey + ChatGPT
// @match        https://nao.qa/ap/*
// @match        https://showroom-live.com/*
// @match        https://www.showroom-live.com/*
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// @inject-into  content
// @run-at       document-end
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const CONFIG = {"kind": "sr", "version": "1.6.3", "home": "https://www.showroom-live.com/", "title": "🚀 SR Mission Runner", "key": "srmr_progress_v3", "id": "srmr-mobile"};
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
  function officialOnliveFallback(value) {
    if (CONFIG.kind !== 'sr') return '';
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || !['showroom-live.com','www.showroom-live.com'].includes(u.hostname) || u.pathname !== '/') return '';
      const dest = new URL('/onlive','https://www.showroom-live.com');
      for (const key of ['genre_id','genre']) if (/^\d{1,5}$/.test(u.searchParams.get(key) || '')) dest.searchParams.set(key,u.searchParams.get(key));
      return dest.href;
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
  // Read both current official list layouts. Explicit live markers are required.
  // A HH:MM label has no date: never fabricate a broadcast start from it.
  function officialRooms(doc, base) {
    const found = [];
    const hidden = node => { if (!node) return true; for (let n=node; n && n !== doc.documentElement; n=n.parentElement) { if (n.hidden || n.getAttribute?.('aria-hidden') === 'true') return true; const style=doc.defaultView?.getComputedStyle(n); if (style?.display === 'none' || style?.visibility === 'hidden') return true; } return false; };
    for (const card of doc.querySelectorAll('article.onlivecard:not(.todays-pick)')) {
      if (hidden(card)) continue;
      const item = card.closest('li') || card.parentElement;
      const live = item?.querySelector('.onlivecard-time.is-onlive');
      const a = card.querySelector('a.ga-onlive-click[href], a.onlivecard-link[href]');
      const r = a && parseRoom(a.getAttribute('href'), base);
      if (!r || !live) continue;
      const startedAt = parseStartedAt(live.textContent);
      if (startedAt && startedAt > Date.now()) continue;
      const name = item?.querySelector('.onlivecard-name')?.textContent || card.querySelector('img.onlivecard-bg')?.alt || r.slug;
      found.push({ slug: r.slug, roomId: validRoomId(a.getAttribute('data-room-id')), startedAt, name: cleanName(name) });
    }
    for (const item of doc.querySelectorAll('.onlive-list .st-onlivelist__item')) {
      if (hidden(item)) continue;
      const a = item.querySelector('a.st-onlive__hover-button[href]');
      const time = item.querySelector('time.st-onlive__badge.time');
      const r = a && parseRoom(a.getAttribute('href'), base);
      if (!r || !time) continue;
      const name = item.querySelector('.st-room__name span:last-child')?.textContent || item.querySelector('img.st-onlive__bg')?.alt || r.slug;
      found.push({ slug: r.slug, roomId: validRoomId(a.getAttribute('data-room-id')), startedAt: null, name: cleanName(name) });
    }
    return roomsOnly(found);
  }

  function showroomLoggedOutHint(doc) {
    if (CONFIG.kind !== 'sr') return false;
    const top = [...doc.querySelectorAll('a[href="/account/login"]')].some(n => n.getClientRects().length && doc.defaultView.getComputedStyle(n).visibility !== 'hidden');
    const roomMenu = [...doc.querySelectorAll('select.header-menu option')].some(o => o.value === '3' && o.textContent.trim() === 'ログイン');
    return top || roomMenu;
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
    }).slice(0, 300).map(r => ({ slug: r.slug, startedAt: validStart(r.startedAt), at: r.at, source: ['timer', 'official', 'manual'].includes(r.source) ? r.source : 'legacy' }));
    const queue = roomsOnly(s.queue);
    const index = integer(s.index, 0, Math.max(0, queue.length - 1), 0);
    const cp = s.checkpoint;
    return { period: period.key, listUrl: returnListUrl(s.listUrl), done, adjustment: integer(s.adjustment, -300, 100, 0), queue, index,
      run: typeof s.run === 'string' ? s.run.slice(0, 100) : '', active: s.active === true && queue.length > 0,
      checkpoint: cp && validSlug(cp.slug) && Number.isFinite(cp.elapsed) && cp.elapsed >= 0 && cp.elapsed <= 120000
        ? { slug: cp.slug, startedAt: validStart(cp.startedAt), elapsed: cp.elapsed, hold: cp.hold === true } : null };
  }
  const countDone = (s, target) => Math.max(0, Math.min(target, s.done.length + s.adjustment));
  function addDone(s, room, now, period, source = 'legacy') {
    const r = asRoom(room);
    if (s.period !== period.key || now < period.start || now >= period.end || !liveUrl(r.slug)) return false;
    if (!isRecorded(r, s.done)) s.done.push({ slug: r.slug, startedAt: validStart(r.startedAt), at: now, source: ['timer', 'official', 'manual'].includes(source) ? source : 'legacy' });
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
      seen.add(r.mission_id); out.push({ id:r.mission_id, title:cleanName(r.title), current:r.current_value, target:r.target_value, count: /広告/.test(r.title) ? null : repeatedMissionCount(r) });
    }
    return out;
  }

  // The official SR card uses current_level - (unfinished ? 1 : 0), then subtracts remain_reward for received.
  function repeatedMissionCount(r) {
    if (![r?.current_value, r?.target_value, r?.current_level, r?.max_level, r?.remain_reward].every(Number.isSafeInteger)) return null;
    if (r.target_value < 1 || r.current_value < 0 || r.current_value > r.target_value || r.max_level <= 1 || r.max_level > 10000 || r.current_level < 1 || r.current_level > r.max_level) return null;
    const achieved = r.current_level - (r.current_value === r.target_value ? 0 : 1);
    if (r.remain_reward < 0 || r.remain_reward > achieved) return null;
    return { achieved, received: achieved - r.remain_reward, pending: r.remain_reward, limit: r.max_level };
  }
  function mixchBonusProgress(text) {
    const m = String(text).trim().match(/^視聴ボーナスGET[！!]\s*(\d{1,4})\s*\/\s*(\d{1,4})(?:\s|$)/);
    if (!m) return null;
    const achieved = Number(m[1]), limit = Number(m[2]);
    return achieved >= 1 && limit >= achieved ? { achieved, received: achieved, pending: 0, limit } : null;
  }
  function freshLinkedSnapshot(s, now, kind = CONFIG.kind) {
    if (!s || s.kind !== kind || s.period !== periodAt(now, kind).key || !Number.isSafeInteger(s.at) || s.at > now || now - s.at > (kind === 'sr' ? 90000 : 15 * 60000)) return null;
    if (![s.achieved, s.received, s.pending, s.limit].every(Number.isSafeInteger) || s.limit < 1 || s.limit > 10000 || s.achieved < 0 || s.achieved > s.limit || s.received < 0 || s.pending < 0 || s.received + s.pending !== s.achieved) return null;
    return { kind, period: s.period, at: s.at, achieved: s.achieved, received: s.received, pending: s.pending, limit: s.limit };
  }
  function isAdPage(value) {
    if (CONFIG.kind !== 'sr') return false;
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && ['showroom-live.com', 'www.showroom-live.com'].includes(u.hostname) && /^\/lottery\/ad_reward(?:\/\d+)?\/?$/.test(u.pathname); } catch { return false; }
  }
  // Public room metadata only; do not traverse account state or execute site code.
  function hydrationRoomId(text, slug) {
    if (!validSlug(slug) || typeof text !== 'string' || text.length > 1000000) return '';
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data)) return '';
      const read = ref => {
        let value = Number.isInteger(ref) && ref >= 0 ? data[ref] : null;
        for (let i = 0; i < 4 && Array.isArray(value) && ['Reactive','ShallowReactive'].includes(value[0]); i++) value = data[value[1]];
        return value;
      };
      const root = read(0), roomData = read(root?.data), info = read(roomData?.[`roomInfo-${slug}`]);
      return read(info?.room_url_key) === slug ? validRoomId(read(info?.room_id)) : '';
    } catch { return ''; }
  }
  function visibleElement(node, doc) {
    if (!node.getClientRects().length) return false;
    for (let n = node; n; n = n.parentElement) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') return false;
      const style = doc.defaultView.getComputedStyle(n);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || style.opacity === '0') return false;
    }
    return true;
  }
  function stoppedRoom(doc) {
    // Exact first-party status text only: chat, profiles, playback failure and
    // missing/paused media do not prove a broadcast is offline.
    const selector = CONFIG.kind === 'sr' ? '.room-block p.ta-c' : '[role="alert"].alert';
    return [...doc.querySelectorAll(selector)].some(n => visibleElement(n, doc) && (CONFIG.kind === 'sr'
      ? n.textContent.trim() === '配信停止中'
      : /^(?:現在配信していません|ライブが終了しています)[。！!]?$/.test(n.textContent.trim())));
  }
  function normalizeReviews(value) {
    const result = new Map(), rank = { unconfirmed: 0, manual: 1, official: 2 };
    for (const r of Array.isArray(value) ? value : []) {
      if (!r || !liveUrl(r.slug) || !Number.isSafeInteger(r.at) || r.at <= 0 || r.period !== periodAt(r.at).key || !['timer', 'official', 'manual'].includes(r.source)) continue;
      const startedAt = validStart(r.startedAt);
      if (startedAt && startedAt > r.at) continue;
      const reward = ['official', 'manual'].includes(r.reward) ? r.reward : r.source === 'official' ? 'official' : r.source === 'manual' ? 'manual' : 'unconfirmed';
      const key = `${r.period}:${recordKey(r)}`, previous = result.get(key);
      result.set(key, { slug: r.slug, startedAt, period: r.period, at: previous?.at || r.at, source: previous?.source || r.source,
        reward: previous && rank[previous.reward] > rank[reward] ? previous.reward : reward });
    }
    return [...result.values()].sort((a, b) => a.at - b.at).slice(-300);
  }
  const officialAdsUrl = 'https://www.showroom-live.com/lottery/ad_reward';

  const api = { normalizeReviews, stoppedRoom, hydrationRoomId, showroomLoggedOutHint, officialOnliveFallback, repeatedMissionCount, mixchBonusProgress, freshLinkedSnapshot, isAdPage, officialMissionSummary, missionReadUrl, listSource, returnListUrl, officialRooms, parseStartedAt, normalizeHistory, isRecorded, recordKey, periodAt, parseRoom, liveUrl, profileUrl, normalizeState, countDone, addDone, adjustCount, migrateLegacy, timerDelta, roomsOnly };
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

  async function mountAdPanel(ctx) {
    const saved = await GM.getValue(`${CONFIG.key}_ad_return`, null);
    if (!ctx.alive || !saved || !liveUrl(saved.slug) || !Number.isFinite(saved.elapsed) || !Number.isSafeInteger(saved.at) || saved.at > Date.now() || Date.now()-saved.at > 30*60000) return;
    const prefs = await GM.getValue(`${CONFIG.key}_prefs`, {});
    const seconds = [30,32,35].includes(prefs?.seconds) ? prefs.seconds : 32;
    const host = document.createElement('section'); ctx.host = host; host.id = CONFIG.id;
    host.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#161b24;color:white;border-radius:12px;padding:10px;font:14px/1.5 -apple-system,sans-serif';
    const status = document.createElement('span'); status.textContent = `配信の残り ${Math.max(0,Math.ceil(seconds-saved.elapsed/1000))}秒を保存。広告を見ている間は配信計測に加算しません。Safariのタブ一覧から元の配信タブへ戻ると自動再開します。 `;
    const warning = document.createElement('div'); warning.style.cssText = 'margin-top:6px;color:#ffd48a;font-weight:700';
    const login = document.createElement('a'); login.href = 'https://www.showroom-live.com/account/login'; login.textContent = 'SafariでSHOWROOMにログイン'; login.style.cssText = 'display:none;padding:8px;color:#acf';
    const back = document.createElement('a'); back.href = liveUrl(saved.slug); back.textContent = '元の配信タブが見つからない場合：このタブで開く'; back.style.cssText = 'display:inline-block;padding:8px;color:#acf';
    const hide = document.createElement('button'); hide.textContent = '小さく'; hide.style.cssText='padding:8px'; hide.addEventListener('click',()=>{status.hidden=!status.hidden;warning.hidden=status.hidden;hide.textContent=status.hidden?'表示':'小さく';});
    const refreshLogin = () => { const need = (document.body?.textContent || '').includes('ログインが必要'); warning.textContent = need ? '⚠️ このSafariではSHOWROOMにログインしていないため、広告は公式側で0/0になります。ChromeのログインはSafariへ引き継がれません。' : ''; login.style.display = need ? 'inline-block' : 'none'; };
    host.append(status,warning,login,back,hide); if(ctx.alive)document.body.appendChild(host); refreshLogin(); ctx.every(refreshLogin,1000);
  }

  async function supervise() {
    if (instance && instance.href !== location.href) { instance.dispose(); instance = null; }
    if (mounting) return;
    if (instance) {
      if (instance.host && !instance.host.isConnected && document.body) document.body.appendChild(instance.host);
      return;
    }
    if (!document.body || (!listSource(location.href) && !parseRoom(location.href)?.viewing && !isAdPage(location.href))) return;
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
    if (isAdPage(location.href)) { await mountAdPanel(ctx); return; }
    const current = parseRoom(location.href);
    const source = listSource(location.href);
    const isList = !!source;
    // Normal profile/follow pages must never be redirected or timed.
    if (!isList && !current?.viewing) return;
    if (!alive() || document.getElementById(CONFIG.id)) return;
    const prefix = CONFIG.key;
    let prefs = await GM.getValue(`${prefix}_prefs`, {});
    prefs = { seconds: [30, 32, 35].includes(prefs?.seconds) ? prefs.seconds : 32,
      target: [10, 20].includes(prefs?.target) ? prefs.target : 20, autoNext: prefs?.autoNext !== false };
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
    let adHold = false; // legacy checkpoint compatibility; new ad tabs never set this true
    let lastWall = performance.now(), mediaSamples = new WeakMap(), pending = Promise.resolve();
    let playbackStatus = '', playFeedback = '', storageSyncing = false, graceElapsed = 0, offlineElapsed = 0;
    const reviewKey = `${prefix}_watch_reviews`;
    let reviews = normalizeReviews([...(normalizeReviews(await GM.getValue(reviewKey, []))), ...state.done.map(r => ({ ...r, period: period.key }))]);
    // Upgrade seeds must survive subsequent saves and period-state resets.
    await GM.setValue(reviewKey, reviews);
    if (!alive()) return;
    const titleFromPage = () => cleanName(document.querySelector('h1')?.textContent || document.title || current?.slug);
    const activeHere = () => !isList && state.active && state.queue[state.index]?.slug === current.slug && !ended;
    const roomHere = () => state.queue[state.index]?.slug === current?.slug ? state.queue[state.index] : { slug: current?.slug, startedAt: null };
    const blocked = r => isRecorded(r, [...history, ...state.done]);
    const blockedHere = () => !isList && blocked(roomHere());
    function resetTimer() {
      elapsed = activeHere() && state.checkpoint && recordKey(state.checkpoint) === recordKey(roomHere()) ? Math.min(state.checkpoint.elapsed, prefs.seconds * 1000) : 0;
      adHold = false; // Ignore legacy ad holds so returning users resume normally.
      ready = elapsed >= prefs.seconds * 1000;
      graceElapsed = 0; offlineElapsed = 0;
      lastWall = performance.now(); mediaSamples = new WeakMap();
    }
    resetTimer();
    if (!alive()) return;
    const host = document.createElement('section'); host.id = CONFIG.id; ctx.host = host;
    host.style.cssText = 'position:fixed;left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));z-index:2147483647;pointer-events:none';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;color-scheme:dark}
      *{box-sizing:border-box} .box{pointer-events:auto;background:rgba(16,20,28,.97);padding:12px;border:1px solid #424956;border-radius:18px;box-shadow:0 6px 24px #0005;max-height:70vh;overflow:auto}
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
      .official-view{padding:0!important;max-width:230px}.official-view>div:not(.top):not(#autoControls):not(#autoStatus),.official-view>details,.official-view .top strong{display:none!important}.official-view .top{gap:0}.official-view #compact{width:100%;min-height:44px}.official-view #autoToggle{font-size:12px;width:100%}
      .official-view.player-view>#status{display:block!important;padding:0 8px;font-size:12px}.official-view.player-view>#autoStatus{display:none!important}
    </style><div class="box">
      <div class="top"><strong id="title"></strong><button id="compact" class="small">小さく</button></div>
      <div class="sub" id="source"></div><div class="sub" id="period"></div><div class="progress" id="total"></div>
      <details class="fold" id="linkBox"><summary>公式の回数に連動</summary><button id="linkToggle">公式連動を使う</button><select id="linkedMission" aria-label="連動する視聴ミッション" hidden></select><div class="note" id="linkHelp"></div></details>
      <div id="linkedStatus" class="note" role="status"></div><div id="accountWarning" class="warn" role="status"></div>
      <div class="sub name" id="name"></div><div class="time" id="time"></div><div class="status" id="status" role="status"></div>
      <div class="row" id="playerControls"><button id="playMedia">▶ 配信を再生</button><button id="revealPlayer">公式画面を表示（パネルを退避）</button></div><div class="note" id="playFeedback" role="status"></div><details class="fold" id="playbackDetails"><summary>再生の検出状況</summary><div class="note" id="playbackDiagnostic"></div></details>
      <div class="row" id="listControls"><select id="seconds" aria-label="視聴目安秒数"><option value="30">30秒</option><option value="32">32秒</option><option value="35">35秒</option></select><select id="target" aria-label="目標ルーム数"><option value="10">10件</option><option value="20">20件</option></select><button class="primary" id="start">続きから開始</button></div>
      <details id="reviewBox"><summary id="reviewSummary">取得未確認の視聴記録</summary><div class="note">過去の枠を含む記録です。今回の残り回数ではありません。公式で取得を確認してください。戻っても自動では再計上しません。最新300件を端末に保存します。</div><div id="reviewLinks"></div></details>
      <div class="row" id="autoControls"><button id="autoToggle">自動記録・次へ：ON</button></div><div class="note" id="autoStatus" role="status"></div>
      <div class="row" id="watchControls"><button class="primary" id="next" disabled>記録して次へ</button><button id="skip">スキップ</button></div>
      <div class="row fold" id="discover"><a class="action" id="follow" target="_blank" rel="noopener noreferrer">♡ フォロー画面</a><button id="favorite">☆ あとで見る</button></div><div class="row fold" id="excludeControls"><button id="exclude">取得済みなので除外</button></div>
      <div class="row fold" id="adsControls"><a class="action" id="openAds" href="https://www.showroom-live.com/lottery/ad_reward" target="_blank" rel="noopener noreferrer">広告を別タブで開く ↗</a></div>
      <div class="row fold" id="pauseControls"><button id="pause">一時停止</button><button id="retry">再生を再確認</button><button id="back">中断・一覧へ</button></div>
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
      if (!isList) return hydrationRoomId(document.getElementById('__NUXT_DATA__')?.textContent, current.slug) || validRoomId(roomHere().roomId);
      return listRooms().map(r => validRoomId(r.roomId)).find(Boolean) || '';
    }
    async function readOfficial() {
      if (!officialAllowed || !alive() || document.hidden || officialLoading || performance.now() - officialLastAttempt < 5000) return;
      const url = missionReadUrl(location.href, currentRoomId());
      if (!url) { el('officialResult').textContent = '公式一覧から開始した後に読み取ってください。対象ルームIDを確認できないため通信していません。'; return; }
      const readPeriod = periodAt(Date.now()).key;
      officialLastAttempt = performance.now(); officialLoading = true; el('officialRead').disabled = true;
      officialSnapshot = null; if (CONFIG.kind === 'sr') { linkedSnapshot = null; renderLinked(); } el('officialResult').textContent = '公式の進捗を読取中…';



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
        if (!rows.length) { clearLinked(); el('officialAuto').checked = CONFIG.kind === 'sr'; el('officialResult').textContent = '対応する公式データを確認できません。ログイン状態・ミッション画面を確認してください。0件とは扱わず、端末記録も変更していません。'; return; }
        officialSnapshot = { rows, period: readPeriod, at: Date.now() };
        acceptOfficialRows(rows);
        const time = new Date(officialSnapshot.at).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
        el('officialResult').textContent = `公式の進捗（${time}取得）: ` + officialSnapshot.rows.map(r => `${r.title} ${r.current}/${r.target}`).join(' ／ ') + '。受取済み件数・配信別履歴ではありません。';
      } catch {
        if (alive()) { clearLinked(); el('officialAuto').checked = CONFIG.kind === 'sr'; el('officialResult').textContent = '公式データを読み取れませんでした。端末の記録は変更していません。'; }
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
    const linkKey = `${prefix}_official_link_session`;
    let linkedEnabled = CONFIG.kind === 'sr', linkedSnapshot = null, selectedMission = '';
    try { const saved = JSON.parse(sessionStorage.getItem(linkKey) || 'null'); linkedEnabled = CONFIG.kind === 'sr' || saved?.enabled === true; selectedMission = String(saved?.selected || '').slice(0, 20); linkedSnapshot = CONFIG.kind === 'sr' ? null : freshLinkedSnapshot(saved?.snapshot, Date.now()); } catch { /* Storage denial keeps linking off. */ }
    let officialView = false, playerView = false;
    function showOfficial(value, forPlayer = false) {
      officialView = value; playerView = value && forPlayer;
      root.querySelector('.box').classList.toggle('player-view', playerView);
      root.querySelector('.box').classList.toggle('official-view', value);
      host.style.top = value ? 'max(8px,env(safe-area-inset-top))' : '';
      host.style.bottom = value ? 'auto' : 'max(10px,env(safe-area-inset-bottom))';
      host.style.right = value && !playerView ? 'auto' : '10px';
      host.style.left = playerView ? 'auto' : '10px';
      render();
    }
    function saveLinked() { try { sessionStorage.setItem(linkKey, JSON.stringify({ enabled: linkedEnabled, selected: selectedMission, snapshot: linkedSnapshot })); } catch { /* In-memory mode only. */ } }
    const linkedCount = () => linkedEnabled ? freshLinkedSnapshot(linkedSnapshot, Date.now()) : null;
    function routingRemaining(s) {
      const official = linkedCount(), local = Math.max(0, prefs.target - countDone(s, prefs.target));
      return official ? (prefs.autoNext ? Math.min(local, official.limit - official.achieved) : official.limit - official.achieved) : local;
    }
    function renderLinked() {
      el('linkToggle').textContent = CONFIG.kind === 'sr' ? '公式の回数を再確認' : linkedEnabled ? '公式連動を解除' : '公式連動を使う';
      const c = linkedCount();
      el('linkedStatus').textContent = !linkedEnabled ? '公式連動はOFF。下の件数は端末の手動記録です。' : c ? `公式連動：達成 ${c.achieved}/${c.limit}・受取 ${c.received}・未受取 ${c.pending} ／ 残り ${c.limit-c.achieved}回（${new Date(c.at).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit'})}確認）` : CONFIG.kind === 'mx' ? '公式通知の確認待ち。次の「視聴ボーナスGET！」を検出するまで、端末の手動記録で進みます。' : '公式の連続視聴ミッションを確認待ち。未確認の間は端末の記録で進みます。';
    }
    function clearLinked() { linkedSnapshot = null; saveLinked(); renderLinked(); }
    function acceptLinked(c) {
      if (!linkedEnabled || !alive()) return;
      linkedSnapshot = freshLinkedSnapshot({ ...c, kind: CONFIG.kind, period: periodAt(Date.now()).key, at: Date.now() }, Date.now());
      saveLinked(); render();
    }
    function acceptOfficialRows(rows) {
      const candidates = rows.filter(r => r.count);
      const choose = el('linkedMission'); choose.replaceChildren();
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = '連動する視聴ミッションを選択'; choose.appendChild(blank);
      for (const r of candidates) { const o = document.createElement('option'); o.value = String(r.id); o.textContent = r.title; choose.appendChild(o); }
      if (!selectedMission && candidates.length === 1) selectedMission = String(candidates[0].id);
      choose.value = selectedMission; choose.hidden = candidates.length < 2;
      const selected = candidates.find(r => String(r.id) === selectedMission);
      if (linkedEnabled) { if (selected) acceptLinked(selected.count); else clearLinked(); }
    }
    el('linkedMission').addEventListener('change', () => { selectedMission = el('linkedMission').value; linkedSnapshot = null; saveLinked(); if (officialSnapshot) acceptOfficialRows(officialSnapshot.rows); });
    el('linkToggle').addEventListener('click', () => {
      if (CONFIG.kind === 'sr') { void readOfficial(); return; }
      linkedEnabled = CONFIG.kind === 'sr' || !linkedEnabled; linkedSnapshot = null; saveLinked(); render();
      if (CONFIG.kind === 'sr' && officialAllowed) { el('officialAuto').checked = linkedEnabled; if (linkedEnabled) void readOfficial(); }
    });
    el('linkHelp').textContent = CONFIG.kind === 'sr' ? '公式連動は常にON。表示中は60秒ごと、配信移動・タブ復帰・目安到達時にも再確認します。未取得は確認待ちです。アカウント切替後は再確認してください。端末履歴は変更しません。' : 'このタブで新しく表示された公式の視聴ボーナス通知から残り回数を更新。通知前の過去分は未確認です。アカウント切替時は一度解除。';
    if (CONFIG.kind === 'sr') { el('officialAuto').checked = true; el('officialAuto').disabled = true; el('officialAuto').parentElement.hidden = true; }
    if (linkedEnabled && officialAllowed) el('officialAuto').checked = true;
    const seenToasts = new WeakMap();
    const toastSelector = '[role="alert"].alert.alert-success';
    for (const node of document.querySelectorAll(toastSelector)) seenToasts.set(node,node.textContent);
    if (CONFIG.kind === 'mx') every(() => {
      if (!linkedEnabled || document.hidden) return;
      for (const node of document.querySelectorAll(toastSelector)) {
        if (seenToasts.get(node) === node.textContent || !node.getClientRects().length || node.closest('[hidden],[aria-hidden="true"]')) continue;
        seenToasts.set(node,node.textContent);
        const parsed = mixchBonusProgress(node.textContent); if (parsed) acceptLinked(parsed);
      }
    },250);
    el('adsControls').hidden = CONFIG.kind !== 'sr' || isList;
    el('openAds').addEventListener('click', () => {
      if (CONFIG.kind !== 'sr' || isList || !current?.slug) return;
      adHold = false;
      notice = '広告を別タブで開きました。配信タブが画面外の間は計測せず、戻ると再生確認後に自動再開します。';
      void GM.setValue(`${prefix}_ad_return`, { slug: current.slug, elapsed, at: Date.now(), separateTab: true }).catch(() => {});
      void checkpoint().catch(() => {});
      render();
    });

    let renderedReviews = '';
    function renderReviews() {
      const pendingReviews = reviews.filter(r => r.reward === 'unconfirmed');
      el('reviewSummary').textContent = `取得未確認の視聴記録 ${pendingReviews.length}件`;
      const signature = JSON.stringify(pendingReviews);
      if (signature === renderedReviews) return;
      renderedReviews = signature; el('reviewLinks').replaceChildren();
      for (const r of pendingReviews.slice().reverse()) {
        const a = document.createElement('a'); a.className = 'action'; a.style.display = 'block'; a.style.marginTop = '6px';
        a.href = liveUrl(r.slug); a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = `${r.slug} — ${new Date(r.at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 公式で確認 ↗`;
        const row = document.createElement('div'); row.className = 'row';
        const confirm = document.createElement('button'); confirm.textContent = '公式で確認した';
        confirm.addEventListener('click', () => void run(async () => {
          if (!window.confirm(`${r.slug} の ${new Date(r.at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} の視聴について、公式の取得を確認しましたか？ 時間到達や合計件数だけでは確認できません。`)) return;
          await saveReview({ ...r, reward: 'manual' }); renderReviews();
        }));
        row.append(a, confirm); el('reviewLinks').append(row);
      }
    }
    async function saveReview(record) {
      const raw = await GM.getValue(reviewKey, []);
      const next = normalizeReviews([...(Array.isArray(raw) ? raw : []), record]);
      await GM.setValue(reviewKey, next); reviews = next;
    }
    function render() {
      const count = countDone(state, prefs.target), left = routingRemaining(state);
      renderLinked(); renderReviews();
      const cutoff = CONFIG.kind === 'sr' ? period.label.startsWith('昼') ? '15:00' : '3:00' : '0:00';
      el('period').textContent = `${period.label} / 日本時間`;
      const localLeft = Math.max(0, prefs.target - count);
      const officialCount = linkedCount();
      el('total').textContent = officialCount ? `公式連動 ${officialCount.achieved} / ${officialCount.limit}　あと${left}回` : `端末の記録 ${count} / ${prefs.target}　あと${localLeft}件（${cutoff}まで）`;
      const loggedOut = showroomLoggedOutHint(document);
      el('accountWarning').textContent = loggedOut ? '⚠️ Safari側のSHOWROOMが未ログインです。ChromeのログインはSafariへ引き継がれません。公式ミッション・広告を使う前にSafariでログインしてください。' : '';
      el('listControls').hidden = !isList;
      el('watchControls').hidden = isList;
      el('pauseControls').hidden = isList;
      el('playerControls').hidden = isList || ready || blockedHere() || stoppedRoom(document);
      el('revealPlayer').disabled = busy || boundaryStop;
      el('playMedia').disabled = busy || boundaryStop || paused;
      el('playFeedback').hidden = isList || !playFeedback;
      el('playFeedback').textContent = playFeedback;
      el('playbackDetails').hidden = isList;
      el('discover').hidden = isList;
      el('excludeControls').hidden = isList || CONFIG.kind !== 'sr';
      el('exclude').disabled = busy || blockedHere();
      el('time').hidden = isList;
      el('autoToggle').textContent = `自動記録・次へ：${prefs.autoNext ? 'ON（押すと停止）' : 'OFF'}`;
      const timed = state.done.filter(r => r.source === 'timer').length;
      el('autoStatus').textContent = `${prefs.autoNext ? `${prefs.seconds}秒の再生後、5秒以内の公式確認を待って次へ。明確な非配信は無加算スキップ。` : '自動移動は停止中。'}時間到達の記録 ${timed}件（公式取得の確認とは別）`;
      if (isList) {
        const allRooms = listRooms();
        const candidates = allRooms.filter(r => !blocked(r));
        el('name').textContent = `この一覧の未記録 ${candidates.length}ルーム / 記録済み ${allRooms.length - candidates.length}件は候補外`;
        const fallback = !allRooms.length ? officialOnliveFallback(location.href) : '';
        el('start').textContent = fallback ? 'オンライブ一覧を開く ▶' : count ? `残り${left}件を続ける ▶` : '開始 ▶';
        el('start').disabled = busy || !left || (!candidates.length && !fallback);
        el('status').textContent = notice || (fallback ? '公式トップに配信中カードが出ていないため、オンライブ一覧へ移動して続けます。記録はそのまま引き継ぎます。' : !allRooms.length ? 'オンライブ一覧の配信中カードを読込待ち。少し待つか、ページを更新してください。' : left ? '途中で閉じても、この枠の記録は残ります。' : '目標件数まで記録済み。公式の結果も確認してください。');
      } else {
        const room = state.queue.find(r => r.slug === current.slug);
        el('name').textContent = room?.name || titleFromPage();
        const counted = blockedHere();
        el('time').textContent = counted ? '記録済み' : ready ? '目安到達' : String(Math.max(0, Math.ceil(prefs.seconds - elapsed / 1000)));
        const offline = stoppedRoom(document);
        el('next').textContent = offline ? '次の未記録へ ▶' : officialCount && !left ? (activeHere() && ready ? '記録して終了' : '公式の目標達成') : counted ? '次の未記録へ ▶' : !activeHere() ? 'この配信を計測' : ready ? '記録して次へ ▶' : '再生を確認中';
        el('next').disabled = busy || boundaryStop || (!left && !activeHere()) || (!offline && activeHere() && !ready && !counted);
        el('skip').disabled = busy || boundaryStop;
        el('retry').disabled = busy || offline || boundaryStop;
        el('pause').disabled = busy || !activeHere();
        el('pause').textContent = paused ? '再開' : '一時停止';
        el('status').textContent = offline ? 'この配信は終了しています。記録を増やさず、スキップか次の未記録へ進んでください。' : officialCount && !left ? '公式の目標に到達しました。未受取分は公式画面で受け取ってください。' : notice || (counted ? 'この配信は記録済み。計測・再計上せず、候補から外します。' : !activeHere() ? '計測を始めるか、一覧から続けてください。' : paused ? '一時停止中' : ready ? '公式側を確認してから、記録して次へ進んでください。' : playbackStatus || '映像・音声の再生進行中だけ計測。未再生・停止・画面外は数えません。');
        if (prefs.autoNext && ready && activeHere() && !paused && !offline) {
          el('autoStatus').textContent = `視聴完了。公式取得は別確認。あと${Math.max(0, Math.ceil((5000 - graceElapsed) / 1000))}秒で保存して次へ。待つ場合は自動OFFを押してください。`;
        }
        el('favorite').textContent = favorites.some(r => r.slug === current.slug) ? '★ 保存済み' : '☆ あとで見る';
      }
      if (officialView) el('compact').textContent = playerView ? 'パネルを戻す' : '視聴完了・パネルを戻す';
      if (playerView) el('status').textContent = paused ? '計測は一時停止中です。パネルを戻して再開してください。' : playbackStatus || '再生が進むと計測します。再生できない時はパネルを戻し「配信を再生」を押してください。';
      el('adjust').disabled = busy; el('reset').disabled = busy;
    }
    async function rollover() {
      const p = periodAt(Date.now());
      if (p.key === period.key) return false;
      clearLinked(); el('officialAuto').checked = CONFIG.kind === 'sr'; officialSnapshot = null; el('officialResult').textContent = '時間帯が切り替わりました。公式データは再読取が必要です。';
      period = p; history = await readHistory(); state = await readState(p); if (!state.active) state.listUrl = backUrl; await GM.setValue(storageKey(p), state);
      ended = true; elapsed = 0; ready = false; mediaSamples = new WeakMap();
      boundaryStop = CONFIG.kind === 'sr' && !isList;
      notice = boundaryStop ? '時間帯が切り替わりました。同じ配信の継続では再達成できません。一覧に戻り、別の配信へ進んでください。' : '時間帯が切り替わりました。新しい枠の記録に切り替えています。';
      render(); return true;
    }
    function transact(fn, requireActive = false, beforeCommit = null) {
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
        if (await fn(latest) === false || !alive()) return false;
        const undo = beforeCommit ? await beforeCommit() : null;
        try { await GM.setValue(storageKey(p), latest); }
        catch (error) { if (undo) await undo(); throw error; }
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
      catch { paused = true; notice = '保存できませんでした。移動せず再読み込みし、記録を確認してください。'; if (officialView) showOfficial(false); }
      finally { busy = false; render(); }
    }
    async function remember(room, at = Date.now()) {
      if (CONFIG.kind !== 'sr') return;
      const latest = await readHistory();
      history = normalizeHistory([...latest, { slug: room.slug, startedAt: validStart(room.startedAt), at }]);
      await GM.setValue(historyKey, history);
    }
    async function prepareHistory(room) {
      if (CONFIG.kind !== 'sr' || !room) return null;
      const previous = (await readHistory()).find(r => r.slug === room.slug), at = Date.now();
      await remember(room, at);
      // Undo only our own high-water mark if the period-state write fails.
      return async () => {
        const latest = await readHistory();
        history = normalizeHistory([...latest.filter(r => r.slug !== room.slug || r.at !== at), ...(previous ? [previous] : [])]);
        await GM.setValue(historyKey, history);
      };
    }
    function bind(id, fn) { el(id).addEventListener('click', () => void run(fn)); }
    const checkpoint = () => activeHere() ? transact(s => { s.checkpoint = { slug: current.slug, startedAt: validStart(roomHere().startedAt), elapsed, hold: false }; }, true) : Promise.resolve(true);
    bind('start', async () => {
      await pending; history = await readHistory(); state = await readState(period);
      if (routingRemaining(state) <= 0) { notice = '目標に到達しています。公式の結果・受取を確認してください。'; return; }
      const rooms = available();
      if (!rooms.length) { const fallback = officialOnliveFallback(location.href); if (fallback) navigate(fallback); return; }
      if (state.checkpoint) {
        const i = rooms.findIndex(r => recordKey(r) === recordKey(state.checkpoint));
        if (i > 0) rooms.unshift(...rooms.splice(i, 1));
      }
      const ok = await transact(s => { s.listUrl = returnListUrl(location.href); s.queue = rooms.filter(r => !isRecorded(r, [...history, ...s.done])); s.index = 0; s.active = s.queue.length > 0; s.run = `${Date.now()}-${Math.random()}`; });
      if (ok && state.active && periodAt(Date.now()).key === period.key) navigate(liveUrl(state.queue[0].slug));
    });
    function canAutoAdvance() { return !busy && autoAllowed(false) && graceElapsed >= 5000; }
    // OFF/pause/hidden and explicit offline status are checked again before storage.
    function autoAllowed(skip = false) {
      return alive() && prefs.autoNext && activeHere() && !paused && !document.hidden && !boundaryStop && periodAt(Date.now()).key === period.key &&
        (skip ? stoppedRoom(document) && offlineElapsed >= 1500 : ready && !blockedHere() && !stoppedRoom(document));
    }
    function advanceRemaining(s, automatic) {
      return automatic ? Math.min(routingRemaining(s), Math.max(0, prefs.target - countDone(s, prefs.target))) : routingRemaining(s);
    }
    async function advance(skip, automatic = false) {
      if (boundaryStop || (automatic && !autoAllowed(skip))) return;
      if (!activeHere()) {
        const cache = await readListCache();
        if (skip || blockedHere()) {
          const rest = roomsOnly([...cache.rooms, ...state.queue]).filter(r => r.slug !== current.slug && !isRecorded(r, [...history, ...state.done]));
          if (rest.length) {
            const dest = liveUrl(rest[0].slug);
            const ok = await transact(s => { s.listUrl = cache.listUrl || returnListUrl(s.listUrl); s.queue = rest; s.index = 0; s.run = `${Date.now()}-${Math.random()}`; s.active = true; s.checkpoint = null; });
            if (ok && dest) navigate(dest);
          } else {
            const list = cache.listUrl || returnListUrl(state.listUrl);
            navigate(officialOnliveFallback(list) || (CONFIG.kind === 'sr' && list.includes('showroom-live.com') ? 'https://www.showroom-live.com/onlive' : list));
          }
          return;
        }
        const currentRoom = { slug: current.slug, name: titleFromPage(), startedAt: null };
        const ok = await transact(s => {
          const rest = roomsOnly([...cache.rooms, ...s.queue]).filter(r => r.slug !== current.slug && !isRecorded(r, [...history, ...s.done]));
          s.listUrl = cache.listUrl || backUrl;
          s.queue = [currentRoom, ...rest]; s.index = 0; s.run = `${Date.now()}-${Math.random()}`; s.active = true;
        });
        if (ok) { ended = false; notice = ''; resetTimer(); } return;
      }
      if (!skip && !ready && !blockedHere()) return;
      let destination = '', recordedRoom = null;
      const priorPosition = { run: state.run, index: state.index, active: state.active, checkpoint: state.checkpoint };
      const ok = await transact(async s => {
        if (automatic && !autoAllowed(skip)) return false;
        if (automatic && countDone(s, prefs.target) >= prefs.target) { s.active = false; return; }
        const room = s.queue[s.index], at = Date.now();
        if (!skip && !isRecorded(room, [...history, ...s.done])) {
          if (!addDone(s, room, at, period, 'timer')) throw new Error('Period changed');
          recordedRoom = room;
          const record = s.done.find(r => recordKey(r) === recordKey(room));
          await saveReview({ ...record, period: period.key });
        }
        if (automatic && !autoAllowed(skip)) return false;
        s.checkpoint = null;
        if (advanceRemaining(s, automatic) > 0) {
          for (let i = s.index + 1; i < s.queue.length; i++) {
            if (!isRecorded(s.queue[i], [...history, ...s.done])) { s.index = i; destination = liveUrl(s.queue[i].slug); break; }
          }
        }
        if (!destination) s.active = false;
      }, true, () => prepareHistory(recordedRoom));
      if (!ok || periodAt(Date.now()).key !== period.key) return;
      await pending;
      if (periodAt(Date.now()).key !== period.key) { await rollover(); return; }
      if (automatic && (!prefs.autoNext || paused || document.hidden || !alive() || (skip ? !stoppedRoom(document) : stoppedRoom(document)))) {
        if (skip && alive()) {
          const committedIndex = state.index;
          const restored = await transact(s => {
            if (s.run !== priorPosition.run || s.index !== committedIndex) return false;
            Object.assign(s, priorPosition);
          });
          ended = !restored; offlineElapsed = 0;
          notice = 'スキップを取り消しました。自動ONでこの候補から再開します。';
        } else { ended = true; notice = '時間到達を記録しました。自動移動は停止しました。'; }
        return;
      }
      if (destination) navigate(destination);
      else if (advanceRemaining(state, automatic) > 0) navigate(backUrl);
      else { ended = true; notice = '目標まで記録しました。公式の結果・受取も確認してください。'; }
    }
    el('autoToggle').addEventListener('click', () => {
      prefs.autoNext = !prefs.autoNext;
      if (prefs.autoNext && officialView) showOfficial(false);
      notice = prefs.autoNext ? '時間到達での自動記録・移動を開始します。' : '自動記録・移動を停止しました。';
      const saved = { ...prefs };
      const work = pending.then(() => GM.setValue(`${prefix}_prefs`, saved));
      pending = work.catch(() => { prefs.autoNext = false; notice = '設定を保存できないため、自動移動を停止しました。'; render(); });
      render();
    });
    function playerMedia() {
      // Wrapper presence is the trust boundary, even when empty or inactive.
      // Without wrappers, accept only identified official player containers;
      // .st-loading alone and document-wide media are not player identities.
      const wrappers = [...document.querySelectorAll('.room-video-wrapper')];
      const scopes = wrappers.length ? wrappers : [...document.querySelectorAll('.room-video, .st-container:has(#live-video-player)')];
      const parent = node => node.assignedSlot || node.parentElement || node.getRootNode()?.host;
      const activeHost = (node, hiddenAudio = false) => {
        for (let n = node; n; n = parent(n)) {
          // Audio itself may be non-rendered, but its owning host path must be
          // active. Unassigned light children of an open host are not rendered.
          if (n.parentElement?.tagName === 'SLOT' && n.parentElement.assignedNodes().length) return false;
          if (hiddenAudio && n === node) continue;
          if (n.parentElement?.shadowRoot && !n.assignedSlot) return false;
          if (n.hidden || n.inert || n.getAttribute('aria-hidden') === 'true') return false;
          const style = getComputedStyle(n);
          if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || style.opacity === '0') return false;
        }
        return true;
      };
      const nodes = new Set(), visited = new Set();
      const collect = scope => {
        if (visited.has(scope)) return;
        visited.add(scope);
        if (scope.shadowRoot) collect(scope.shadowRoot);
        // Hidden audio is legitimate in an active host. Hidden video/ancestors
        // identify inactive players; walk composed parents across shadow roots.
        for (const node of scope.querySelectorAll('video,audio')) if (activeHost(node, node.tagName === 'AUDIO')) nodes.add(node);
        for (const node of scope.querySelectorAll('*')) if (node.shadowRoot) collect(node.shadowRoot);
      };
      for (const scope of scopes) if (activeHost(scope)) collect(scope);
      return [...nodes];
    }
    el('playMedia').addEventListener('click', () => {
      if (busy || boundaryStop || paused || document.hidden || stoppedRoom(document)) return;
      const nodes = playerMedia();
      // A single explicit tap starts one native player in the user activation
      // stack. Never await GM storage or call this from a timer/auto navigation.
      const score = m => (!m.paused ? 20 : 0) + (m.readyState >= 2 ? 10 : 0) + (m.currentSrc || m.src || m.srcObject ? 5 : 0);
      const candidates = nodes.filter(m => !m.error && !m.ended).sort((a,b) => score(b) - score(a));
      if (candidates.length > 1 && score(candidates[0]) === score(candidates[1])) { playFeedback = '配信プレイヤーを一意に確認できません。公式画面を表示して再生してください。'; render(); return; }
      const media = candidates[0];
      if (!media) { playFeedback = '配信プレイヤーが見つかりません。公式画面の読込・ログイン・入室制限を確認してください。'; render(); return; }
      const failed = error => {
        if (!alive()) return;
        playFeedback = error?.name === 'NotAllowedError' ? 'Safariが再生を許可しませんでした。公式画面を表示してミュート解除を押すか、ページを再読込してください。'
          : error?.name === 'NotSupportedError' ? '配信データを再生できませんでした。公式画面の読込を確認し、ページを再読込してください。'
          : `再生を開始できませんでした（${cleanName(error?.name || '不明')}）。再生の検出状況を確認してください。`;
        render();
      };
      try {
        const request = media.play();
        playFeedback = '再生を要求しました。実際に再生が進むと残り秒数が減ります。';
        mediaSamples = new WeakMap(); lastWall = performance.now();
        if (request && typeof request.catch === 'function') request.catch(failed);
      } catch (error) { failed(error); }
      render();
    });
    el('revealPlayer').addEventListener('click', () => { if (!busy && !boundaryStop) showOfficial(true, true); });
    bind('next', () => advance(stoppedRoom(document))); bind('skip', () => advance(true));
    bind('exclude', async () => {
      await remember(roomHere());
      notice = '取得済みとして候補から除外しました。件数は増やしていません。';
      if (activeHere()) await advance(true);
    });
    bind('pause', async () => { paused = !paused; mediaSamples = new WeakMap(); await checkpoint(); });
    bind('retry', async () => { paused = false; mediaSamples = new WeakMap(); lastWall = performance.now(); notice = ''; playbackStatus = 'パネルを戻して「配信を再生」を押してください。再生が進むと計測を再開します。'; if (!ready) showOfficial(true, true); });
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
    el('compact').addEventListener('click', () => { if (officialView) { showOfficial(false); el('compact').textContent = '小さく'; return; } const compact = root.querySelector('.box').classList.toggle('compact'); el('compact').textContent = compact ? '戻す' : '小さく'; });
    // Keep no media samples across app switches, pauses, or bfcache restores.
    document.addEventListener('visibilitychange', () => { mediaSamples = new WeakMap(); lastWall = performance.now(); if (document.hidden) void checkpoint().catch(() => {}); else void run(async () => { await pending; state = await readState(period); resetTimer(); }); if (!document.hidden && linkedEnabled && officialAllowed) void readOfficial(); }, { signal: ctx.signal });
    window.addEventListener('pageshow', () => { mediaSamples = new WeakMap(); lastWall = performance.now(); void run(async () => { await pending; state = await readState(period); resetTimer(); }); if (!document.hidden && linkedEnabled && officialAllowed) void readOfficial(); }, { signal: ctx.signal });
    every(() => {
      if (periodAt(Date.now()).key !== period.key) { void run(async () => {}); return; }
      const now = performance.now(), wall = now - lastWall; lastWall = now;
      const offline = !isList && stoppedRoom(document);
      const eligible = activeHere() && prefs.autoNext && !paused && !busy && !document.hidden && !boundaryStop;
      const step = wall > 0 && wall <= 1500 ? Math.min(wall, 1000) : 0;
      offlineElapsed = eligible && offline ? offlineElapsed + step : 0;
      if (eligible && ready && !offline) graceElapsed += step;
      if (!busy && autoAllowed(true)) { void run(() => advance(true, true)); return; }
      if (canAutoAdvance()) { void run(() => advance(false, true)); return; }
      if (!activeHere() || blockedHere() || paused || busy || ready || document.hidden || stoppedRoom(document)) { mediaSamples = new WeakMap(); render(); return; }
      // Sample every candidate independently: a frozen first video must not hide
      // progressing playback. Add at most one delta per tick, never two streams.
      const mediaNodes = playerMedia();
      let delta = 0, candidates = 0, waiting = 0, stopped = 0, errors = 0, advanced = 0;
      for (const media of mediaNodes) {
        const time = Number.isFinite(media.currentTime) ? media.currentTime : null;
        const previous = mediaSamples.get(media);
        const playing = !media.paused && !media.ended && !media.error && media.readyState >= 2;
        delta = Math.max(delta, timerDelta(wall, time !== null && previous !== undefined ? time - previous : 0, true, playing));
        if (media.error) errors++; else if (media.paused || media.ended) stopped++; else if (media.readyState < 2) waiting++;
        if (playing && time !== null && previous !== undefined && time > previous) advanced++;
        if (playing && time !== null) { mediaSamples.set(media, time); candidates++; } else mediaSamples.delete(media);
      }
      el('playbackDiagnostic').textContent = `動画 ${mediaNodes.filter(m => m.tagName === 'VIDEO').length}・音声 ${mediaNodes.filter(m => m.tagName === 'AUDIO').length} / 再生可能 ${candidates}・進行 ${advanced}・停止 ${stopped}・読込 ${waiting}・エラー ${errors}`;
      elapsed += delta;
      if (delta > 0) playFeedback = '';
      playbackStatus = delta > 0 ? '' : candidates ? '再生の進行を確認中。映像が止まっている時は、「配信を再生」を押してください。' : !mediaNodes.length ? '配信プレイヤーの読込待ちです。公式画面の読込・ログイン・入室制限を確認してください。' : errors ? '配信プレイヤーにエラーがあります。公式画面を確認して再読込してください。' : waiting ? '配信データを読込中です。進まない時は「配信を再生」を押してください。' : '配信が停止しています。「配信を再生」を押してください。ミュート中でも再生が進めば計測します。';
      if (elapsed >= prefs.seconds * 1000) { elapsed = prefs.seconds * 1000; ready = true; graceElapsed = 0; if (linkedEnabled && officialAllowed) void readOfficial(); if (prefs.autoNext) showOfficial(true); }
      render();
    }, 250);
    // Slow Safari storage must not set UI busy or repeatedly blank media samples.
    every(() => {
      if (busy || storageSyncing) return;
      storageSyncing = true;
      const sync = async () => { history = await readHistory(); reviews = normalizeReviews([...normalizeReviews(await GM.getValue(reviewKey, [])), ...state.done.map(r => ({ ...r, period: period.key }))]); if (!alive()) return; if (activeHere()) await checkpoint(); else { const latest = await readState(period); if (alive() && !busy) state = latest; } };
      void sync().catch(() => { notice = '途中経過を保存できませんでした。中断前に記録を確認してください。'; }).finally(() => { storageSyncing = false; if (alive()) render(); });
    }, 2500);
    renderFavorites(); render();
    if (linkedEnabled && officialAllowed && !document.hidden) void readOfficial();
    if (isList) { void cacheCurrentList().catch(() => {}); every(() => { void cacheCurrentList().catch(() => {}); }, 5000); }
  }
})();

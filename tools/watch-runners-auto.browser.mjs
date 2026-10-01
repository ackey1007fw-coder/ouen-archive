import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pw = await import(pathToFileURL(join(process.env.PLAYWRIGHT_MODULE_ROOT, 'playwright/index.mjs')));
const engine = process.env.RUNNER_TEST_ENGINE || 'chromium';
const output = process.env.RUNNER_TEST_ARTIFACTS || '/tmp/watch-runners-auto';
await mkdir(output, { recursive: true });
const browser = await pw[engine].launch({ headless: true,
  ...(engine === 'chromium' && process.env.RUNNER_CHROMIUM_PATH ? { executablePath: process.env.RUNNER_CHROMIUM_PATH } : {}),
  ...(process.env.RUNNER_CHROMIUM_ARGS ? { args: JSON.parse(process.env.RUNNER_CHROMIUM_ARGS) } : {}),
});
const now = Date.parse('2026-10-01T12:00:00+09:00');
const results = [];
const targets = [
  { kind: 'sr', file: 'SR-Mission-Runner-Mobile.user.js', prefix: 'srmr_progress_v3', id: 'srmr-mobile', home: 'https://www.showroom-live.com/onlive', slugs: ['one', 'two', 'three'], live: s => `https://www.showroom-live.com/lite/${s}`, key: String(Date.parse('2026-10-01T03:00:00+09:00')) },
  { kind: 'mx', file: 'Mixch-Watch-Helper-Mobile.user.js', prefix: 'mxwh_progress_v1', id: 'mxwh-mobile', home: 'https://mixch.tv/', slugs: ['100001', '100002', '100003'], live: s => `https://mixch.tv/u/${s}/live`, key: String(Date.parse('2026-10-01T00:00:00+09:00')) },
];
async function fixture(t, width, options = {}) {
  const store = new Map();
  const stateKey = `${t.prefix}_${t.key}`;
  store.set(stateKey, { period: t.key, done: [], adjustment: options.adjustment || 0,
    queue: t.slugs.map(slug => ({ slug, roomId: options.official ? '123456' : '' })), index: 0, active: true, run: 'fixture',
    checkpoint: options.complete ? { slug: t.slugs[0], elapsed: 32000, hold: false } : null, listUrl: t.home });
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 500, hasTouch: width < 500, locale: 'ja-JP' });
  let fail = false, delay = false, blockedWrite = null;
  const errors = [], requests = [], checks = [];
  await ctx.exposeBinding('get', async (_s, k, d) => { if (delay) await new Promise(r => setTimeout(r, 450)); return store.has(k) ? structuredClone(store.get(k)) : d; });
  await ctx.exposeBinding('set', async (_s, k, v) => {
    if (delay) await new Promise(r => setTimeout(r, 450));
    if (k === stateKey && v.done.length && fail) throw new Error('Fixture storage denial');
    if (k === stateKey && v.done.length && blockedWrite) await blockedWrite;
    store.set(k, structuredClone(v));
  });
  await ctx.exposeBinding('del', (_s, k) => store.delete(k));
  await ctx.addInitScript(({ code }) => {
    window.GM = { getValue: (k, d) => window.get(k, d), setValue: (k, v) => window.set(k, v), deleteValue: k => window.del(k) };
    document.addEventListener('DOMContentLoaded', () => {
      window.playing = false; window.fixtureHidden = false;
      Object.defineProperty(document, 'hidden', { get: () => window.fixtureHidden, configurable: true });
      for (const m of document.querySelectorAll('video')) {
        for (const [k, get] of Object.entries({ paused: () => m.id === 'frozen' || !window.playing, ended: () => false, error: () => null, readyState: () => 4, currentTime: () => m.id === 'frozen' ? 0 : performance.now() / 1000 })) Object.defineProperty(m, k, { get, configurable: true });
      }
      new Function(code)();
    });
  }, { code: await readFile(join(repo, t.file), 'utf8') });
  await ctx.route('**/*', async route => {
    const r = route.request(); requests.push({ method: r.method(), url: r.url() });
    assert.equal(r.method(), 'GET');
    const u = new URL(r.url());
    if (options.official && u.pathname === '/api/mission') {
      assert.equal(r.url(), 'https://www.showroom-live.com/api/mission?room_id=123456');
      await route.fulfill({ json: { genre_list: [{ genre: 'daily', current_period: 'day', day: { continuous_mission: [{ mission_id: 101, title: '配信を30秒視聴しよう', current_value: 30, target_value: 30, current_level: 20, max_level: 20, remain_reward: 0, is_active: 1 }], single_mission: [] } }] } });
      return;
    }
    const list = u.pathname === '/' || u.pathname === '/onlive';
    const body = list ? t.slugs.map(slug => t.kind === 'mx' ? `<a href="${t.live(slug)}">${slug}</a>` : `<ul><li><article class="onlivecard"><a class="ga-onlive-click" href="/r/${slug}">${slug}</a></article><div class="onlivecard-time is-onlive">LIVE</div></li></ul>`).join('') : '<h1>Fixture</h1><video id="frozen"></video><video id="playing"></video><button id="reward">公式GET</button>';
    await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>` });
  });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date(now) });
  const panel = () => page.locator('#' + t.id), part = id => panel().locator('#' + id);
  const tick = async (ms = 1000) => { await page.clock.runFor(ms); await page.waitForTimeout(150); };
  const check = async (name, fn) => { await fn(); checks.push(name); console.log(`PASS ${t.kind}-${width}: ${name}`); };
  const hidden = async value => { await page.evaluate(v => { window.fixtureHidden = v; document.dispatchEvent(new Event('visibilitychange')); }, value); await tick(); };
  await page.goto(t.live(t.slugs[0])); await panel().waitFor();
  return { ctx, page, panel, part, tick, check, hidden, store, stateKey, errors, requests, checks,
    setFail: v => { fail = v; }, setDelay: v => { delay = v; }, block: () => { let release; blockedWrite = new Promise(r => { release = r; }); return () => { blockedWrite = null; release(); }; } };
}
async function scenario(t, width, name, options, fn) {
  if (process.env.RUNNER_AUTO_CASE && process.env.RUNNER_AUTO_CASE !== name) return;
  const f = await fixture(t, width, options);
  try {
    await fn(f);
    assert.deepEqual(f.errors, []);
    assert.ok(f.requests.every(r => r.method === 'GET' && (!new URL(r.url).pathname.startsWith('/api') || (options.official && r.url === 'https://www.showroom-live.com/api/mission?room_id=123456'))));
    assert.ok(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    results.push({ kind: t.kind, width, name, status: 'passed', checks: f.checks });
  } catch (e) { await f.page.screenshot({ path: join(output, `failure-${t.kind}-${name}-${width}.png`) }); throw e; }
  finally { await f.ctx.close(); }
}
try {
  for (const t of targets) for (const width of [390, 430, 1280]) {
    await scenario(t, width, 'automatic-flow', {}, async f => {
      const { page, part, tick, check, hidden, store, stateKey } = f;
      await check('automatic mode defaults ON; unplayed media never records', async () => { await tick(40000); assert.match(await part('autoToggle').innerText(), /ON/); assert.equal(await part('time').innerText(), '32'); assert.equal(store.get(stateKey).done.length, 0); });
      if (t.kind === 'mx') await check('official screen retreat keeps the automatic OFF switch accessible', async () => { await part('revealOfficial').click(); assert.equal(await part('autoToggle').isVisible(), true); await part('compact').click(); });
      await page.evaluate(() => { window.playing = true; }); await tick(5500);
      await check('frozen first media cannot hide progressing playback', async () => { assert.ok(Number(await part('time').innerText()) < 29); });
      await part('pause').click(); await tick(40000);
      await check('pause stops both recording and navigation', async () => { assert.equal(store.get(stateKey).done.length, 0); assert.equal(page.url(), t.live(t.slugs[0])); });
      await part('pause').click(); await hidden(true); await tick(40000);
      await check('background time never records or navigates', async () => { assert.equal(store.get(stateKey).done.length, 0); assert.equal(page.url(), t.live(t.slugs[0])); });
      await hidden(false); await part('autoToggle').click(); await tick(40000);
      await check('OFF persists and retains manual confirmation at time completion', async () => { assert.equal(store.get(`${t.prefix}_prefs`).autoNext, false); assert.equal(store.get(stateKey).done.length, 0); assert.equal(page.url(), t.live(t.slugs[0])); if (t.kind === 'mx') { assert.equal(await part('next').isDisabled(), true); await part('compact').click(); } });
      await part('autoToggle').click(); await tick(); await page.waitForURL(t.live(t.slugs[1])); await f.panel().waitFor();
      await check('time completion saves exactly once before navigating; next room resets', async () => { assert.equal(store.get(stateKey).done.length, 1); assert.equal(store.get(stateKey).done[0].source, 'timer'); assert.equal(store.get(stateKey).index, 1); assert.equal(await part('time').innerText(), '32'); assert.match(await part('autoStatus').innerText(), /時間到達の記録 1件/); });
      f.setDelay(true); await page.evaluate(() => { window.playing = true; }); await tick(10000); f.setDelay(false); await page.waitForTimeout(1700);
      await check('slow saves do not interrupt the next timer', async () => { assert.ok(Number(await part('time').innerText()) < 26); });
      if (t.kind === 'mx') await page.evaluate(() => { const n = document.createElement('div'); n.className = 'alert alert-success'; n.setAttribute('role', 'alert'); n.textContent = '視聴ボーナスGET！ 5/20'; document.body.append(n); });
      await tick(40000); await page.waitForURL(t.live(t.slugs[2])); await f.panel().waitFor();
      await check('confirmed receipts stay separate from timer-only records and totals', async () => { assert.equal(store.get(stateKey).done.length, 2); assert.equal(store.get(stateKey).done[1].source, t.kind === 'mx' ? 'official' : 'timer'); if (t.kind === 'mx') assert.match(await part('total').innerText(), /公式連動 5 \/ 20/); });
      await page.evaluate(() => { window.playing = true; }); await tick(40000); await page.waitForURL(t.home); await f.panel().waitFor();
      await check('exhausted queue returns to list and recorded candidates are excluded', async () => { assert.equal(store.get(stateKey).done.length, 3); assert.equal(store.get(stateKey).active, false); assert.equal(await part('start').isDisabled(), true); });
      await f.panel().screenshot({ path: join(output, `auto-${t.kind}-${width}.png`) });
    });
  }
  for (const t of targets) {
    await scenario(t, 390, 'save-failure', {}, async f => {
      f.setFail(true); await f.page.evaluate(() => { window.playing = true; }); await f.tick(40000); await f.tick(10000);
      await f.check('failed final save pauses with no navigation, count, or exclusion', async () => { assert.equal(f.page.url(), t.live(t.slugs[0])); assert.equal(f.store.get(f.stateKey).done.length, 0); assert.match(await f.part('status').innerText(), /保存できません/); assert.equal((f.store.get(`${t.prefix}_broadcast_history`) || []).length, 0); });
      f.setFail(false); await f.part('retry').click(); await f.tick(); await f.page.waitForURL(t.live(t.slugs[1]));
      await f.check('explicit retry saves once and continues', async () => { assert.equal(f.store.get(f.stateKey).done.length, 1); });
    });
    await scenario(t, 390, 'restore-goal', { complete: true, adjustment: 19 }, async f => {
      if (t.kind === 'mx') await f.page.evaluate(() => { const n = document.createElement('div'); n.className = 'alert alert-success'; n.setAttribute('role', 'alert'); n.textContent = '視聴ボーナスGET！ 5/20'; document.body.append(n); });
      await f.tick();
      await f.check('completed checkpoint auto-records once and stops at local target', async () => { assert.equal(f.store.get(f.stateKey).done.length, 1); assert.equal(f.store.get(f.stateKey).active, false); assert.equal(f.page.url(), t.live(t.slugs[0])); await f.tick(40000); assert.equal(f.store.get(f.stateKey).done.length, 1); });
    });
    await scenario(t, 390, 'official-limit', { official: t.kind === 'sr' }, async f => {
      if (t.kind === 'mx') await f.page.evaluate(() => { const n = document.createElement('div'); n.className = 'alert alert-success'; n.setAttribute('role', 'alert'); n.textContent = '視聴ボーナスGET！ 20/20'; document.body.append(n); });
      await f.tick(); await f.page.evaluate(() => { window.playing = true; }); await f.tick(40000);
      await f.check('final current record is saved but official limit prevents another room', async () => { assert.equal(f.store.get(f.stateKey).done.length, 1); assert.equal(f.store.get(f.stateKey).active, false); assert.equal(f.page.url(), t.live(t.slugs[0])); assert.match(await f.part('total').innerText(), /公式連動 20 \/ 20/); });
    });
    await scenario(t, 390, 'cancel-during-save', {}, async f => {
      const release = f.block(); await f.page.evaluate(() => { window.playing = true; }); await f.tick(40000);
      await f.part('autoToggle').click(); release(); await f.tick();
      await f.check('OFF during delayed commit stops navigation after recording once', async () => { assert.equal(f.page.url(), t.live(t.slugs[0])); assert.equal(f.store.get(f.stateKey).done.length, 1); assert.equal(f.store.get(`${t.prefix}_prefs`).autoNext, false); });
    });
    await scenario(t, 390, 'period-boundary', {}, async f => {
      await f.page.evaluate(() => { window.playing = true; }); await f.tick(10000);
      await f.page.clock.setSystemTime(new Date(t.kind === 'sr' ? '2026-10-01T15:00:00+09:00' : '2026-10-02T00:00:00+09:00')); await f.tick(40000);
      await f.check('period rollover cancels incomplete timer and never jumps', async () => { assert.equal(f.page.url(), t.live(t.slugs[0])); assert.equal(f.store.get(f.stateKey).done.length, 0); });
    });
    await scenario(t, 390, 'boundary-during-save', {}, async f => {
      const release = f.block(); await f.page.evaluate(() => { window.playing = true; }); await f.tick(40000);
      await f.page.clock.setSystemTime(new Date(t.kind === 'sr' ? '2026-10-01T15:00:00+09:00' : '2026-10-02T00:00:00+09:00')); release(); await f.tick();
      await f.check('a boundary during the final write prevents old-queue navigation', async () => { assert.equal(f.page.url(), t.live(t.slugs[0])); assert.equal(f.store.get(f.stateKey).done.length, 1); assert.equal([...f.store].filter(([k, v]) => k.startsWith(t.prefix + '_') && v?.period && k !== f.stateKey).every(([, v]) => v.done.length === 0), true); });
    });
    await scenario(t, 390, 'concurrent-run', {}, async f => {
      await f.page.evaluate(() => { window.playing = true; }); await f.tick(10000);
      f.store.get(f.stateKey).run = 'another-screen'; await f.tick(40000);
      await f.check('a replaced run cancels this screen without a duplicate record or jump', async () => { assert.equal(f.page.url(), t.live(t.slugs[0])); assert.equal(f.store.get(f.stateKey).done.length, 0); });
    });
  }
} finally {
  await browser.close();
  await writeFile(join(output, 'report.json'), JSON.stringify({ engine, scope: 'Synthetic pages, real navigation and asynchronous storage; no authenticated rewards or physical iPhone verified.', results }, null, 2) + '\n');
}

import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pw = await import(pathToFileURL(join(process.env.PLAYWRIGHT_MODULE_ROOT, 'playwright/index.mjs')));
const engine = process.env.RUNNER_TEST_ENGINE || 'chromium';
const output = process.env.RUNNER_TEST_ARTIFACTS || '/tmp/mixch-receipt-tests';
await mkdir(output, { recursive: true });
const code = await readFile(join(repo, 'Mixch-Watch-Helper-Mobile.user.js'), 'utf8');
const launch = { headless: true };
if (engine === 'chromium' && process.env.RUNNER_CHROMIUM_PATH) launch.executablePath = process.env.RUNNER_CHROMIUM_PATH;
if (process.env.RUNNER_CHROMIUM_ARGS) launch.args = JSON.parse(process.env.RUNNER_CHROMIUM_ARGS);
const browser = await pw[engine].launch(launch);
const now = Date.parse('2026-10-01T12:57:00+09:00');
const key = String(Date.parse('2026-10-01T00:00:00+09:00'));
const results = [];
try {
  for (const width of [390, 430, 1280]) {
    const errors = [], requests = [], checks = [];
    let delayStorage = false;
    const store = new Map([
      [`mxwh_progress_v1_${key}`, { period: key, done: [], adjustment: 0, queue: [{ slug: '100001' }, { slug: '100002' }], index: 0, active: true, run: 'fixture', checkpoint: null, listUrl: 'https://mixch.tv/' }],
      ['mxwh_progress_v1_recent_list', { at: now, listUrl: 'https://mixch.tv/', rooms: [{ slug: '100001' }, { slug: '100002' }] }],
    ]);
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 500, hasTouch: width < 500, locale: 'ja-JP' });
    const waitStorage = () => delayStorage ? new Promise(resolve => setTimeout(resolve, 450)) : Promise.resolve();
    await ctx.exposeBinding('fixtureGet', async (_s, k, d) => { await waitStorage(); return store.has(k) ? structuredClone(store.get(k)) : d; });
    await ctx.exposeBinding('fixtureSet', async (_s, k, v) => { await waitStorage(); store.set(k, structuredClone(v)); });
    await ctx.exposeBinding('fixtureDelete', (_s, k) => store.delete(k));
    await ctx.addInitScript(code => {
      window.GM = { getValue: (k, d) => window.fixtureGet(k, d), setValue: (k, v) => window.fixtureSet(k, v), deleteValue: k => window.fixtureDelete(k) };
      // Reproduce an old OFF setting; v0.4 must ignore it.
      try { if (!sessionStorage.getItem('mxwh_progress_v1_official_link_session')) sessionStorage.setItem('mxwh_progress_v1_official_link_session', JSON.stringify({ enabled: false })); } catch { /* about:blank has no storage. */ }
      document.addEventListener('DOMContentLoaded', () => {
        window.playing = false;
        for (const m of document.querySelectorAll('video')) {
          for (const [k, get] of Object.entries({ paused: () => m.id === 'frozen' || !window.playing, ended: () => false, error: () => null, readyState: () => 4, currentTime: () => m.id === 'frozen' ? 0 : performance.now() / 1000 })) Object.defineProperty(m, k, { get, configurable: true });
        }
        new Function(code)();
      });
    }, code);
    await ctx.route('**/*', async route => {
      const request = route.request(); requests.push({ method: request.method(), url: request.url() });
      assert.equal(request.method(), 'GET');
      const body = new URL(request.url()).pathname === '/' ? '<a href="/u/100001/live">One</a><a href="/u/100002/live">Two</a>' : '<h1>Fixture live</h1><video id="frozen"></video><video id="playing"></video><div id="old" class="alert alert-success" role="alert">視聴ボーナスGET！ 8/20</div><div id="chat"></div><button id="officialGET" style="position:fixed;bottom:130px;left:10px;width:120px;height:44px">公式GET</button><button id="officialOther" style="position:fixed;bottom:50px;right:10px;width:100px;height:44px">公式操作</button>';
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>` });
    });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.clock.install({ time: new Date(now) });
    const panel = () => page.locator('#mxwh-mobile');
    const part = id => panel().locator('#' + id);
    const tick = async (ms = 1000) => { await page.clock.runFor(ms); await page.waitForTimeout(150); };
    const check = async (name, fn) => { await fn(); checks.push(name); console.log(`PASS ${engine}-${width}: ${name}`); };
    const alert = async (text, hidden = false) => { await page.evaluate(({ text, hidden }) => { const n = document.createElement('div'); n.id = 'fresh'; n.className = 'alert alert-success'; n.setAttribute('role', 'alert'); n.hidden = hidden; n.textContent = text; document.body.appendChild(n); }, { text, hidden }); await tick(); };
    try {
      await page.goto('https://mixch.tv/u/100001/live'); await panel().waitFor();
      await check('linking is always ON; existing notification and local zero do not imply receipt', async () => { assert.match(await part('linkedStatus').innerText(), /公式連動ON.*確認待ち/); assert.equal(await part('next').isDisabled(), true); assert.doesNotMatch(await part('time').innerText(), /取得確認済み/); });
      await page.evaluate(() => { window.playing = true; });
      delayStorage = true;
      await tick(9000);
      await check('frozen first media and slow storage do not stop active playback counting', async () => { const remaining = Number(await part('time').innerText()); assert.ok(remaining < 29 && remaining > 15); });
      delayStorage = false;
      await tick(40000);
      await check('timer completion reveals official UI and cannot add an unconfirmed receipt', async () => {
        assert.match(await part('compact').innerText(), /取得未確認/);
        assert.equal(await part('next').isDisabled(), true); assert.equal(store.get(`mxwh_progress_v1_${key}`).done.length, 0);
        for (const id of ['officialGET', 'officialOther']) assert.equal(await page.locator('#' + id).evaluate(n => { const r = n.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === n; }), true);
        await page.screenshot({ path: join(output, `official-visible-${width}.png`) });
      });
      await part('compact').click();
      await page.evaluate(() => { document.getElementById('chat').textContent = '視聴ボーナスGET！ 9/20'; }); await tick();
      await alert('視聴ボーナスGET！ 9/20', true);
      await check('chat and hidden notices never become confirmed receipts', async () => { assert.match(await part('time').innerText(), /取得未確認/); assert.equal(await part('next').isDisabled(), true); });
      await page.evaluate(() => { document.getElementById('fresh').hidden = false; }); await tick();
      await check('a new visible official success confirms this room and the official total', async () => { assert.equal(await part('time').innerText(), '取得確認済み'); assert.match(await part('total').innerText(), /公式連動 9 \/ 20/); assert.equal(await part('next').isDisabled(), false); });
      await page.reload(); await panel().waitFor();
      await check('receipt survives reload only for the exact confirmed room', async () => { assert.equal(await part('time').innerText(), '取得確認済み'); await part('next').click(); await page.waitForURL('https://mixch.tv/u/100002/live'); await panel().waitFor(); assert.equal(store.get(`mxwh_progress_v1_${key}`).done.length, 1); assert.doesNotMatch(await part('time').innerText(), /取得確認済み/); assert.equal(await part('next').isDisabled(), true); });
      await check('unconfirmed room can be skipped without counting or waiting forever', async () => { await part('skip').click(); await page.waitForURL('https://mixch.tv/'); await panel().waitFor(); assert.equal(store.get(`mxwh_progress_v1_${key}`).done.length, 1); });
      await page.goto('https://mixch.tv/u/100002/live'); await panel().waitFor();
      await check('manual confirmation can be cancelled and never changes the official total', async () => {
        page.once('dialog', d => d.dismiss()); await part('confirmReceipt').click(); assert.doesNotMatch(await part('time').innerText(), /本人確認済み/);
        page.once('dialog', d => d.accept()); await part('confirmReceipt').click(); assert.equal(await part('time').innerText(), '本人確認済み'); assert.match(await part('total').innerText(), /公式連動 9 \/ 20/);
      });
      await check('expiration never fabricates confirmation or a zero official total', async () => { await page.clock.setSystemTime(new Date(now + 16 * 60000)); await tick(); assert.doesNotMatch(await part('time').innerText(), /確認済み/); assert.match(await part('linkedStatus').innerText(), /確認待ち/); });
      // A last official receipt must remain recordable even at the upper limit.
      await alert('視聴ボーナスGET！ 20/20');
      await check('last official receipt is recorded without starting another room', async () => { assert.equal(await part('next').isDisabled(), false); await part('next').click(); await tick(); assert.equal(store.get(`mxwh_progress_v1_${key}`).done.length, 2); assert.equal(store.get(`mxwh_progress_v1_${key}`).active, false); await page.goto('https://mixch.tv/'); await panel().waitFor(); assert.equal(await part('start').isDisabled(), true); });
      assert.deepEqual(errors, []); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.ok(requests.every(r => new URL(r.url).hostname === 'mixch.tv' && !new URL(r.url).pathname.startsWith('/api')));
      results.push({ width, status: 'passed', checks });
    } catch (error) { results.push({ width, status: 'failed', checks, error: error.message }); await page.screenshot({ path: join(output, `failure-${width}.png`) }); throw error; }
    finally { await ctx.close(); }
  }
} finally { await browser.close(); await writeFile(join(output, 'report.json'), JSON.stringify({ engine, scope: 'Synthetic media, storage, DOM notifications; no authenticated rewards or physical iPhone verified.', results }, null, 2) + '\n'); }

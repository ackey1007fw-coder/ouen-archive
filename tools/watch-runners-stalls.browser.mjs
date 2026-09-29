import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pw = await import(pathToFileURL(join(process.env.PLAYWRIGHT_MODULE_ROOT, 'playwright/index.mjs')));
const engine = process.env.RUNNER_TEST_ENGINE || 'chromium';
const browser = await pw[engine].launch({headless:true, ...(engine === 'chromium' && process.env.RUNNER_CHROMIUM_PATH ? {executablePath:process.env.RUNNER_CHROMIUM_PATH} : {})});
const code = await readFile(join(repo, 'SR-Mission-Runner-Mobile.user.js'), 'utf8');
const output = process.env.RUNNER_TEST_ARTIFACTS || '/tmp/sr-stalls';
await mkdir(output, {recursive:true});
const now = Date.parse('2026-09-30T06:40:00+09:00');
const key = String(Date.parse('2026-09-30T03:00:00+09:00'));
const results = [];
const cases = ['frozen-first-media', 'offline-escape', 'slow-storage', 'always-linked', 'single-room-id', 'hidden-resume'];
try {
  for (const name of cases.filter(n => !process.env.RUNNER_CASE || n === process.env.RUNNER_CASE)) {
    const requests = [], errors = [];
    let denied = false;
    const store = new Map([
      [`srmr_progress_v3_${key}`, {period:key,done:[],adjustment:0,queue:[{slug:'one',roomId:'123456'},{slug:'two',roomId:'234567'}],index:0,run:'fixture',active:name !== 'offline-escape',checkpoint:null,listUrl:'https://www.showroom-live.com/onlive'}],
      ['srmr_progress_v3_recent_list', {at:now,listUrl:'https://www.showroom-live.com/onlive',rooms:[{slug:'one',roomId:'123456'},{slug:'two',roomId:'234567'}]}],
    ]);
    if (name === 'single-room-id') store.clear();
    const ctx = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP'});
    const delay = () => name === 'slow-storage' ? new Promise(resolve => setTimeout(resolve, 450)) : Promise.resolve();
    await ctx.exposeBinding('get', async (_s,k,d) => {await delay();return store.has(k) ? structuredClone(store.get(k)) : d;});
    await ctx.exposeBinding('set', async (_s,k,v) => {await delay();store.set(k,structuredClone(v));});
    await ctx.exposeBinding('del', (_s,k) => store.delete(k));
    await ctx.addInitScript(({code,name}) => {
      window.GM = {getValue:(k,d)=>window.get(k,d),setValue:(k,v)=>window.set(k,v),deleteValue:k=>window.del(k)};
      sessionStorage.setItem('srmr_progress_v3_official_link_session', JSON.stringify({enabled:false}));
      document.addEventListener('DOMContentLoaded', () => {
        window.fixturePaused = false;
        window.fixtureFrozen = false;
        for (const m of document.querySelectorAll('video,audio')) {
          const frozen = m.id === 'frozen';
          for (const [k,get] of Object.entries({paused:()=>window.fixturePaused,ended:()=>false,error:()=>null,readyState:()=>4,currentTime:()=>frozen || window.fixtureFrozen ? 0 : performance.now()/1000})) Object.defineProperty(m,k,{get,configurable:true});
        }
        if (name === 'single-room-id') document.getElementById('__NUXT_DATA__').textContent = JSON.stringify([['ShallowReactive',1],{data:2},['ShallowReactive',3],{'roomInfo-one':4},{room_url_key:5,room_id:6},'one',123456]);
        new Function(code)();
      });
    }, {code,name});
    await ctx.route('**/*', async route => {
      const u = new URL(route.request().url());
      requests.push({method:route.request().method(),url:u.href});
      assert.equal(route.request().method(),'GET');
      if (u.pathname === '/api/mission') {
        const row = {mission_id:101,title:'配信を30秒視聴しよう',current_value:0,target_value:30,current_level:9,max_level:20,remain_reward:2,is_active:1};
        await route.fulfill({status:denied?403:200,contentType:'application/json',body:JSON.stringify({genre_list:[{genre:'daily',current_period:'day',day:{continuous_mission:[row],single_mission:[]}}]})});return;
      }
      const offline = name === 'offline-escape' && u.pathname.endsWith('/one');
      const body = `<h1>Fixture room</h1>${offline?'<div class="room-block"><div><p class="ta-c">配信停止中</p></div></div>':''}<div class="room-video-wrapper">${name === 'frozen-first-media'?'<video id="frozen"></video>':''}<video id="player"></video></div><script type="application/json" id="__NUXT_DATA__">[]</script>`;
      await route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`});
    });
    const p = await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/lite/one');
    const panel = p.locator('#srmr-mobile');await panel.waitFor();
    const part = id => panel.locator('#'+id);
    const tick = async ms => {await p.clock.runFor(ms);await p.waitForTimeout(name === 'slow-storage'?1600:150);};
    if (name === 'offline-escape') {
      assert.match(await part('status').innerText(),/配信.*終了|配信停止/);
      assert.equal(await part('skip').isDisabled(),false);
      await part('skip').click();await p.waitForURL('**/lite/two');
      assert.equal(store.get(`srmr_progress_v3_${key}`).done.length,0);
    } else if (name === 'always-linked' || name === 'single-room-id') {
      await p.waitForTimeout(200);assert.match(await part('linkedStatus').innerText(),/達成 8\/20・受取 6・未受取 2/);
      assert.ok(requests.some(r=>r.url.endsWith('/api/mission?room_id=123456')));
      denied = true;await tick(65000);assert.match(await part('linkedStatus').innerText(),/確認待ち/);
      assert.equal(await part('officialAuto').isChecked(),true);
      denied = false;await tick(65000);assert.match(await part('linkedStatus').innerText(),/達成 8\/20/);
      assert.equal(store.get(`srmr_progress_v3_${key}`).done.length,0);
    } else if (name === 'hidden-resume') {
      await tick(5000);const before = Number(await part('time').innerText());
      await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
      await tick(20000);assert.equal(Number(await part('time').innerText()),before);
      await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(200);
      await tick(4000);assert.ok(Number(await part('time').innerText())<before);
      await p.evaluate(()=>{window.fixturePaused=true;});const paused=Number(await part('time').innerText());await tick(3000);assert.equal(Number(await part('time').innerText()),paused);
    } else {
      await tick(9000);assert.ok(Number(await part('time').innerText())<30, 'Actual progressing media must advance even with frozen first media or delayed GM storage');
      await p.evaluate(()=>{window.fixtureFrozen=true;});const n=Number(await part('time').innerText());await tick(3000);assert.equal(Number(await part('time').innerText()),n,'Frozen playback must not count');
      if (name === 'frozen-first-media') {
        await part('retry').click();await p.evaluate(()=>{window.fixtureFrozen=false;});await tick(4000);assert.ok(Number(await part('time').innerText())<n);
      }
    }
    assert.deepEqual(errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await panel.screenshot({path:join(output,`${engine}-${name}.png`)});
    results.push({name,status:'passed'});console.log(`PASS ${engine}: ${name}`);await ctx.close();
  }
} finally {await browser.close();await writeFile(join(output,`${engine}-report.json`),JSON.stringify({scope:'Isolated fixtures; no real iPhone or official reward verification.',results},null,2)+'\n');}

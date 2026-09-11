import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const toolRoot = process.env.PLAYWRIGHT_MODULE_ROOT;
if (!toolRoot) throw new Error('Set PLAYWRIGHT_MODULE_ROOT to an isolated Playwright node_modules directory');
const playwright = await import(pathToFileURL(join(toolRoot, 'playwright/index.mjs')));
const engine = process.env.RUNNER_TEST_ENGINE || 'chromium';
if (!['chromium', 'webkit'].includes(engine)) throw new Error('Unsupported test engine');
const repo = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(process.env.RUNNER_TEST_ARTIFACTS || join(repo, '.runner-test-artifacts'));
await mkdir(output, {recursive:true});
const report = { engine, scope: 'Browser fixtures; no live service requests or official rewards tested; iPhone viewport emulation, not a physical device.', results: [] };
const startTime = Date.parse('2026-09-11T08:00:00+09:00');
const targets = [
  {kind:'sr',file:'SR-Mission-Runner-Mobile.user.js',prefix:'srmr_progress_v3',id:'srmr-mobile',home:'https://nao.qa/ap/search.php?kw=&genre=103',one:'room-one',two:'room-two',live:s=>`https://www.showroom-live.com/lite/${s}`,profile:s=>`https://www.showroom-live.com/r/${s}`},
  {kind:'mx',file:'Mixch-Watch-Helper-Mobile.user.js',prefix:'mxwh_progress_v1',id:'mxwh-mobile',home:'https://mixch.tv/',one:'100001',two:'100002',live:s=>`https://mixch.tv/u/${s}/live`,profile:s=>`https://mixch.tv/u/${s}`}
];
targets.push({...targets[0],scenario:'sr-official',home:'https://www.showroom-live.com/'});
const browser = await playwright[engine].launch({headless:true});
try {
  for (const target of targets) for (const width of [390,430,1280]) {
    const store = new Map(), errors = [], navigations = [];
    let firstStart='2026/09/11 07:00:00';
    const context = await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,timezoneId:'America/Los_Angeles',locale:'ja-JP'});
    const source = await readFile(join(repo,target.file),'utf8');
    await context.exposeBinding('fixtureGet',(_source,key,def)=>store.has(key)?structuredClone(store.get(key)):def);
    await context.exposeBinding('fixtureSet',(_source,key,value)=>{store.set(key,structuredClone(value));});
    await context.exposeBinding('fixtureDelete',(_source,key)=>{store.delete(key);});
    await context.addInitScript(({source})=>{
      window.GM={getValue:(k,d)=>window.fixtureGet(k,d),setValue:(k,v)=>window.fixtureSet(k,v),deleteValue:k=>window.fixtureDelete(k)};
      window.addEventListener('DOMContentLoaded',()=>{
        const media=document.querySelector('video');
        if(media){
          window.fixturePaused=true;
          for(const [k,get] of Object.entries({paused:()=>window.fixturePaused,ended:()=>false,error:()=>null,readyState:()=>4,currentTime:()=>performance.now()/1000}))Object.defineProperty(media,k,{get,configurable:true});
        }
        // Evaluates only the locally supplied script in this isolated test page.
        new Function(source)();
      });
    },{source});
    await context.route('**/*',async route=>{
      const request=route.request();
      if(request.isNavigationRequest())navigations.push(request.url());
      const u=new URL(request.url());
      const official=target.kind==='sr' && u.hostname==='www.showroom-live.com' && ['/', '/onlive'].includes(u.pathname);
      const list=request.url()===target.home || (target.kind==='sr'&&u.hostname==='nao.qa') || (target.kind==='mx'&&u.pathname==='/');
      const profile=request.url()===target.profile(target.one);
      const card=(slug,{live=true,extra='',style='',href=`/r/${slug}`,hidden=''}={})=>`<li style="${style}" ${hidden}><article class="onlivecard ${extra}"><div class="onlivecard-overview"><a class="ga-onlive-click" href="${href}">入室</a></div></article><div class="onlivecard-time ${live?'is-onlive':''}">07:00〜</div><p class="onlivecard-name">Test ${slug}</p></li>`;
      const officialHtml=`<h1>Official fixture</h1><a href="/r/profile-only">Profile only</a><ul>${card(target.one)}${card(target.two)}${card(target.one)}${card('ended',{live:false})}${card('pick',{extra:'todays-pick'})}${card('hidden',{style:'display:none'})}${card('aria-hidden',{hidden:'aria-hidden="true"'})}${card('untrusted',{href:'https://evil.test/r/outsider'})}</ul>`;
      const body=official?officialHtml:list?`<h1>Fixture rooms</h1><div id="roomlist"><a href="${target.kind==='sr'?target.profile(target.one):target.live(target.one)}">Test room one (${firstStart})</a><a href="${target.live(target.one)}">duplicate (${firstStart})</a><a href="${target.live(target.two)}">Test room two (2026/09/11 07:30:00)</a><a href="https://evil.test/r/not-a-room">untrusted</a></div><div id="upcomingroomlist"><a href="https://www.showroom-live.com/r/upcoming">Not live</a></div>`:profile?'<h1>Fixture profile</h1><button>Follow</button>':'<h1>Test live player</h1><video style="display:block;background:#eee;width:100%;height:220px" playsinline></video>';
      await route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Watch helper fixture</title></head><body>${body}</body></html>`});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date(startTime)});
    const panel=()=>page.locator(`#${target.id}`);
    const part=id=>panel().locator(`#${id}`);
    const settle=async()=>{await page.waitForTimeout(150);};
    const checkText=async(id,regex)=>assert.match(await part(id).innerText(),regex);
    const passed=[];
    const check=async(name,fn)=>{await fn();passed.push(name);console.log(`PASS ${target.scenario||target.kind}-${width}: ${name}`);};
    try {
      await page.goto(target.home);await panel().waitFor();
      await check('list is deduplicated and future/untrusted rooms are excluded',async()=>{await checkText('name',/未記録 2ルーム/);assert.equal(navigations.length,1);});
      await check('ten prior rooms can be recorded locally, survive reload and leave ten',async()=>{
        await panel().locator('summary').click();await part('actual').fill('10');await part('adjust').click();await settle();
        await checkText('total',/10 \/ 20.*あと10件/);await page.reload();await panel().waitFor();await checkText('total',/10 \/ 20.*あと10件/);
      });
      await part('start').click();await page.waitForURL(target.live(target.one));await panel().waitFor();
      await check('unplayed media does not count and next is disabled',async()=>{await page.clock.runFor(5000);await settle();await checkText('time',/^32$/);assert.equal(await part('next').isDisabled(),true);});
      await check('hidden tabs never accrue media time',async()=>{
        await page.evaluate(()=>{window.fixturePaused=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
        await page.clock.runFor(4000);await settle();await checkText('time',/^32$/);
        await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await settle();
      });
      await page.evaluate(()=>{window.fixturePaused=false;});await page.clock.runFor(11000);await settle();
      const remainingBefore=Number(await part('time').innerText());assert.ok(remainingBefore<30&&remainingBefore>15);
      await check('partial media timer is saved and resumes after reload',async()=>{await part('pause').click();await settle();await page.reload();await panel().waitFor();const n=Number(await part('time').innerText());assert.ok(n<=remainingBefore+3&&n>=remainingBefore-2);});
      await check('follow is a real manual profile link and bookmarks are independent',async()=>{
        assert.equal(await part('follow').getAttribute('href'),target.profile(target.one));assert.equal(await part('follow').getAttribute('target'),'_blank');
        await part('favorite').click();await settle();assert.equal(store.get(`${target.prefix}_favorites`).length,1);
        const profilePage=await context.newPage();await profilePage.goto(target.profile(target.one));await profilePage.waitForTimeout(200);assert.equal(await profilePage.locator(`#${target.id}`).count(),0);assert.equal(profilePage.url(),target.profile(target.one));await profilePage.close();
      });
      await page.evaluate(()=>{window.fixturePaused=false;});await page.clock.runFor(40000);await settle();
      await check('time reached does not award or navigate by itself; next requires a click',async()=>{
        await checkText('time',/目安到達/);await checkText('total',/10 \/ 20/);assert.equal(page.url(),target.live(target.one));
        await part('next').click();await page.waitForURL(target.live(target.two));await panel().waitFor();await checkText('total',/11 \/ 20.*あと9件/);
      });
      await check('returning to the list and restarting does not re-enter the recorded first broadcast',async()=>{
        await part('back').click();await page.waitForURL(target.home);await panel().waitFor();
        await checkText('name',/未記録 1ルーム.*記録済み 1件/);await checkText('total',/11 \/ 20/);
        await part('start').click();await page.waitForURL(target.live(target.two));await panel().waitFor();
      });
      await check('new boundary clears this period, leaves bookmarks, and does not auto-navigate',async()=>{
        const boundary=target.kind==='sr'?'2026-09-11T15:00:00+09:00':'2026-09-12T00:00:00+09:00';
        await page.clock.setSystemTime(new Date(boundary));await page.clock.runFor(1000);await settle();await checkText('total',/0 \/ 20.*あと20件/);await checkText('time',/^32$/);assert.equal(store.get(`${target.prefix}_favorites`).length,1);assert.equal(page.url(),target.live(target.two));
      });

      if(target.kind==='sr' && target.scenario!=='sr-official') await check('earned broadcast exclusions outlive 15:00 and count resets; later broadcasts are eligible',async()=>{
        await part('back').click();await page.waitForURL(target.home);await panel().waitFor();
        await checkText('name',/未記録 1ルーム.*記録済み 1件/);
        await part('start').click();await page.waitForURL(target.live(target.two));await panel().waitFor();
        await part('exclude').click();await settle();await checkText('total',/0 \/ 20/);
        await part('back').click();await page.waitForURL(target.home);await panel().waitFor();
        await checkText('name',/未記録 0ルーム.*記録済み 2件/);
        await panel().locator('summary').click();page.once('dialog',d=>d.accept());await part('reset').click();await settle();
        await checkText('name',/未記録 0ルーム.*記録済み 2件/);

        firstStart='2026/09/11 15:01:00';await page.clock.setSystemTime(new Date('2026-09-11T15:05:00+09:00'));
        await page.reload();await panel().waitFor();await checkText('name',/未記録 1ルーム.*記録済み 1件/);
        await part('start').click();await page.waitForURL(target.live(target.one));await panel().waitFor();
        await checkText('time',/^32$/);await checkText('total',/0 \/ 20/);
      });
      if(target.scenario==='sr-official') await check('official, nao and onlive share earned exclusions and return to the originating list',async()=>{
        await part('back').click();await page.waitForURL(target.home);await panel().waitFor();
        await checkText('source',/公式/);await checkText('name',/未記録 1ルーム.*記録済み 1件/);
        await page.goto('https://nao.qa/ap/search.php?kw=&genre=103');await panel().waitFor();
        await checkText('source',/nao/);await checkText('name',/未記録 1ルーム.*記録済み 1件/);await checkText('total',/0 \/ 20/);
        await page.goto('https://www.showroom-live.com/onlive');await panel().waitFor();
        await checkText('source',/公式/);await checkText('name',/未記録 1ルーム.*記録済み 1件/);
        await part('start').click();await page.waitForURL(target.live(target.two));await panel().waitFor();
        const active=[...store.values()].find(v=>v?.active===true && v.listUrl==='https://www.showroom-live.com/onlive');
        assert.ok(active);assert.equal(active.queue[0].startedAt,null);
        await part('back').click();await page.waitForURL('https://www.showroom-live.com/onlive');await panel().waitFor();
        await part('start').click();await page.waitForURL(target.live(target.two));await panel().waitFor();
      });
      await check('responsive compact control fits the viewport',async()=>{
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await panel().screenshot({path:join(output,`${target.scenario||target.kind}-${width}.png`)});
        await part('compact').click();assert.equal(await part('follow').isVisible(),false);await part('compact').click();assert.equal(await part('follow').isVisible(),true);assert.deepEqual(errors,[]);
      });
      report.results.push({kind:target.kind,scenario:target.scenario||target.kind,width,passed,status:'passed'});
    } catch(e){report.results.push({kind:target.kind,scenario:target.scenario||target.kind,width,passed,status:'failed',error:e.message});await page.screenshot({path:join(output,`${target.scenario||target.kind}-${width}-failure.png`)});throw e;}
    finally {await context.close();}
  }
} finally {await browser.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}

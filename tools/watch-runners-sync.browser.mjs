import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
if(!process.env.PLAYWRIGHT_MODULE_ROOT)throw new Error('Set PLAYWRIGHT_MODULE_ROOT');
const pw=await import(pathToFileURL(join(process.env.PLAYWRIGHT_MODULE_ROOT,'playwright/index.mjs')));
const engine=process.env.RUNNER_TEST_ENGINE||'chromium';
if(!['chromium','webkit'].includes(engine))throw new Error('Unsupported engine');
const output=process.env.RUNNER_TEST_ARTIFACTS||join(root,'.runner-test-artifacts');await mkdir(output,{recursive:true});
const sr=await readFile(join(root,'SR-Mission-Runner-Mobile.user.js'),'utf8');
const mx=await readFile(join(root,'Mixch-Watch-Helper-Mobile.user.js'),'utf8');
const official='<ul><li><article class="onlivecard"><a class="ga-onlive-click" data-room-id="123456" href="/r/test-room">Enter</a></article><div class="onlivecard-time is-onlive">7:00〜</div><p class="onlivecard-name">Test room</p></li></ul>';
const live='<h1>Fixture live</h1><video playsinline></video>';
const fixture={genre_list:[{genre:'daily',current_period:'day',day:{continuous_mission:[{mission_id:1001,title:'配信を30秒視聴しよう',current_value:8,target_value:20,is_active:1}],single_mission:[]}}]};
const report={engine,scope:'Isolated HTML/GM/network fixtures, not authenticated service or physical iPhone',results:[]};
const browser=await pw[engine].launch({headless:true});
try{for(const width of [390,430,1280]){
  const checks=[],errors=[],requests=[],store=new Map();let mode='ok',release;
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,timezoneId:'America/Los_Angeles',locale:'ja-JP'});
  const check=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${engine}-${width}: ${name}`);};
  await ctx.exposeBinding('fixtureGet',(_s,k,d)=>store.has(k)?structuredClone(store.get(k)):d);
  await ctx.exposeBinding('fixtureSet',(_s,k,v)=>store.set(k,structuredClone(v)));
  await ctx.exposeBinding('fixtureDelete',(_s,k)=>store.delete(k));
  await ctx.addInitScript(({sr,mx})=>{
    window.GM={getValue:(k,d)=>window.fixtureGet(k,d),setValue:(k,v)=>window.fixtureSet(k,v),deleteValue:k=>window.fixtureDelete(k)};
    window.fixtureMedia=()=>{const v=document.querySelector('video');if(!v)return;window.fixturePaused=true;
      for(const [k,get] of Object.entries({paused:()=>window.fixturePaused,ended:()=>false,error:()=>null,readyState:()=>4,currentTime:()=>performance.now()/1000}))Object.defineProperty(v,k,{get,configurable:true});};
    window.fixtureSoft=(path,html)=>{history.pushState({},'',path);document.body.innerHTML=html;window.fixtureMedia();};
    document.addEventListener('DOMContentLoaded',()=>{window.fixtureMedia();new Function(location.hostname==='mixch.tv'?mx:sr)();});
  },{sr,mx});
  await ctx.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.pathname==='/api/mission'){
      requests.push({method:req.method(),url:req.url()});const selected=mode;
      if(selected==='delay')await new Promise(r=>{release=r;});
      await route.fulfill({status:selected==='denied'?403:200,contentType:'application/json',body:selected==='bad'?'{bad':JSON.stringify(selected==='empty'?{}:fixture)}).catch(()=>{});return;
    }
    assert.equal(req.method(),'GET');assert.equal(req.isNavigationRequest(),true,'Unexpected external request');
    const body=u.hostname==='mixch.tv'?u.pathname.endsWith('/live')?live:'<h1>Fixture profile</h1>':official;
    await route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fixture</title></head><body>${body}</body></html>`});
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-09-11T08:00:00+09:00')});
  let id='mxwh-mobile';const part=n=>page.locator(`#${id}`).locator('#'+n);
  const tick=async(ms=850)=>{await page.clock.runFor(ms);await page.waitForTimeout(100);};
  const soft=async(path,html)=>{await page.evaluate(([path,html])=>window.fixtureSoft(path,html),[path,html]);await tick();};
  try{
    await page.goto('https://mixch.tv/u/100001');await tick();
    await check('Mixch unsupported profile stays untouched',async()=>assert.equal(await page.locator('#'+id).count(),0));
    await check('Mixch soft navigation into a live room mounts the correct panel',async()=>{await soft('/u/100001/live',live);await part('title').waitFor();assert.match(await part('title').innerText(),/v0\.2\.0/);assert.equal(await part('watchControls').isVisible(),true);});
    await part('next').click();await tick(2000);assert.equal(await part('time').innerText(),'32');
    await page.evaluate(()=>{window.fixturePaused=false;});await tick(4500);
    await check('Mixch detached panel is restored without resetting or duplicating its timer',async()=>{const before=Number(await part('time').innerText());await page.evaluate(()=>document.getElementById('mxwh-mobile').remove());await tick();assert.equal(await page.locator('#'+id).count(),1);assert.ok(Number(await part('time').innerText())<=before);});
    await check('Mixch soft room switch does not continue the prior room timer',async()=>{await soft('/u/100002/live',live);assert.equal(await part('time').innerText(),'32');assert.equal(await part('next').innerText(),'この配信を計測');});
    await check('Mixch duplicate injection leaves a single active panel',async()=>{await page.evaluate(mx);await tick();assert.equal(await page.locator('#'+id).count(),1);});
    await part('next').click();await tick();await part('favorite').click();await tick();
    await check('Mixch return to profile removes the panel and keeps bookmarks',async()=>{await soft('/u/100002','<h1>Profile</h1>');assert.equal(await page.locator('#'+id).count(),0);assert.equal(store.get('mxwh_progress_v1_favorites').length,1);});
    await check('Mixch restoration on the list uses list controls and no official network reads',async()=>{await soft('/','<a href="/u/100003/live">New fixture live</a>');assert.equal(await part('listControls').isVisible(),true);assert.equal(await part('officialBox').isVisible(),false);assert.equal(requests.length,0);});
    await page.locator('#'+id).screenshot({path:join(output,`mixch-lifecycle-${width}.png`)});
    await page.goto('https://www.showroom-live.com/');id='srmr-mobile';await tick();
    await check('SHOWROOM progress read is off by default',async()=>{assert.equal(requests.length,0);assert.equal(await part('officialAuto').isChecked(),false);});
    await part('officialBox').locator('summary').click();const beforeStore=JSON.stringify([...store]);
    await check('SHOWROOM explicit read displays exact mission progress without changing local records',async()=>{await part('officialRead').click();await page.waitForFunction(()=>document.querySelector('#srmr-mobile')?.shadowRoot?.getElementById('officialResult')?.textContent.includes('8/20'));assert.equal(requests.length,1);assert.match(await part('total').innerText(),/0 \/ 20/);assert.equal(JSON.stringify([...store]),beforeStore);});
    await check('SHOWROOM manual repeated clicks are rate-limited',async()=>{await part('officialRead').click();await tick(1000);assert.equal(requests.length,1);});
    await check('SHOWROOM progress UI fits each viewport',async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#'+id).screenshot({path:join(output,`official-progress-${width}.png`)});});
    await tick(6000);await part('officialAuto').check();await tick(1000);const autoStart=requests.length;
    await check('SHOWROOM opt-in refresh occurs after 60 seconds',async()=>{await tick(62000);assert.ok(requests.length>autoStart);});
    await check('SHOWROOM never polls while hidden',async()=>{await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const n=requests.length;await tick(65000);assert.equal(requests.length,n);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await part('officialAuto').uncheck();});
    await check('SHOWROOM missing data stays unknown and stops automatic retries',async()=>{mode='empty';await tick(6000);await part('officialAuto').click();await tick(1000);assert.match(await part('officialResult').innerText(),/対応する公式データを確認できません/);assert.equal(await part('officialAuto').isChecked(),false);const n=requests.length;await tick(65000);assert.equal(requests.length,n);assert.equal(JSON.stringify([...store]),beforeStore);});
    for(const failure of ['denied','bad'])await check(`SHOWROOM ${failure} responses do not mutate local records`,async()=>{mode=failure;await tick(6000);await part('officialRead').click();await tick(1000);assert.match(await part('officialResult').innerText(),/読み取れませんでした/);assert.equal(JSON.stringify([...store]),beforeStore);});
    await check('SHOWROOM response from the prior mission period is discarded',async()=>{
      mode='delay';release=null;await tick(6000);await page.clock.setSystemTime(new Date('2026-09-11T14:59:59+09:00'));await part('officialRead').click();
      for(let i=0;i<20&&!release;i++)await page.waitForTimeout(25);assert.ok(release);
      await page.clock.setSystemTime(new Date('2026-09-11T15:00:00+09:00'));await tick(1100);release();await page.waitForTimeout(200);
      assert.match(await part('officialResult').innerText(),/再読取が必要/);assert.doesNotMatch(await part('officialResult').innerText(),/8\/20/);assert.match(await part('total').innerText(),/0 \/ 20/);
    });
    await check('SHOWROOM read is aborted on soft navigation away from supported pages',async()=>{
      release=null;await tick(6000);await part('officialRead').click();for(let i=0;i<20&&!release;i++)await page.waitForTimeout(25);assert.ok(release);
      await soft('/room/profile','<h1>Profile</h1>');release();await page.waitForTimeout(100);assert.equal(await page.locator('#'+id).count(),0);
    });
    await check('all observed requests are exact read-only mission GETs; no runtime errors',async()=>{for(const r of requests){assert.equal(r.method,'GET');assert.equal(r.url,'https://www.showroom-live.com/api/mission?room_id=123456');}assert.deepEqual(errors,[]);});
    report.results.push({width,status:'passed',checks});
  }catch(e){report.results.push({width,status:'failed',checks,error:e.message});await page.screenshot({path:join(output,`failure-${width}.png`)});throw e;}
  finally{await ctx.close();}
}}finally{await browser.close();await writeFile(join(output,'sync-report.json'),JSON.stringify(report,null,2)+'\n');}

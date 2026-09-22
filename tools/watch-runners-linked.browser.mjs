import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const pw=await import(pathToFileURL(join(process.env.PLAYWRIGHT_MODULE_ROOT,'playwright/index.mjs')));
const engine=process.env.RUNNER_TEST_ENGINE||'chromium';
const out=process.env.RUNNER_TEST_ARTIFACTS;await mkdir(out,{recursive:true});
const sr=await readFile(join(root,'SR-Mission-Runner-Mobile.user.js'),'utf8'),mx=await readFile(join(root,'Mixch-Watch-Helper-Mobile.user.js'),'utf8');
const report={engine,scope:'Synthetic page, media and official progress; no authenticated reward tests.',results:[]};
const browser=await pw[engine].launch({headless:true});
try{for(const width of [390,430,1280]){
 const store=new Map(),requests=[],checks=[],errors=[];let responseMode='normal';
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
 await ctx.exposeBinding('fixtureGet',(_s,k,d)=>store.has(k)?structuredClone(store.get(k)):d);
 await ctx.exposeBinding('fixtureSet',(_s,k,v)=>store.set(k,structuredClone(v)));
 await ctx.exposeBinding('fixtureDelete',(_s,k)=>store.delete(k));
 await ctx.addInitScript(({sr,mx})=>{
  window.GM={getValue:(k,d)=>window.fixtureGet(k,d),setValue:(k,v)=>window.fixtureSet(k,v),deleteValue:k=>window.fixtureDelete(k)};
  document.addEventListener('DOMContentLoaded',()=>{
   const m=document.querySelector('video');window.fixturePaused=true;
   if(m)for(const [k,get] of Object.entries({paused:()=>window.fixturePaused,ended:()=>false,error:()=>null,readyState:()=>4,currentTime:()=>performance.now()/1000}))Object.defineProperty(m,k,{get,configurable:true});
   new Function(location.hostname==='mixch.tv'?mx:sr)();
  });
 },{sr,mx});
 await ctx.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());requests.push({method:r.method(),url:r.url()});
  assert.equal(r.method(),'GET','No mutation is permitted');
  if(u.pathname==='/api/mission'){
   const done=responseMode==='done';const row={mission_id:101,title:'配信を30秒視聴しよう',current_value:done?30:0,target_value:30,current_level:done?20:9,max_level:20,remain_reward:done?0:2,is_active:1};
   await route.fulfill({status:responseMode==='denied'?403:200,contentType:'application/json',body:JSON.stringify({genre_list:[{genre:'daily',current_period:'day',day:{continuous_mission:[row],single_mission:[]}}]})});return;
  }
  const home='<ul><li><article class="onlivecard"><a class="ga-onlive-click" data-room-id="123456" href="/r/test-one">room</a></article><div class="onlivecard-time is-onlive">7:00〜</div><p class="onlivecard-name">Test one</p></li></ul>';
  const body=u.pathname==='/'?home:u.pathname.includes('/lottery/')?'<h1>Official ad dashboard fixture</h1><button id="watchAd">広告を見る</button>':'<h1>Fixture live</h1><video playsinline style="height:180px"></video><div id="chat"></div>';
  await route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-09-11T08:00:00+09:00')});
 let id='srmr-mobile';const panel=()=>page.locator('#'+id),part=x=>panel().locator('#'+x);
 const tick=async(ms=1000)=>{await page.clock.runFor(ms);await page.waitForTimeout(120);};
 const check=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${engine}-${width} ${name}`);};
 try{
  await page.goto('https://www.showroom-live.com/');await panel().waitFor();
  await check('link is opt-in and never reads rewards by itself',async()=>{assert.match(await part('linkedStatus').innerText(),/OFF/);assert.equal(requests.filter(r=>r.url.includes('/api/')).length,0);});
  await part('linkBox').locator('summary').click();await part('linkToggle').click();await tick();
  await check('repeat progress separates achieved, received and pending',async()=>{assert.match(await part('linkedStatus').innerText(),/達成 8\/20・受取 6・未受取 2.*残り 12回/);assert.match(await part('total').innerText(),/公式連動 8 \/ 20/);});
  await check('link survives reload in the same tab without changing room histories',async()=>{await page.reload();await panel().waitFor();await tick();assert.match(await part('linkedStatus').innerText(),/達成 8\/20/);assert.equal([...store].filter(([k])=>k.endsWith('_broadcast_history'))[0][1].length,0);});
  await part('officialBox').locator('summary').click();await tick(6000);responseMode='done';await part('officialRead').click();await tick();
  await check('official target completion disables another start, rather than using local zero',async()=>{assert.match(await part('linkedStatus').innerText(),/残り 0回/);assert.equal(await part('start').isDisabled(),true);});
  responseMode='denied';await tick(6000);await part('officialRead').click();await tick();
  await check('denied progress becomes unknown and never zeroes local history',async()=>{assert.match(await part('linkedStatus').innerText(),/確認待ち/);assert.doesNotMatch(await part('linkedStatus').innerText(),/達成 0/);assert.match(await part('total').innerText(),/0 \/ 20/);});
  await part('linkBox').locator('summary').click();await part('linkToggle').click();await part('start').click();await page.waitForURL('**/lite/test-one');await panel().waitFor();
  await page.evaluate(()=>{window.fixturePaused=false;});await tick(7500);const remaining=Number(await part('time').innerText());
  const liveBeforeAds=page.url();let adPage;
  await check('ad entry opens a separate tab and keeps the live room intact',async()=>{const popup=page.waitForEvent('popup');await part('openAds').click();adPage=await popup;await adPage.waitForLoadState('domcontentloaded');await adPage.locator('#srmr-mobile').waitFor();assert.equal(page.url(),liveBeforeAds);assert.match(adPage.url(),/\/lottery\/ad_reward/);assert.equal(store.get('srmr_progress_v3_ad_return').slug,'test-one');assert.equal(store.get('srmr_progress_v3_ad_return').separateTab,true);assert.match(await adPage.locator('#srmr-mobile').innerText(),/元の配信タブへ戻ると自動再開/);});
  await check('background ad time is not counted and returning auto-resumes without a Resume tap',async()=>{await page.bringToFront();await page.evaluate(()=>{window.fixturePaused=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const before=Number(await part('time').innerText());await tick(5000);assert.equal(Number(await part('time').innerText()),before);await page.evaluate(()=>{delete document.hidden;window.fixturePaused=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(150);assert.equal(await part('pause').innerText(),'一時停止');await tick(4000);assert.ok(Number(await part('time').innerText())<before);});
  await check('ad watch pages have no helper overlay',async()=>{await adPage.goto('https://www.showroom-live.com/lottery/ad_reward/1/watch');await adPage.waitForTimeout(150);assert.equal(await adPage.locator('#srmr-mobile').count(),0);await adPage.close();});
  await page.goto('https://mixch.tv/u/100001/live');id='mxwh-mobile';await panel().waitFor();await part('linkBox').locator('summary').click();await part('linkToggle').click();
  await check('Mixch starts unknown, with no extra service API calls',async()=>{assert.match(await part('linkedStatus').innerText(),/確認待ち/);assert.equal(requests.filter(r=>r.url.includes('mixch.tv/api')).length,0);});
  const alert=async(text,official=true)=>{await page.evaluate(({text,official})=>{const n=document.createElement('div');n.textContent=text;if(official){n.className='alert alert-success';n.setAttribute('role','alert');}document.body.appendChild(n);},{text,official});await tick();};
  await alert('視聴ボーナスGET！ 19/25 チャット',false);
  await check('chat text never becomes official progress',async()=>assert.match(await part('linkedStatus').innerText(),/確認待ち/));
  await alert('視聴ボーナスGET！ 17/25 スパコメや応援アイテムでライブをガンガン盛り上げよう♪');
  await check('Mixch bonus notice supplies the actual counter and actual limit',async()=>{assert.match(await part('linkedStatus').innerText(),/達成 17\/25.*残り 8回/);assert.match(await part('total').innerText(),/公式連動 17 \/ 25/);});
  await check('linked progress persists over real navigation to another room',async()=>{await page.goto('https://mixch.tv/u/100002/live');await panel().waitFor();assert.match(await part('linkedStatus').innerText(),/達成 17\/25/);});
  await alert('視聴ボーナスGET！ 25/25 スパコメや応援アイテムでライブをガンガン盛り上げよう♪');
  await check('Mixch official limit prevents starting a further measurement',async()=>{assert.equal(await part('next').isDisabled(),true);assert.match(await part('linkedStatus').innerText(),/残り 0回/);assert.match(await part('status').innerText(),/公式の目標に到達/);});
  await panel().screenshot({path:join(out,`linked-mixch-${width}.png`)});
  await check('expired progress is unknown rather than a fabricated zero',async()=>{await page.clock.setSystemTime(new Date('2026-09-11T09:00:00+09:00'));await tick(3000);assert.match(await part('linkedStatus').innerText(),/確認待ち/);assert.doesNotMatch(await part('linkedStatus').innerText(),/達成 0/);});
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  report.results.push({width,status:'passed',checks});
 }catch(e){report.results.push({width,status:'failed',checks,error:e.message});await page.screenshot({path:join(out,`failure-${width}.png`)});throw e;}finally{await ctx.close();}
}}finally{await browser.close();await writeFile(join(out,'linked-report.json'),JSON.stringify(report,null,2)+'\n');}

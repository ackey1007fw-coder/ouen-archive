import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const mod=await import(pathToFileURL(join(process.env.PLAYWRIGHT_MODULE_ROOT, 'playwright/index.mjs')));
const code=await readFile(process.env.RUNNER_SCRIPT_FILE || new URL('../SR-Mission-Runner-Mobile.user.js',import.meta.url),'utf8');
const engine=process.env.RUNNER_TEST_ENGINE||'chromium';
const width=Number(process.env.RUNNER_TEST_WIDTH || 390);
const output=process.env.RUNNER_TEST_ARTIFACTS;
if(output) await mkdir(output,{recursive:true});
const results=[];
function pass(message){results.push(message);console.log(`PASS ${engine} ${width}px: ${message}`);}
async function capture(page,label){if(output) await page.screenshot({path:join(output,`${engine}-${width}-${label}.png`),fullPage:true});}
const browser=await mod[engine].launch({headless:true,...(engine==='chromium' && process.env.RUNNER_CHROMIUM_PATH ? {executablePath:process.env.RUNNER_CHROMIUM_PATH} : {})});
const now=Date.parse('2026-09-12T06:55:00+09:00'),H=3600000,D=24*H,jst=now+9*H,day=Math.floor(jst/D)*D,start=day+3*H,key=String(start-9*H);
const onlive=`<ul class="onlive-list">
<li class="st-onlivelist__item"><div class="st-onlive__hover"><a class="st-onlive__hover-button is-fluid" href="/r/room-one">入室</a></div><time class="st-onlive__badge time">6:00〜</time><h3 class="st-room__name"><span>Room one</span></h3></li>
<li class="st-onlivelist__item"><div class="st-onlive__hover"><a class="st-onlive__hover-button is-fluid" href="/r/room-two">入室</a></div><time class="st-onlive__badge time">6:10〜</time><h3 class="st-room__name"><span>Room two</span></h3></li>
<li class="st-onlivelist__item"><div class="st-onlive__hover"><a class="st-onlive__hover-button is-fluid" href="/r/room-three">入室</a></div><time class="st-onlive__badge time">6:20〜</time><h3 class="st-room__name"><span>Room three</span></h3></li>
</ul>`;
async function makeContext(store, homeBody='<a href="/account/login">ログイン</a><h1>New30day</h1>', onliveBody=onlive){
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:true,locale:'ja-JP'});
 await ctx.exposeBinding('g',(_s,k,d)=>store.has(k)?structuredClone(store.get(k)):d);
 await ctx.exposeBinding('s',(_s,k,v)=>store.set(k,structuredClone(v)));
 await ctx.exposeBinding('d',(_s,k)=>store.delete(k));
 await ctx.addInitScript(({code})=>{window.GM={getValue:(k,d)=>window.g(k,d),setValue:(k,v)=>window.s(k,v),deleteValue:k=>window.d(k)};document.addEventListener('DOMContentLoaded',()=>new Function(code)());},{code});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());let body='';
  if(u.pathname==='/')body=homeBody;
  else if(u.pathname==='/onlive')body=onliveBody;
  else if(u.pathname.startsWith('/lite/'))body='<select class="header-menu"><option value="3">ログイン</option></select><div class="room-video-wrapper"><video></video></div>';
  else if(u.pathname.startsWith('/lottery/ad_reward'))body='<h1>広告</h1><p>ログインが必要です。</p><button disabled>広告を見る 0/0回</button>';
  await r.fulfill({headers:{'content-type':'text/html; charset=utf-8'},body:`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${body}</body></html>`});
 });
 return ctx;
}
try{
 // Scenario 1: the exact stuck state from iPhone — progress exists but the official home has no cards.
 {
  const state={period:key,done:[],adjustment:18,queue:[],index:0,active:false,run:'',checkpoint:null,listUrl:'https://www.showroom-live.com/'};
  const store=new Map([[`srmr_progress_v3_${key}`,state]]),ctx=await makeContext(store),p=await ctx.newPage();
  await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/');const panel=p.locator('#srmr-mobile');await panel.waitFor();
  assert.match(await panel.locator('#total').innerText(),/18 \/ 20/);assert.equal(await panel.locator('#start').innerText(),'オンライブ一覧を開く ▶');assert.equal(await panel.locator('#start').isDisabled(),false);
  assert.match(await panel.locator('#accountWarning').innerText(),/Safari側のSHOWROOMが未ログイン/);
  await panel.locator('#start').click();await p.waitForURL('https://www.showroom-live.com/onlive');await p.locator('#srmr-mobile').waitFor();
  assert.match(await p.locator('#srmr-mobile #name').innerText(),/未記録 3ルーム/);assert.match(await p.locator('#srmr-mobile #total').innerText(),/18 \/ 20/);assert.equal(await p.locator('#srmr-mobile #start').isDisabled(),false);
  pass('empty official home -> /onlive layout, 18/20 preserved');await ctx.close();
 }
 // Scenario 1b: the official home has live cards, but all of them are already recorded.
 // It must offer /onlive even when allRooms.length is nonzero (iPhone 10/20 stall).
 {
  const at=now-60000;
  const done=Array.from({length:10},(_,i)=>({slug:i===0?'room-one':`recorded-${i}`,startedAt:null,at,source:'timer'}));
  const history=[...done.map(({slug,startedAt,at})=>({slug,startedAt,at})),...Array.from({length:6},(_,i)=>({slug:`past-${i}`,startedAt:null,at:Number(key)-60000}))];
  const reviews=done.map(r=>({...r,period:key,reward:'unconfirmed'}));
  const prefs={seconds:35,target:20,autoNext:false};
  const favorites=[{slug:'favorite-one',name:'Favorite',roomId:'',startedAt:null}];
  const state={period:key,done,adjustment:0,queue:[],index:0,active:false,run:'',checkpoint:null,listUrl:'https://www.showroom-live.com/'};
  const home='<h1>New30day</h1><ul>'+history.map(r=>`<li><span class="onlivecard-time is-onlive">配信中</span><article class="onlivecard"><a class="onlivecard-link" href="/r/${r.slug}">${r.slug}</a></article></li>`).join('')+'</ul>';
  const store=new Map([[`srmr_progress_v3_${key}`,state],['srmr_progress_v3_broadcast_history',history],['srmr_progress_v3_broadcast_history_seeded',true],['srmr_progress_v3_watch_reviews',reviews],['srmr_progress_v3_prefs',prefs],['srmr_progress_v3_favorites',favorites]]);
  const unchanged=()=>{
   assert.deepEqual(store.get(`srmr_progress_v3_${key}`).done,done);
   assert.equal(store.get(`srmr_progress_v3_${key}`).adjustment,0);
   assert.deepEqual(store.get('srmr_progress_v3_broadcast_history'),history);
   assert.deepEqual(store.get('srmr_progress_v3_watch_reviews'),reviews);
   assert.deepEqual(store.get('srmr_progress_v3_prefs'),prefs);
   assert.deepEqual(store.get('srmr_progress_v3_favorites'),favorites);
  };
  const ctx=await makeContext(store,home),p=await ctx.newPage();
  await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/');const panel=p.locator('#srmr-mobile');await panel.waitFor();
  assert.match(await panel.locator('#total').innerText(),/10 \/ 20/);
  assert.match(await panel.locator('#name').innerText(),/未記録 0ルーム \/ 記録済み 16件/);
  assert.equal(await panel.locator('#start').isDisabled(),false);
  assert.equal(await panel.locator('#start').innerText(),'オンライブ一覧を開く ▶');
  unchanged();await capture(p,'recorded-home');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await panel.locator('#start').click();await p.waitForURL('https://www.showroom-live.com/onlive');
  await p.locator('#srmr-mobile').waitFor();
  assert.match(await p.locator('#srmr-mobile #total').innerText(),/10 \/ 20/);
  assert.match(await p.locator('#srmr-mobile #name').innerText(),/未記録 2ルーム/);
  assert.equal(await p.locator('#srmr-mobile #start').isDisabled(),false);
  unchanged();await capture(p,'onlive');
  await p.locator('#srmr-mobile #start').click();await p.waitForURL('https://www.showroom-live.com/lite/room-two');
  await p.locator('#srmr-mobile').waitFor();unchanged();
  assert.deepEqual(store.get(`srmr_progress_v3_${key}`).queue.map(r=>r.slug),['room-two','room-three']);
  assert.equal(store.get(`srmr_progress_v3_${key}`).active,true);
  assert.match(await p.locator('#srmr-mobile #total').innerText(),/10 \/ 20/);
  pass('recorded-only home (10 actual records / 16 exclusions) -> /onlive -> next unrecorded stream; records, history, reviews, favorites and preferences preserved');await ctx.close();
 }
 // /onlive must not redirect to itself when it also has no eligible candidates.
 for(const body of ['',onlive]){
  const done=body?[{slug:'room-one',startedAt:null,at:now-60000,source:'timer'},{slug:'room-two',startedAt:null,at:now-60000,source:'timer'},{slug:'room-three',startedAt:null,at:now-60000,source:'timer'}]:[];
  const state={period:key,done,adjustment:10-done.length,queue:[],index:0,active:false,run:'',checkpoint:null,listUrl:'https://www.showroom-live.com/onlive'};
  const store=new Map([[`srmr_progress_v3_${key}`,state]]),ctx=await makeContext(store,undefined,body),p=await ctx.newPage();
  let navigations=0;p.on('framenavigated',f=>{if(f===p.mainFrame())navigations++;});
  await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/onlive');await p.locator('#srmr-mobile').waitFor();
  assert.equal(await p.locator('#srmr-mobile #start').isDisabled(),true);
  assert.match(await p.locator('#srmr-mobile #status').innerText(),body?/更新やジャンル切替/:/読込待ち/);
  await p.clock.runFor(5000);await p.waitForTimeout(100);
  assert.equal(navigations,1);assert.equal(store.get(`srmr_progress_v3_${key}`).done.length,done.length);
  assert.match(await p.locator('#srmr-mobile #total').innerText(),/10 \/ 20/);
  pass(`${body?'recorded-only':'empty'} /onlive stays stopped, no navigation loop or extra completion`);await ctx.close();
 }
 // The home escape must not bypass the local target limit.
 {
  const state={period:key,done:[],adjustment:20,queue:[],index:0,active:false,run:'',checkpoint:null,listUrl:'https://www.showroom-live.com/'};
  const store=new Map([[`srmr_progress_v3_${key}`,state]]),ctx=await makeContext(store),p=await ctx.newPage();
  await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/');await p.locator('#srmr-mobile').waitFor();
  assert.equal(await p.locator('#srmr-mobile #start').isDisabled(),true);
  assert.match(await p.locator('#srmr-mobile #total').innerText(),/20 \/ 20/);
  pass('20/20 home remains stopped');await ctx.close();
 }
 // Scenario 2: a recorded room opened outside an active queue must escape in one tap.
 {
  const at=now-60000,state={period:key,done:[{slug:'room-one',startedAt:null,at}],adjustment:17,queue:[],index:0,active:false,run:'',checkpoint:null,listUrl:'https://www.showroom-live.com/onlive'};
  const store=new Map([[`srmr_progress_v3_${key}`,state],['srmr_progress_v3_broadcast_history',[{slug:'room-one',startedAt:null,at}]],['srmr_progress_v3_broadcast_history_seeded',true],['srmr_progress_v3_recent_list',{at:now,listUrl:'https://www.showroom-live.com/onlive',rooms:[{slug:'room-one',name:'Room one'},{slug:'room-two',name:'Room two'},{slug:'room-three',name:'Room three'}]}]]);
  const ctx=await makeContext(store),p=await ctx.newPage();await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/lite/room-one');const panel=p.locator('#srmr-mobile');await panel.waitFor();
  assert.equal(await panel.locator('#time').innerText(),'記録済み');assert.equal(await panel.locator('#next').innerText(),'次の未記録へ ▶');assert.equal(await panel.locator('#next').isDisabled(),false);
  await panel.locator('#next').click();await p.waitForURL('https://www.showroom-live.com/lite/room-two');await p.locator('#srmr-mobile').waitFor();
  assert.notEqual(await p.locator('#srmr-mobile #time').innerText(),'記録済み');pass('recorded room escapes to next unrecorded room in one tap');await ctx.close();
 }
 // Scenario 3: ad dashboard explains Safari login instead of looking broken.
 {
  const store=new Map([['srmr_progress_v3_ad_return',{slug:'room-two',elapsed:12000,at:now}]]),ctx=await makeContext(store),p=await ctx.newPage();
  await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/lottery/ad_reward/1');const panel=p.locator('#srmr-mobile');await panel.waitFor();await p.clock.runFor(1200);await p.waitForTimeout(100);
  assert.match(await panel.innerText(),/ログインしていないため、広告は公式側で0\/0/);const login=panel.getByText('SafariでSHOWROOMにログイン',{exact:true});assert.equal(await login.isVisible(),true);assert.equal(await login.getAttribute('href'),'https://www.showroom-live.com/account/login');
  pass('ad dashboard exposes Safari login requirement and saved countdown');await ctx.close();
 }
 if(output) await writeFile(join(output,`${engine}-${width}.json`),JSON.stringify({engine,width,results},null,2)+'\n');
}finally{await browser.close();}

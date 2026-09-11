import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const mod=await import(pathToFileURL('C:/Users/ackey/Documents/ChatGPTWork/mily-recap-tools/browser/node_modules/playwright/index.mjs'));
const code=await readFile('C:/Users/ackey/Documents/ChatGPTWork/sr-runner-progress-20260911/SR-Mission-Runner-Mobile.user.js','utf8');
const engine=process.env.RUNNER_TEST_ENGINE||'chromium';
const browser=await mod[engine].launch({headless:true});
const now=Date.parse('2026-09-12T06:55:00+09:00'),H=3600000,D=24*H,jst=now+9*H,day=Math.floor(jst/D)*D,start=day+3*H,key=String(start-9*H);
const onlive=`<ul class="onlive-list">
<li class="st-onlivelist__item"><div class="st-onlive__hover"><a class="st-onlive__hover-button is-fluid" href="/r/room-one">入室</a></div><time class="st-onlive__badge time">6:00〜</time><h3 class="st-room__name"><span>Room one</span></h3></li>
<li class="st-onlivelist__item"><div class="st-onlive__hover"><a class="st-onlive__hover-button is-fluid" href="/r/room-two">入室</a></div><time class="st-onlive__badge time">6:10〜</time><h3 class="st-room__name"><span>Room two</span></h3></li>
<li class="st-onlivelist__item"><div class="st-onlive__hover"><a class="st-onlive__hover-button is-fluid" href="/r/room-three">入室</a></div><time class="st-onlive__badge time">6:20〜</time><h3 class="st-room__name"><span>Room three</span></h3></li>
</ul>`;
async function makeContext(store){
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP'});
 await ctx.exposeBinding('g',(_s,k,d)=>store.has(k)?structuredClone(store.get(k)):d);
 await ctx.exposeBinding('s',(_s,k,v)=>store.set(k,structuredClone(v)));
 await ctx.exposeBinding('d',(_s,k)=>store.delete(k));
 await ctx.addInitScript(({code})=>{window.GM={getValue:(k,d)=>window.g(k,d),setValue:(k,v)=>window.s(k,v),deleteValue:k=>window.d(k)};document.addEventListener('DOMContentLoaded',()=>new Function(code)());},{code});
 await ctx.route('**/*',async r=>{const u=new URL(r.request().url());let body='';
  if(u.pathname==='/')body='<a href="/account/login">ログイン</a><h1>New30day</h1>';
  else if(u.pathname==='/onlive')body=onlive;
  else if(u.pathname.startsWith('/lite/'))body='<select class="header-menu"><option value="3">ログイン</option></select><video></video>';
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
  console.log(`PASS ${engine}: empty official home -> real /onlive layout, 18/20 preserved`);await ctx.close();
 }
 // Scenario 2: a recorded room opened outside an active queue must escape in one tap.
 {
  const at=now-60000,state={period:key,done:[{slug:'room-one',startedAt:null,at}],adjustment:17,queue:[],index:0,active:false,run:'',checkpoint:null,listUrl:'https://www.showroom-live.com/onlive'};
  const store=new Map([[`srmr_progress_v3_${key}`,state],['srmr_progress_v3_broadcast_history',[{slug:'room-one',startedAt:null,at}]],['srmr_progress_v3_broadcast_history_seeded',true],['srmr_progress_v3_recent_list',{at:now,listUrl:'https://www.showroom-live.com/onlive',rooms:[{slug:'room-one',name:'Room one'},{slug:'room-two',name:'Room two'},{slug:'room-three',name:'Room three'}]}]]);
  const ctx=await makeContext(store),p=await ctx.newPage();await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/lite/room-one');const panel=p.locator('#srmr-mobile');await panel.waitFor();
  assert.equal(await panel.locator('#time').innerText(),'記録済み');assert.equal(await panel.locator('#next').innerText(),'次の未記録へ ▶');assert.equal(await panel.locator('#next').isDisabled(),false);
  await panel.locator('#next').click();await p.waitForURL('https://www.showroom-live.com/lite/room-two');await p.locator('#srmr-mobile').waitFor();
  assert.notEqual(await p.locator('#srmr-mobile #time').innerText(),'記録済み');console.log(`PASS ${engine}: recorded room escapes to next unrecorded room in one tap`);await ctx.close();
 }
 // Scenario 3: ad dashboard explains Safari login instead of looking broken.
 {
  const store=new Map([['srmr_progress_v3_ad_return',{slug:'room-two',elapsed:12000,at:now}]]),ctx=await makeContext(store),p=await ctx.newPage();
  await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/lottery/ad_reward/1');const panel=p.locator('#srmr-mobile');await panel.waitFor();await p.clock.runFor(1200);await p.waitForTimeout(100);
  assert.match(await panel.innerText(),/ログインしていないため、広告は公式側で0\/0/);const login=panel.getByText('SafariでSHOWROOMにログイン',{exact:true});assert.equal(await login.isVisible(),true);assert.equal(await login.getAttribute('href'),'https://www.showroom-live.com/account/login');
  console.log(`PASS ${engine}: ad dashboard exposes Safari login requirement and saved countdown`);await ctx.close();
 }
}finally{await browser.close();}

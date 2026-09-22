import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const mod=await import(pathToFileURL('C:/Users/ackey/Documents/ChatGPTWork/mily-recap-tools/browser/node_modules/playwright/index.mjs'));
const code=await readFile('C:/Users/ackey/Documents/ChatGPTWork/sr-runner-progress-20260911/SR-Mission-Runner-Mobile.user.js','utf8');
const engine=process.env.RUNNER_TEST_ENGINE||'chromium',browser=await mod[engine].launch({headless:true});
const now=Date.parse('2026-09-12T06:44:00+09:00'),H=3600000,D=24*H,jst=now+9*H,day=Math.floor(jst/D)*D,start=day+3*H,key=String(start-9*H);
const store=new Map([[`srmr_progress_v3_${key}`,{period:key,done:[],adjustment:16,queue:[],index:0,active:false,run:'',checkpoint:null,listUrl:'https://www.showroom-live.com/'}]]);
try{const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ja-JP'});
await ctx.exposeBinding('g',(_s,k,d)=>store.has(k)?structuredClone(store.get(k)):d);await ctx.exposeBinding('s',(_s,k,v)=>store.set(k,structuredClone(v)));
await ctx.addInitScript(({code})=>{window.GM={getValue:(k,d)=>window.g(k,d),setValue:(k,v)=>window.s(k,v),deleteValue:async()=>{}};document.addEventListener('DOMContentLoaded',()=>new Function(code)());},{code});
await ctx.route('**/*',async r=>{const u=new URL(r.request().url()),live='<li><article class="onlivecard"><a class="ga-onlive-click" data-room-id="1" href="/r/room-one">Room</a></article><div class="onlivecard-time is-onlive">6:00〜</div><p class="onlivecard-name">Room one</p></li>';
await r.fulfill({contentType:'text/html',body:`<!doctype html><html><body>${u.pathname==='/onlive'?live:'<h1>New30day</h1>'}</body></html>`});});
const p=await ctx.newPage();await p.clock.install({time:new Date(now)});await p.goto('https://www.showroom-live.com/?genre_id=103');const panel=p.locator('#srmr-mobile');await panel.waitFor();
assert.match(await panel.locator('#total').innerText(),/16 \/ 20/);assert.equal(await panel.locator('#start').innerText(),'オンライブ一覧を開く ▶');assert.equal(await panel.locator('#start').isDisabled(),false);
await panel.locator('#start').click();await p.waitForURL('https://www.showroom-live.com/onlive?genre_id=103');await p.locator('#srmr-mobile').waitFor();
assert.match(await p.locator('#srmr-mobile #total').innerText(),/16 \/ 20/);assert.match(await p.locator('#srmr-mobile #name').innerText(),/未記録 1ルーム/);console.log(`PASS ${engine}: empty official home forwards to onlive and preserves 16/20`);await ctx.close();}finally{await browser.close();}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { test } from 'node:test';

type Period = { key: string; start: number; end: number; label: string };
type Room = { slug: string; name?: string };
type State = { period: string; done: { slug: string; at: number }[]; adjustment: number; queue: Room[]; index: number; active: boolean; checkpoint: { slug: string; elapsed: number } | null };
type Runner = {
  periodAt: (now: number) => Period;
  parseRoom: (url: string) => { slug: string; viewing: boolean } | null;
  liveUrl: (slug: string) => string;
  profileUrl: (slug: string) => string;
  normalizeState: (raw: unknown, period: Period) => State;
  countDone: (state: State, target: number) => number;
  addDone: (state: State, slug: string, now: number, period: Period) => boolean;
  adjustCount: (state: State, n: number) => void;
  migrateLegacy: (raw: unknown, period: Period) => State;
  timerDelta: (wall: number, media: number, visible: boolean, playing: boolean) => number;
};
const read = (name: string) => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const srCode = read('SR-Mission-Runner-Mobile.user.js');
const mxCode = read('Mixch-Watch-Helper-Mobile.user.js');
function load(code: string): Runner {
  const sandbox = { module: { exports: {} }, URL };
  new Script(code).runInNewContext(sandbox);
  return sandbox.module.exports as Runner;
}
const sr = load(srCode), mx = load(mxCode);
const at = (time: string) => Date.parse(time);
const morning = at('2026-09-11T08:00:00+09:00');

test('SR changes exactly at 03:00 and 15:00 JST, not at midnight', () => {
  for (const boundary of ['2026-09-11T03:00:00+09:00', '2026-09-11T15:00:00+09:00', '2027-01-01T03:00:00+09:00']) {
    const t = at(boundary);
    assert.notEqual(sr.periodAt(t - 1).key, sr.periodAt(t).key);
    assert.equal(sr.periodAt(t - 1).end, t);
    assert.equal(sr.periodAt(t).start, t);
    assert.equal(sr.periodAt(t).end - t, 12 * 3600000);
  }
  assert.equal(sr.periodAt(at('2026-09-11T23:59:59+09:00')).key, sr.periodAt(at('2026-09-12T02:59:59+09:00')).key);
});
test('8am ten records resume before 15:00 and reset for the next period', () => {
  const period = sr.periodAt(morning), state = sr.normalizeState(null, period);
  for (let i = 0; i < 10; i++) assert.equal(sr.addDone(state, `test${i}`, morning, period), true);
  const resumed = sr.normalizeState(JSON.parse(JSON.stringify(state)), sr.periodAt(at('2026-09-11T14:59:59+09:00')));
  assert.equal(sr.countDone(resumed, 20), 10);
  const next = sr.normalizeState(state, sr.periodAt(at('2026-09-11T15:00:00+09:00')));
  assert.equal(sr.countDone(next, 20), 0);
  assert.equal(next.active, false);
});
test('duplicates, late completions and stale periods never become additional credit', () => {
  const p = sr.periodAt(morning), s = sr.normalizeState(null, p);
  sr.addDone(s, 'test1', morning, p); sr.addDone(s, 'test1', morning, p);
  assert.equal(s.done.length, 1);
  assert.equal(sr.addDone(s, 'test2', p.end, p), false);
  assert.equal(sr.addDone(s, 'test2', p.end, sr.periodAt(p.end)), false);
});
test('manual adjustment preserves known room exclusions and is locally bounded', () => {
  const p = sr.periodAt(morning), s = sr.normalizeState(null, p);
  sr.addDone(s, 'test1', morning, p); sr.adjustCount(s, 10);
  assert.equal(sr.countDone(s, 20), 10); assert.equal(s.done[0].slug, 'test1');
  sr.addDone(s, 'test2', morning, p); assert.equal(sr.countDone(s, 20), 11);
  sr.adjustCount(s, 0); assert.equal(sr.countDone(s, 20), 0);
});
test('legacy import takes only dated entries in this period and has no official-credit claim', () => {
  const p = sr.periodAt(morning);
  const s = sr.migrateLegacy({completed:[{slug:'test1',at:morning},{slug:'test1',at:morning},{slug:'old',at:p.start-1},{slug:'future',at:p.end}]},p);
  assert.equal(s.done.length, 1); assert.equal(s.done[0].slug, 'test1');
  assert.equal(s.active,false);
});
test('SR URLs stay on the exact first-party host and player/follow paths are separate', () => {
  assert.equal(sr.parseRoom('https://www.showroom-live.com/r/test-room')?.slug, 'test-room');
  assert.equal(sr.parseRoom('https://showroom-live.com/lite/test-room')?.viewing, true);
  assert.equal(sr.liveUrl('test-room'), 'https://www.showroom-live.com/lite/test-room');
  assert.equal(sr.profileUrl('test-room'), 'https://www.showroom-live.com/r/test-room');
  for (const u of ['http://showroom-live.com/r/a','https://showroom-live.com.evil.test/r/a','https://evil.test/r/a','javascript:alert(1)','https://user:pass@showroom-live.com/r/a','https://showroom-live.com:8080/r/a','https://showroom-live.com/r/a/x','https://showroom-live.com/r/%2e%2e']) assert.equal(sr.parseRoom(u), null);
});
test('timer requires progressing media and rejects invisible, paused, frozen or resumed gaps', () => {
  assert.equal(sr.timerDelta(250,.25,true,true),250);
  assert.equal(sr.timerDelta(250,0,true,true),0);
  assert.equal(sr.timerDelta(250,.25,false,true),0);
  assert.equal(sr.timerDelta(250,.25,true,false),0);
  assert.equal(sr.timerDelta(30000,30,true,true),0);
  assert.equal(sr.timerDelta(250,-1,true,true),0);
  assert.equal(sr.timerDelta(250,10,true,true),0);
});
test('stored state is defensive about malformed records, queues and checkpoints', () => {
  const p=sr.periodAt(morning);
  const s=sr.normalizeState({period:p.key,done:[null,{slug:'a',at:'bad'}],queue:[{slug:'../secret'},{slug:'safe',name:' <b>literal</b> '},{slug:'safe'}],active:true,index:-2,checkpoint:{slug:'safe',elapsed:Infinity}},p);
  assert.equal(s.done.length,0);assert.equal(s.queue.length,1);assert.equal(s.index,0);assert.equal(s.checkpoint,null);
});
test('Mixch has an independent midnight local diary with no inherited SR 15:00 reset', () => {
  const t=at('2026-09-12T00:00:00+09:00');
  assert.notEqual(mx.periodAt(t-1).key,mx.periodAt(t).key);
  assert.equal(mx.periodAt(morning).key,mx.periodAt(at('2026-09-11T15:00:00+09:00')).key);
  assert.match(mx.periodAt(t).label,/メモ/);
});
test('Mixch accepts verified public live URL form, not events or movie entries', () => {
  assert.equal(mx.parseRoom('https://mixch.tv/u/123456/live')?.viewing,true);
  assert.equal(mx.profileUrl('123456'),'https://mixch.tv/u/123456');
  assert.equal(mx.parseRoom('https://mixch.tv/m/aMovie'),null);
  assert.equal(mx.parseRoom('https://mixch.tv.evil.test/u/123/live'),null);
  assert.equal(mx.liveUrl('not-numeric'),'');
});
test('both installers are self-contained and do not automate service actions', () => {
  for (const code of [srCode,mxCode]) {
    assert.match(code,/@inject-into\s+content/);assert.match(code,/@noframes/);
    assert.doesNotMatch(code,/@require|fetch\(|XMLHttpRequest|\.play\(|location\.replace\(|document\.cookie|sendBeacon/);
    assert.match(code,/公式の達成・受取件数とは同期しません/);
    assert.match(code,/if \(!isList && !current\?\.viewing\) return/);
  }
  assert.match(mxCode,/ブラウザでの視聴コイン付与・現行条件は未検証/);
  assert.match(srCode,/@version\s+1\.1\.0/);
});

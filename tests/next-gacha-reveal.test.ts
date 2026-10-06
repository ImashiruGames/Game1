import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPSULE_DURATION,FLIP_DURATION,TAP_GUARD_DURATION,createGachaRevealState,gachaTotals} from '../src/next/meta/gachaRevealState.ts';
import type {GachaRevealState,RevealClock} from '../src/next/meta/gachaRevealState.ts';
import type {DrawResult} from '../src/next/meta/profile.ts';

class Clock implements RevealClock {
 time=0;next=0;jobs=new Map<number,{at:number;fn:()=>void}>();cancelled:(()=>void)[]=[];
 now(){return this.time;}
 set(fn:()=>void,delay:number){const id=++this.next;this.jobs.set(id,{at:this.time+delay,fn});return id;}
 clear(handle:unknown){const job=this.jobs.get(handle as number);if(job)this.cancelled.push(job.fn);this.jobs.delete(handle as number);}
 advance(ms:number){this.time+=ms;for(const [id,job] of this.jobs)if(job.at<=this.time){this.jobs.delete(id);job.fn();}}
}
const result=(id:number,kind:DrawResult['kind']='energy',duplicate=false):DrawResult=>({id,kind,item:kind==='character'?'mint':kind==='skill'?'charge':'経験値エナジー ×2',duplicate,coins:kind==='skill'&&duplicate?20:0,energy:kind==='energy'?2:kind==='character'&&duplicate?3:0});
test('capsules last 1.8 seconds and ignore taps; only the facedown card flips for 0.4 seconds',()=>{
 const clock=new Clock(),updates:GachaRevealState[]=[],flow=createGachaRevealState([result(1),result(2)],false,s=>updates.push(s),clock);
 assert.equal(flow.current.phase,'capsules');flow.tap(true);flow.tap();assert.equal(flow.current.phase,'capsules');
 clock.advance(CAPSULE_DURATION-1);assert.equal(flow.current.phase,'capsules');clock.advance(1);assert.equal(flow.current.phase,'back');
 flow.tap();assert.equal(flow.current.phase,'back');flow.tap(true);assert.equal(flow.current.phase,'flipping');flow.tap(true);
 clock.advance(FLIP_DURATION-1);assert.equal(flow.current.phase,'flipping');clock.advance(1);assert.equal(flow.current.phase,'front');
 assert.deepEqual(flow.current.seen,[0]);flow.tap();assert.equal(flow.current.index,0);
 clock.advance(TAP_GUARD_DURATION);flow.tap();assert.equal(flow.current.index,1);assert.equal(flow.current.phase,'back');
 // The second half of a double-tap cannot flip the next card.
 flow.tap(true);assert.equal(flow.current.phase,'back');clock.advance(TAP_GUARD_DURATION);flow.tap(true);clock.advance(FLIP_DURATION);clock.advance(TAP_GUARD_DURATION);flow.tap();assert.equal(flow.current.phase,'summary');
 flow.tap(true);flow.skip();assert.equal(flow.current.phase,'summary');assert.deepEqual(flow.current.seen,[0,1]);assert.ok(updates.length>0);
});
test('skip during capsules presents only unseen NEW characters in draw order and never repeats one',()=>{
 const draws=[result(1),result(2,'character'),result(3,'skill'),result(4,'character',true),{...result(5,'character'),item:'rose'},result(6,'skill',true)];
 const before=JSON.stringify(draws),clock=new Clock(),flow=createGachaRevealState(draws,false,()=>{},clock);
 flow.skip();assert.equal(flow.current.phase,'front');assert.equal(flow.current.index,1);assert.deepEqual(flow.current.seen,[1]);assert.equal(clock.jobs.size,0);
 flow.skip();flow.tap();assert.equal(flow.current.index,1);
 clock.advance(TAP_GUARD_DURATION);flow.tap();assert.equal(flow.current.index,4);assert.deepEqual(flow.current.seen,[1,4]);
 clock.advance(TAP_GUARD_DURATION);flow.skip();assert.equal(flow.current.phase,'summary');
 clock.cancelled.forEach(fn=>fn());assert.equal(flow.current.phase,'summary');assert.equal(JSON.stringify(draws),before);
});
test('skip is active immediately during a flip and still shows that unseen NEW character',()=>{
 const clock=new Clock(),flow=createGachaRevealState([result(1,'character'),result(2,'character',true)],false,()=>{},clock);
 clock.advance(CAPSULE_DURATION);flow.tap(true);assert.equal(flow.current.phase,'flipping');flow.skip();assert.equal(flow.current.phase,'front');assert.equal(flow.current.index,0);assert.deepEqual(flow.current.seen,[0]);
 clock.cancelled.forEach(fn=>fn());assert.equal(flow.current.index,0);clock.advance(TAP_GUARD_DURATION);flow.tap();assert.equal(flow.current.phase,'summary');
});
test('skip after a normally revealed NEW character omits it and still shows the next NEW character',()=>{
 const clock=new Clock(),flow=createGachaRevealState([result(1,'character'),result(2,'skill'),{...result(3,'character'),item:'rose'}],true,()=>{},clock);
 flow.tap(true);assert.equal(flow.current.index,0);flow.skip();assert.equal(flow.current.index,2);assert.equal(flow.current.phase,'front');
 clock.advance(TAP_GUARD_DURATION);flow.tap();assert.equal(flow.current.phase,'summary');assert.deepEqual(flow.current.seen,[0,2]);
});
test('skip with no NEW characters goes straight to summary, including reduced-motion single draws',()=>{
 for(const reduced of [false,true]){const clock=new Clock(),flow=createGachaRevealState([result(1,'skill')],reduced,()=>{},clock);flow.skip();assert.equal(flow.current.phase,'summary');assert.equal(clock.jobs.size,0);}
});
test('reduced motion has no capsule or flip timers, while rapid input cannot consume multiple cards',()=>{
 const clock=new Clock(),flow=createGachaRevealState([result(1),result(2,'character')],true,()=>{},clock);
 assert.equal(flow.current.phase,'back');assert.equal(clock.jobs.size,0);flow.tap(true);assert.equal(flow.current.phase,'front');assert.equal(clock.jobs.size,0);flow.tap(true);assert.equal(flow.current.index,0);
 clock.advance(TAP_GUARD_DURATION);flow.tap();assert.equal(flow.current.phase,'back');assert.equal(flow.current.index,1);flow.tap(true);assert.equal(flow.current.phase,'back');clock.advance(TAP_GUARD_DURATION);flow.tap(true);assert.equal(flow.current.phase,'front');assert.deepEqual(flow.current.seen,[0,1]);
});
test('destroy cancels all timers and stale callbacks cannot resurrect a closed or replaced reveal',()=>{
 for(const phase of ['capsules','flipping'] as const){const clock=new Clock(),changes:GachaRevealState[]=[],flow=createGachaRevealState([result(1)],false,s=>changes.push(s),clock);if(phase==='flipping'){clock.advance(CAPSULE_DURATION);flow.tap(true);}const before=changes.length;flow.destroy();flow.destroy();assert.equal(clock.jobs.size,0);clock.cancelled.forEach(fn=>fn());clock.advance(5000);flow.tap(true);flow.skip();assert.equal(flow.current.phase,'closed');assert.equal(changes.length,before);}
});
test('summary totals use actual per-result rewards and include both energy grants and duplicate conversion',()=>{
 const draws=[result(1),result(2,'character',true),result(3,'skill',true),result(4,'character'),result(5,'skill'),{...result(6),energy:1}];
 assert.deepEqual(gachaTotals(draws),{energy:6,coins:20});assert.deepEqual(gachaTotals([]),{energy:0,coins:0});
});

import {preloadGachaPortraits,PORTRAIT_FALLBACK_DELAY} from '../src/next/meta/gachaPortraitPreload.ts';
class Portrait {
 src='';decoding='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;complete=false;naturalWidth=128;
 resolve:()=>void=()=>{};reject:()=>void=()=>{};
 decode(){return new Promise<void>((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
}
test('slow NEW portraits cannot advance or count as seen until load and decode both complete',async()=>{
 const clock=new Clock(),images:Portrait[]=[],settled:string[]=[];let flow:ReturnType<typeof createGachaRevealState>|null=null;
 const preload=preloadGachaPortraits(['mint','mint','rose'],src=>{settled.push(src);flow?.portraitSettled();},()=>{const img=new Portrait();images.push(img);return img as unknown as HTMLImageElement;},clock);
 flow=createGachaRevealState([result(1,'character'),{...result(2,'character'),item:'rose'}],true,()=>{},clock,r=>preload.settled(r.item));
 assert.equal(images.length,2);flow.skip();assert.equal(flow.current.index,0);assert.equal(flow.current.waitingForPortrait,true);assert.deepEqual(flow.current.seen,[]);
 clock.advance(600);flow.tap();flow.skip();assert.equal(flow.current.index,0);assert.deepEqual(flow.current.seen,[]);
 images[0]!.onload?.();assert.equal(preload.status('mint'),'loading');clock.advance(600);flow.tap();flow.skip();assert.equal(flow.current.index,0);
 images[0]!.resolve();await Promise.resolve();assert.deepEqual(settled,['mint']);assert.equal(flow.current.waitingForPortrait,false);assert.deepEqual(flow.current.seen,[0]);
 flow.tap();assert.equal(flow.current.index,0);clock.advance(TAP_GUARD_DURATION);flow.tap();assert.equal(flow.current.index,1);assert.equal(flow.current.waitingForPortrait,true);
 images[1]!.onerror?.();assert.equal(preload.status('rose'),'failed');assert.equal(flow.current.waitingForPortrait,false);assert.deepEqual(flow.current.seen,[0,1]);
 clock.advance(TAP_GUARD_DURATION);flow.tap();assert.equal(flow.current.phase,'summary');preload.destroy();assert.equal(clock.jobs.size,0);
});
test('portrait timeout and decode failures settle as explicit fallbacks and never block results forever',async()=>{
 const clock=new Clock(),images:Portrait[]=[],settled:string[]=[];const preload=preloadGachaPortraits(['slow','broken'],src=>settled.push(src),()=>{const img=new Portrait();images.push(img);return img as unknown as HTMLImageElement;},clock);
 images[1]!.onload?.();images[1]!.reject();await Promise.resolve();assert.equal(preload.status('broken'),'failed');
 clock.advance(PORTRAIT_FALLBACK_DELAY-1);assert.equal(preload.status('slow'),'loading');clock.advance(1);assert.equal(preload.status('slow'),'failed');assert.equal(clock.jobs.size,0);assert.deepEqual(settled,['broken','slow']);
 images[0]!.resolve();await Promise.resolve();assert.deepEqual(settled,['broken','slow']);preload.destroy();
});
test('interruption cancels image timers and an old decode cannot change a replacement reveal',async()=>{
 const clock=new Clock(),images:Portrait[]=[],settled:string[]=[];const preload=preloadGachaPortraits(['mint','rose'],src=>settled.push(src),()=>{const img=new Portrait();images.push(img);return img as unknown as HTMLImageElement;},clock);
 const oldLoad=images[0]!.onload!,oldError=images[1]!.onerror!;oldLoad();preload.destroy();images[0]!.resolve();oldError();clock.cancelled.forEach(fn=>fn());clock.advance(PORTRAIT_FALLBACK_DELAY);await Promise.resolve();assert.deepEqual(settled,[]);assert.equal(clock.jobs.size,0);assert.equal(images[0]!.onload,null);assert.equal(images[1]!.onerror,null);
});

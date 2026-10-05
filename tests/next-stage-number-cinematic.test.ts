import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStageNumberCinematic,stageNumberIsShort,validStageNumberEvent,STAGE_NUMBER_TIMING as timing} from '../src/next/ui/stageNumberCinematic.ts';
import type {StageNumberRequest} from '../src/next/ui/stageNumberCinematic.ts';
import {setup,keyEvent,TestNode} from './helpers/stage-number-dom.ts';
const request=(id:object|string|number=1,from=5):StageNumberRequest=>({eventId:id,event:{type:'stage-transition',fromStage:from,toStage:from+1}});
function clean(h:ReturnType<typeof setup>){assert.equal(h.doc.body.children.length,0);assert.equal(h.win.timers.size,0);assert.equal(h.win.listenerCount,0);assert.equal(h.doc.listenerCount,0);}
test('5 → 6 rolls from before to arrived exactly once in 1100ms without changing its input',async t=>{
 const h=setup();t.after(h.restore);const cues:string[]=[];const c=createStageNumberCinematic({onSound:cue=>cues.push(cue)});
 const r=Object.freeze({...request(Object.freeze({id:1})),event:Object.freeze(request().event)});const before=JSON.stringify(r);let resolutions=0;
 const p=c.play(r).then(result=>{resolutions++;return result;});assert.equal(c.active,true);assert.equal(h.dialog().dataset.phase,'before');
 assert.equal(h.dialog().querySelector('.snc-before')!.textContent,'5');assert.equal(h.dialog().querySelector('.snc-after')!.textContent,'6');
 assert.equal(h.dialog().querySelector('.snc-route')!.textContent,'STAGE 5 → STAGE 6');
 h.win.tick(159);assert.deepEqual(cues,[]);h.win.tick(1);assert.equal(h.dialog().dataset.phase,'rolling');assert.deepEqual(cues,['roll']);
 h.win.tick(540);assert.equal(h.dialog().dataset.phase,'arrived');assert.deepEqual(cues,['roll','arrive']);h.win.tick(260);assert.equal(h.dialog().dataset.phase,'exit');
 h.win.tick(140);assert.deepEqual(await p,{status:'completed'});assert.equal(JSON.stringify(r),before);c.cancel();c.destroy();h.win.tick(10000);assert.equal(resolutions,1);clean(h);
});
test('9 → 10 and 49 → 50 use whole tabular numbers without emitting a 51st stage',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();
 for(const from of [9,49]){const p=c.play(request(from,from));assert.equal(h.dialog().querySelector('.snc-after')!.textContent,String(from+1));h.win.tick(timing.total);assert.equal((await p).status,'completed');clean(h);}
 assert.equal((await c.play(request(50,50))).status,'invalid');clean(h);
 for(const [fromStage,toStage] of [[0,1],[5,7],[NaN,6],[5,Infinity],[5.1,6.1],[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1]])assert.equal(validStageNumberEvent({type:'stage-transition',fromStage:fromStage!,toStage:toStage!}),false);
});
test('event IDs never replay during play, after completion, or following a UI reset',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();const id={};const p=c.play(request(id));
 assert.equal((await c.play(request(id))).status,'duplicate');assert.equal(h.doc.body.children.length,1);h.win.tick(timing.total);await p;c.reset();
 assert.equal((await c.play(request(id))).status,'duplicate');const next=c.play(request('next'));h.win.tick(timing.total);await next;assert.equal((await c.play(request('next'))).status,'duplicate');clean(h);
});
test('restored committed transition stays silent and unmounted and cannot replay later',async t=>{
 const h=setup();t.after(h.restore);const cues:string[]=[];const c=createStageNumberCinematic({onSound:cue=>cues.push(cue)});const id={};
 assert.deepEqual(await c.play({...request(id),restored:true}),{status:'suppressed',reason:'restored'});clean(h);assert.deepEqual(cues,[]);
 assert.equal((await c.play(request(id))).status,'duplicate');
 // A later reward newly chosen from the restored game is a different committed event.
 const next=c.play(request({},6));h.win.tick(timing.total);assert.equal((await next).status,'completed');clean(h);
});
test('click guard consumes the triggering gesture and holds the modal through trailing clicks',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();const p=c.play(request());
 const early=new Event('click',{cancelable:true});h.doc.dispatchEvent(early);assert.equal(early.defaultPrevented,true);assert.equal(c.active,true);
 h.win.tick(timing.skipGuard);const click=new Event('click',{cancelable:true});h.doc.dispatchEvent(click);assert.equal(click.defaultPrevented,true);assert.equal(c.active,true);assert.equal(h.dialog().dataset.phase,'exit');
 const trailing=new Event('click',{cancelable:true});h.doc.dispatchEvent(trailing);assert.equal(trailing.defaultPrevented,true);h.win.tick(timing.releaseGuard-1);assert.equal(c.active,true);h.win.tick(1);assert.equal((await p).status,'skipped');clean(h);
});
test('Enter, Space and Escape skip only on release and swallow the synthetic click',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();
 for(const [i,key] of ['Enter',' ','Escape'].entries()){
  const p=c.play(request(i));h.win.tick(timing.skipGuard);const down=keyEvent('keydown',key);h.doc.dispatchEvent(down);assert.equal(down.defaultPrevented,true);assert.equal(c.active,true);
  const repeat=keyEvent('keydown',key,true);h.doc.dispatchEvent(repeat);assert.equal(h.dialog().dataset.phase,'before');const up=keyEvent('keyup',key);h.doc.dispatchEvent(up);assert.equal(up.defaultPrevented,true);assert.equal(c.active,true);
  const click=new Event('click',{cancelable:true});h.doc.dispatchEvent(click);assert.equal(click.defaultPrevented,true);h.win.tick(timing.releaseGuard);assert.equal((await p).status,'skipped');clean(h);
 }
});
test('accepted pointer skips report one point to the existing same-location board click guard',async t=>{
 const h=setup();t.after(h.restore);const points:unknown[]=[];const c=createStageNumberCinematic({onSkipPointer:point=>points.push(point)});const p=c.play(request());
 const click=()=>Object.assign(new Event('click',{cancelable:true}),{clientX:210,clientY:510,detail:1});
 h.doc.dispatchEvent(click());assert.deepEqual(points,[]);h.win.tick(150);h.doc.dispatchEvent(click());assert.deepEqual(points,[{clientX:210,clientY:510,detail:1}]);
 h.doc.dispatchEvent(click());assert.equal(points.length,1);h.win.tick(timing.releaseGuard);assert.equal((await p).status,'skipped');clean(h);
 const p2=c.play(request(2));h.win.tick(150);h.doc.dispatchEvent(Object.assign(new Event('click',{cancelable:true}),{clientX:0,clientY:0,detail:0}));h.win.tick(timing.releaseGuard);await p2;assert.equal(points.length,1);clean(h);
});
test('early keys cannot skip, other keys and pointer defaults are consumed, Tab remains native',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();const p=c.play(request());
 for(const key of ['Enter',' ','Escape','ArrowDown'])for(const type of ['keydown','keyup']){const e=keyEvent(type,key);h.doc.dispatchEvent(e);assert.equal(e.defaultPrevented,true);}
 for(const type of ['pointerdown','pointerup','dblclick','contextmenu']){const e=new Event(type,{cancelable:true});h.doc.dispatchEvent(e);assert.equal(e.defaultPrevented,true);}
 const tab=keyEvent('keydown','Tab');h.doc.dispatchEvent(tab);assert.equal(tab.defaultPrevented,false);assert.equal(c.active,true);h.win.tick(timing.total);await p;clean(h);
});
test('abort, supersession, reset, pagehide and destroy settle and remove all listeners and timers',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();const a=new AbortController();const p=c.play({...request('abort'),signal:a.signal});a.abort();assert.deepEqual(await p,{status:'cancelled',reason:'aborted'});clean(h);
 const p1=c.play(request(1)),p2=c.play(request(2));assert.deepEqual(await p1,{status:'cancelled',reason:'superseded'});assert.equal(h.doc.body.children.length,1);c.reset();assert.deepEqual(await p2,{status:'cancelled',reason:'reset'});clean(h);
 const p3=c.play(request(3));h.win.dispatchEvent(new Event('pagehide'));assert.deepEqual(await p3,{status:'cancelled',reason:'pagehide'});clean(h);
 const p4=c.play(request(4));h.win.tick(160);h.doc.dispatchEvent(new Event('click',{cancelable:true}));c.cancel('restart');assert.deepEqual(await p4,{status:'cancelled',reason:'restart'});clean(h);
 const p5=c.play(request(5));c.destroy();assert.deepEqual(await p5,{status:'cancelled',reason:'destroyed'});assert.deepEqual(await c.play(request(6)),{status:'cancelled',reason:'destroyed'});clean(h);
});
test('pre-aborted input mounts nothing and does not consume its event ID',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();const a=new AbortController();a.abort();assert.equal((await c.play({...request('a'),signal:a.signal})).status,'cancelled');clean(h);
 const p=c.play(request('a'));assert.equal(c.active,true);c.cancel();await p;clean(h);
});
test('short, low motion, OS reduced motion and UI reduced motion are static for 250ms',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();
 const cases=[{short:true,lowMotion:false},{short:false,lowMotion:true},{short:false,lowMotion:false},{short:false,lowMotion:false}];
 for(const [i,motion] of cases.entries()){
  h.win.reduced=i===2;h.doc.body.dataset.reducedMotion=i===3?'true':'false';const p=c.play({...request(i),motion});assert.equal(h.dialog().dataset.motion,'short');assert.equal(h.dialog().dataset.phase,'arrived');h.win.tick(motion.short?249:1099);assert.equal(c.active,true);h.win.tick(1);assert.equal((await p).status,'completed');clean(h);
 }
 assert.equal(stageNumberIsShort(request()),false);assert.equal(timing.short,250);
});
test('optional audio exceptions and aborts cannot strand the modal or schedule later work',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic({onSound(){throw new Error('missing sound');}});const p=c.play(request());h.win.tick(timing.total);assert.equal((await p).status,'completed');clean(h);
 const a=new AbortController();const c2=createStageNumberCinematic({onSound(){a.abort();}});const p2=c2.play({...request(2),signal:a.signal,motion:{short:true,lowMotion:false}});assert.equal((await p2).status,'cancelled');clean(h);
});
test('native cancel/close and unavailable modal recover without hanging',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();const p=c.play(request(1));const early=new Event('cancel',{cancelable:true});h.dialog().dispatchEvent(early);assert.equal(early.defaultPrevented,true);assert.equal(c.active,true);h.win.tick(150);h.dialog().dispatchEvent(new Event('cancel',{cancelable:true}));h.win.tick(timing.releaseGuard);assert.equal((await p).status,'skipped');clean(h);
 const p2=c.play(request(2));h.dialog().close();assert.deepEqual(await p2,{status:'cancelled',reason:'closed'});clean(h);
 const original=TestNode.prototype.showModal;TestNode.prototype.showModal=()=>{throw new Error('unavailable');};try{assert.deepEqual(await c.play(request(3)),{status:'cancelled',reason:'presentation-unavailable'});clean(h);}finally{TestNode.prototype.showModal=original;}
});
test('focus returns to a connected control after success, but not after cancellation',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();const previous=new TestNode();previous.ownerDocument=h.doc;previous.isConnected=true;h.doc.activeElement=previous;
 const p=c.play(request(1));assert.notEqual(h.doc.activeElement,previous);h.win.tick(timing.total);await p;assert.equal(h.doc.activeElement,previous);clean(h);
 const p2=c.play(request(2));c.cancel();await p2;assert.notEqual(h.doc.activeElement,previous);clean(h);
});
test('source is presentation-only; CSS clips the carousel and covers all reduced-motion paths',()=>{
 const source=readFileSync(new URL('../src/next/ui/stageNumberCinematic.ts',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 assert.doesNotMatch(source,/Math\.random|localStorage|sessionStorage|applyAction|AudioContext|createOscillator|controller\./);
 const css=readFileSync(new URL('../src/next/ui/stageNumberCinematic.css',import.meta.url),'utf8');assert.match(css,/\.snc-after\{transform:translateY\(-112%\)/);assert.match(css,/\.snc-number-window\{[^}]*overflow:hidden/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/data-reduced-motion=true/);assert.match(css,/data-motion=short/);assert.match(css,/safe-area-inset-bottom/);assert.doesNotMatch(css,/animation[^;]*infinite|brightness\([2-9]/);
});

 test('slow static presentation retains full slow duration and remains skippable',async t=>{
 const h=setup();t.after(h.restore);const c=createStageNumberCinematic();
 const p=c.play({...request('slow-static'),motion:{speed:'slow',short:false,lowMotion:true}});
 assert.equal(h.dialog().dataset.motion,'short');h.win.tick(1649);assert(c.active);h.win.tick(1);assert.equal((await p).status,'completed');clean(h);
 const p2=c.play({...request('slow-skip'),motion:{speed:'slow',short:false,lowMotion:true}});h.win.tick(200);h.doc.dispatchEvent(new Event('click',{cancelable:true}));h.win.tick(120);assert.equal((await p2).status,'skipped');clean(h);
 });

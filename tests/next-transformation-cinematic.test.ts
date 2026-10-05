import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTransformationCinematic,transformationIsShort,TRANSFORMATION_TIMING as timing} from '../src/next/ui/transformationCinematic.ts';
import type {TransformationRequest} from '../src/next/ui/transformationCinematic.ts';
import {setup,keyEvent} from './helpers/transformation-dom.ts';
import {createCancelClickGuard} from '../src/next/ui/cancelClickGuard.ts';
const request=(id:object|string|number=1):TransformationRequest=>({eventId:id,event:{type:'transformation',character:'blue'},beforeSrc:'/blue.png',afterSrc:'/blue-transformed.png'});
function clean(h:ReturnType<typeof setup>){assert.equal(h.doc.body.children.length,0);assert.equal(h.win.timers.size,0);assert.equal(h.win.listenerCount,0);assert.equal(h.doc.listenerCount,0);}
test('normal phases happen in order, without mutable game input, and finish exactly once',async t=>{
 const h=setup();t.after(h.restore);const cues:string[]=[];const c=createTransformationCinematic({onSound:cue=>cues.push(cue)});
 const r=request(Object.freeze({id:1}));const before=JSON.stringify(r);let resolved=0;const p=c.play(r).then(result=>{resolved++;return result;});
 assert.equal(c.active,true);assert.equal(h.dialog().dataset.phase,'before');h.win.tick(559);assert.equal(cues.length,0);
 h.win.tick(1);assert.equal(h.dialog().dataset.phase,'energy');assert.deepEqual(cues,['charge']);h.win.tick(620);assert.equal(h.dialog().dataset.phase,'after');assert.deepEqual(cues,['charge','reveal']);
 h.win.tick(710);assert.equal(h.dialog().dataset.phase,'exit');h.win.tick(210);assert.deepEqual(await p,{status:'completed'});assert.equal(c.active,false);c.cancel();c.destroy();h.win.tick(10000);assert.equal(resolved,1);assert.equal(JSON.stringify(r),before);clean(h);
});
test('same event object or primitive never replays and distinct next events still do',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();const id={};const p=c.play(request(id));assert.equal((await c.play(request(id))).status,'duplicate');assert.equal(h.doc.body.children.length,1);h.win.tick(2100);await p;assert.equal((await c.play(request(id))).status,'duplicate');
 const next=c.play(request('next'));h.win.tick(2100);await next;assert.equal((await c.play(request('next'))).status,'duplicate');clean(h);
});
test('click skip guard suppresses input, then skips only the visual and cleans all work',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();const p=c.play(request());const early=new Event('click',{cancelable:true});h.doc.dispatchEvent(early);assert.equal(early.defaultPrevented,true);assert.equal(c.active,true);h.win.tick(150);const click=new Event('click',{cancelable:true});let boardClicks=0;h.doc.addEventListener('click',()=>{boardClicks++;},{once:true});h.doc.dispatchEvent(click);assert.equal(click.defaultPrevented,true);assert.equal(boardClicks,0);assert.equal((await p).status,'skipped');assert.equal(h.win.timers.size,0);assert.equal(h.doc.body.children.length,0);
});
test('pointer skip marks a same-location tail guard before modal removal; keyboard and other locations remain immediate',async t=>{
 const h=setup();t.after(h.restore);const guard=createCancelClickGuard(()=>h.win.performance.now());
 const c=createTransformationCinematic({onSkipPointer:point=>guard.mark(point)});const p=c.play(request());h.win.tick(560);
 const click=new Event('click',{cancelable:true});Object.assign(click,{detail:1,clientX:300,clientY:570});h.doc.dispatchEvent(click);
 assert.equal((await p).status,'skipped');assert.equal(guard.blocks({detail:2,clientX:300,clientY:570}),true);
 assert.equal(guard.blocks({detail:0,clientX:300,clientY:570}),false);
 assert.equal(guard.blocks({detail:1,clientX:100,clientY:570}),false);clean(h);
});
test('Enter, Space and Escape skip on release and never leak down/up into the game',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();
 for(const [i,key] of ['Enter',' ','Escape'].entries()){
  const p=c.play(request(i));h.win.tick(150);const down=keyEvent('keydown',key);h.doc.dispatchEvent(down);assert.equal(down.defaultPrevented,true);assert.equal(c.active,true);
  const repeat=keyEvent('keydown',key,true);h.doc.dispatchEvent(repeat);assert.equal(c.active,true);
  const up=keyEvent('keyup',key);h.doc.dispatchEvent(up);assert.equal(up.defaultPrevented,true);assert.equal((await p).status,'skipped');clean(h);
 }
});
test('early or unrelated keys do not skip, no keyboard default reaches the board',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();const p=c.play(request());
 for(const key of ['Enter',' ','Escape','ArrowDown'])for(const type of ['keydown','keyup']){const e=keyEvent(type,key);h.doc.dispatchEvent(e);assert.equal(e.defaultPrevented,true);}
 assert.equal(c.active,true);h.win.tick(2100);await p;clean(h);
});
test('abort, replacement, explicit cancel, destroy and pagehide settle the pending promise',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();const a=new AbortController();const p=c.play({...request('abort'),signal:a.signal});a.abort();assert.deepEqual(await p,{status:'cancelled',reason:'aborted'});clean(h);
 const p1=c.play(request(1));const p2=c.play(request(2));assert.deepEqual(await p1,{status:'cancelled',reason:'superseded'});assert.equal(h.doc.body.children.length,1);c.cancel('restart');assert.deepEqual(await p2,{status:'cancelled',reason:'restart'});clean(h);
 const p3=c.play(request(3));h.win.dispatchEvent(new Event('pagehide'));assert.deepEqual(await p3,{status:'cancelled',reason:'pagehide'});clean(h);
 const p4=c.play(request(4));c.destroy();assert.deepEqual(await p4,{status:'cancelled',reason:'destroyed'});assert.equal((await c.play(request(5))).status,'cancelled');clean(h);
});
test('already aborted requests do not mount or consume event IDs',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();const a=new AbortController();a.abort();assert.equal((await c.play({...request('a'),signal:a.signal})).status,'cancelled');clean(h);const p=c.play(request('a'));assert.equal(c.active,true);c.cancel();await p;clean(h);
});
test('short, UI low motion and OS reduced motion are static 250ms cut-ins',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();
 const cases=[{short:true,lowMotion:false},{short:false,lowMotion:true},{short:false,lowMotion:false},{short:false,lowMotion:false}];
 for(const [i,motion] of cases.entries()){
  h.win.reduced=i===2;h.doc.body.dataset.reducedMotion=i===3?'true':'false';const p=c.play({...request(i),motion});assert.equal(h.dialog().dataset.phase,'after');assert.equal(h.dialog().dataset.motion,'short');h.win.tick(motion.short?249:2099);assert.equal(c.active,true);h.win.tick(1);assert.equal((await p).status,'completed');clean(h);
 }
 assert.equal(transformationIsShort(request(),false,false),false);assert.equal(timing.short,250);
});
test('a throwing audio hook or an abort during audio cannot deadlock or leave timers',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic({onSound(){throw new Error('audio failed');}});const p=c.play(request());h.win.tick(2100);assert.equal((await p).status,'completed');clean(h);
 const a=new AbortController();const c2=createTransformationCinematic({onSound(){a.abort();}});const p2=c2.play({...request(2),signal:a.signal,motion:{short:true,lowMotion:false}});assert.equal((await p2).status,'cancelled');clean(h);
});
test('invalid event is rejected, formName goes through textContent, missing CSS cannot hang',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();assert.equal((await c.play({...request(),event:{type:'preview',character:'blue'}} as unknown as TransformationRequest)).status,'invalid');clean(h);
 const p=c.play({...request(2),formName:'<img src=x onerror=alert(1)>'});assert.equal(h.dialog().querySelector('.tc-form-name')!.textContent,'<img src=x onerror=alert(1)>');h.win.tick(2100);await p;clean(h);
});
test('source has no engine/RNG/storage/audio side effects, reduced CSS is present and bitmap files stay original',()=>{
 const source=readFileSync(new URL('../src/next/ui/transformationCinematic.ts',import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');assert.doesNotMatch(source,/Math\.random|localStorage|sessionStorage|applyAction|AudioContext|createOscillator|controller\./);
 const css=readFileSync(new URL('../src/next/ui/transformationCinematic.css',import.meta.url),'utf8');assert.match(css,/prefers-reduced-motion/);assert.match(css,/data-reduced-motion=true/);assert.match(css,/data-motion=short/);assert.doesNotMatch(css,/\binfinite\b.*\d|animation[^;]*infinite|brightness\([2-9]/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/object-fit:contain/);
});

 test('slow static presentation retains full slow duration and remains skippable',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();
 const p=c.play({...request('slow-static'),motion:{speed:'slow',short:false,lowMotion:true}});
 assert.equal(h.dialog().dataset.motion,'short');h.win.tick(3149);assert(c.active);h.win.tick(1);assert.equal((await p).status,'completed');clean(h);
 const p2=c.play({...request('slow-skip'),motion:{speed:'slow',short:false,lowMotion:true}});h.win.tick(200);h.doc.dispatchEvent(new Event('click',{cancelable:true}));h.win.tick(120);assert.equal((await p2).status,'skipped');clean(h);
 });

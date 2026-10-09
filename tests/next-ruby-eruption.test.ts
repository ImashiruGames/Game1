import test from 'node:test';
import assert from 'node:assert/strict';
import {rubySpark,rubySparkPoint,rubyMeteorCount,rubyMeteorScale,paintRubyEruption,rubyEruptionDuration,rubyTransformationApplies,createRubyEruption} from '../src/next/ui/rubyEruption.ts';
import {transformationThenLight} from '../src/next/ui/imashiruLight.ts';
import {createBattleAnimator,type BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {trialFixture} from '../src/next/config.ts';
import type {AnimationMotion} from '../src/next/ui/animationTimeline.ts';
test('eruption belongs only to the actual Ruby identity and red transformation',()=>{
 const event={type:'transformation' as const,character:'red' as const,cost:80,before:80,after:0};
 assert(rubyTransformationApplies({characterId:'red'},event));
 assert(!rubyTransformationApplies({characterId:'blue'},event));
 assert(!rubyTransformationApplies({characterId:'red'}, {...event,character:'imashiru'}));
 assert(!rubyTransformationApplies({characterId:'red',meta:{rosterId:'violet'} as any},event));
 assert(!rubyTransformationApplies({characterId:'red'},{type:'gauge',before:0,after:1,amount:1,source:'turn'}));
});
test('visual particles vary without calling random and fall downward within narrow/wide boards',()=>{
 const random=Math.random;Math.random=()=>{throw Error('game/random isolation');};
 try{
  const particles=Array.from({length:5},(_,i)=>rubySpark(i));assert(new Set(particles.map(p=>p.size)).size===5);assert(new Set(particles.map(p=>p.life)).size===5);
  for(const [width,height] of [[190,254],[264,448],[253.6,435.2],[600,260]])for(let i=0;i<5;i++){
   let last=-Infinity;for(let j=0;j<=100;j++){const p=rubySparkPoint(i,j/100,width!,height!);assert(p.y>=last);last=p.y;assert(p.x>=0&&p.x<=width!);assert(p.size>=13*rubyMeteorScale(width!)&&p.size<=18*rubyMeteorScale(width!));assert(Number.isFinite(p.y));}
   assert.equal(rubySparkPoint(i,1,width!,height!).alpha,0);
  }
  assert.deepEqual(rubySpark(8),rubySpark(8));
 }finally{Math.random=random;}
});
function dom(){
 const timers=new Map<number,()=>void>(),frames=new Map<number,FrameRequestCallback>();let id=0,count=0;
 const win=Object.assign(new EventTarget(),{performance:{now:()=>0},devicePixelRatio:1.25,matchMedia:()=>({matches:false}),setTimeout:(f:()=>void)=>{timers.set(++id,f);return id;},clearTimeout:(i:number)=>timers.delete(i),requestAnimationFrame:(f:FrameRequestCallback)=>{frames.set(++id,f);return id;},cancelAnimationFrame:(i:number)=>frames.delete(i)});
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:()=>true});
 const doc={defaultView:win,body:{dataset:{},append(){count++;}},createElement:()=>({width:0,height:0,style:{},setAttribute(){},getContext:()=>ctx,remove(){count--;}})};
 const board={ownerDocument:doc,isConnected:true,getBoundingClientRect:()=>({left:8,top:140,width:253.6,height:339.2})} as unknown as HTMLElement;
 return {board,win,timers,frames,get count(){return count;}};
}
const modes:AnimationMotion[]=[{speed:'slow',short:false,lowMotion:false},{speed:'medium',short:false,lowMotion:false},{speed:'fast',short:true,lowMotion:false},{speed:'medium',short:true,lowMotion:false},{speed:'medium',short:false,lowMotion:true}];
for(const mode of modes)test('Ruby sequence and cleanup '+JSON.stringify(mode),async()=>{
 const before=createBattle(trialFixture('charged','red','marujiro',1,'manual')),result=applyAction(before,{type:'transform'});assert(result.accepted);const original=JSON.stringify({before,result}),h=dom(),effect=createRubyEruption(h.board),abort=new AbortController();let release!:()=>void,completed=false;
 const trace:string[]=[];
 const hooks:BattleAnimationHooks={motion:()=>mode,playSound(){},describe(){},observe(){},highlight(){},render(){},drop(){},react(){},feedback(){return {remove(){}};},pause:async()=>{},complete(){completed=true;trace.push('complete');},
 transform:async e=>transformationThenLight(async()=>{trace.push('portrait');await new Promise<void>(r=>release=r);trace.push('portrait-end');return {status:'completed'};},async short=>{trace.push('eruption');await effect.play(e,abort.signal,mode,short);trace.push('eruption-end');},abort.signal)};
 const pending=createBattleAnimator(hooks)(result.resolution!,before,result.state,abort.signal);assert.equal(h.count,0);release();await Promise.resolve();await Promise.resolve();assert.equal(h.count,1);assert(!completed);
 const [id,frame]=[...h.frames.entries()][0]!;h.frames.delete(id);frame(rubyEruptionDuration(mode));await pending;
 assert.deepEqual(trace,['portrait','portrait-end','eruption','eruption-end','complete']);assert.equal(h.count,0);assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);assert.equal(JSON.stringify({before,result}),original);
});
for(const stop of ['abort','resize','scroll','pagehide','clear','deadline'] as const)test('Ruby cleanup '+stop,async()=>{
 const h=dom(),fx=createRubyEruption(h.board),a=new AbortController(),pending=fx.play({},a.signal,modes[1]!);assert.equal(h.count,1);
 if(stop==='abort')a.abort();else if(stop==='clear')fx.clear();else if(stop==='deadline')[...h.timers.values()][0]!();else h.win.dispatchEvent(new Event(stop));
 await pending;assert(!fx.active);assert.equal(h.count,0);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
});
test('same committed event cannot fire twice; replacement and pre-abort cleanly stop',async()=>{
 const h=dom(),fx=createRubyEruption(h.board),a=new AbortController(),id={};const p=fx.play(id,a.signal,modes[1]!);await fx.play(id,a.signal,modes[1]!);assert.equal(h.count,1);const q=fx.play({},a.signal,modes[1]!);await p;assert.equal(h.count,1);a.abort();await q;await fx.play({},a.signal,modes[1]!);assert.equal(h.count,0);assert.equal(h.frames.size,0);
 assert.deepEqual(modes.map(m=>rubyEruptionDuration(m)),[1350,900,360,360,280]);
});
test('reduced motion is stationary and subdued mode has fewer flame marks',()=>{
 const record=(p:number,reduced:boolean,subdued:boolean)=>{const marks:number[][]=[];const ctx=new Proxy({createRadialGradient:(...args:number[])=>{marks.push(args);return {addColorStop(){}};}},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:()=>true});paintRubyEruption(ctx as unknown as CanvasRenderingContext2D,264,448,p,reduced,subdued);return marks;};
 assert.deepEqual(record(.2,true,false),record(.8,true,false));assert.equal(record(.2,true,false).length,2);
 assert(record(.5,false,true).length<record(.5,false,false).length);
});

test('meteor count, solid body size and vertical lanes match the sparse heavy shower',()=>{
 assert.deepEqual([rubyMeteorCount(),rubyMeteorCount(false,true),rubyMeteorCount(true)],[5,3,2]);
 const p=Array.from({length:5},(_,i)=>rubySpark(i));assert.equal(new Set(p.map(x=>x.startX)).size,5);
 for(const width of [190,253.6,264,600])for(let i=0;i<5;i++){
  const start=rubySparkPoint(i,0,width,448);
  for(let j=0;j<=100;j++)assert.equal(rubySparkPoint(i,j/100,width,448).x,start.x);
  const diameter=start.size*2;assert(diameter>=26*rubyMeteorScale(width)&&diameter<=36*rubyMeteorScale(width));
 }
});
test('actual painter draws five large filled meteor heads and broad tails at peak',()=>{
 let fills=0;const arcs:number[][]=[],moves:number[][]=[],curves:number[][]=[];
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}}),fill(){fills++;},arc:(...a:number[])=>arcs.push(a),moveTo:(...a:number[])=>moves.push(a),quadraticCurveTo:(...a:number[])=>curves.push(a)},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:()=>true});
 paintRubyEruption(ctx as unknown as CanvasRenderingContext2D,264,448,.5);
 assert.equal(arcs.length,20);assert.equal(fills,30);assert.equal(moves.length,10);
 for(let i=0;i<5;i++){const h=rubySparkPoint(i,.5,264,448),head=arcs[i*4+1]!;
  assert.equal(head[0],h.x);assert.equal(head[1],h.y);assert(head[2]!>=13);
  const tail=moves[i*2]!;assert.equal(tail[0],h.x);assert(h.y-tail[1]!>h.size*3);
 }
 assert(curves.length>=30);
});

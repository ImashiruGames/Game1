import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {createProfile,freezeRunMeta} from '../src/next/meta/profile.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {createBattleAnimator,type BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {createImashiruLight,configureLightCanvas,paintLightGather,transformationThenLight,lightSpiralPoint,lightGatherDuration,lightOrbitMotion,lightBurstEnvelope} from '../src/next/ui/imashiruLight.ts';
import type {AnimationMotion} from '../src/next/ui/animationTimeline.ts';
import type {BattleState} from '../src/next/core/types.ts';
function fixture(){
 const p=createProfile();p.ownedCharacters.push('imashiru');const x=prepareDeparture(freezeRunMeta(p,'imashiru',false),1);
 const before=createBattle({...x.config,initialGauge:230,initialBoxes:[
 {id:'a',row:7,col:0,type:'poison',poisonSource:'enemy',owner:'player',status:'normal'},
 {id:'b',row:7,col:1,type:'normal',owner:'player',status:'normal'},
 {id:'c',row:7,col:2,type:'shiny',owner:'player',status:'normal'},
 {id:'enemy',row:7,col:5,type:'normal',owner:'enemy',status:'normal'}]});
 const result=applyAction(before,{type:'transform'});assert(result.accepted);return {before,result};
}
const modes:AnimationMotion[]=[{speed:'slow',short:false,lowMotion:false},{speed:'medium',short:false,lowMotion:false},{speed:'fast',short:true,lowMotion:false},{speed:'medium',short:true,lowMotion:false},{speed:'slow',short:false,lowMotion:true}];
for(const motion of modes)test('portrait → gathering → shiny, '+JSON.stringify(motion),async()=>{
 const {before,result}=fixture(),original=JSON.stringify({before,result}),abort=new AbortController();const trace:string[]=[];let shown=before;
 let portraitDone!:()=>void,gatherDone!:()=>void;
 const hooks:BattleAnimationHooks={motion:()=>motion,playSound(){},describe(){},observe(){},highlight(){},render(s){shown=s;trace.push(s.boxes.find(b=>b.id==='b')?.type??'gone');},drop(){},react(){},feedback(){return {remove(){}};},complete(){trace.push('complete');},pause:async()=>{},
 transform:async()=>transformationThenLight(async()=>{trace.push('portrait');await new Promise<void>(r=>portraitDone=r);trace.push('portrait-end');return {status:'completed'};},async()=>{trace.push('gather');assert.equal(shown.boxes.find(b=>b.id==='b')?.type,'normal');await new Promise<void>(r=>gatherDone=r);trace.push('gather-end');},abort.signal)};
 // An earlier event that reads final boxes used to leak future shiny types.
 const resolution={...result.resolution!,events:[{type:'kit-board-changed' as const,boxIds:['a','b']},...result.resolution!.events]};
 const pending=createBattleAnimator(hooks)(resolution,before,result.state,abort.signal);
 assert.equal(shown.boxes.find(b=>b.id==='a')?.type,'poison');assert.equal(shown.boxes.find(b=>b.id==='a')?.poisonSource,'enemy');
 assert(!trace.includes('shiny'));portraitDone();await Promise.resolve();await Promise.resolve();assert(trace.includes('gather'));assert(!trace.includes('shiny'));
 gatherDone();await pending;assert(trace.indexOf('portrait-end')<trace.indexOf('gather'));assert(trace.indexOf('gather-end')<trace.indexOf('shiny'));assert.deepEqual(shown,result.state);assert.equal(JSON.stringify({before,result}),original);
});
test('skip keeps a shortened gather barrier; abort cannot start a late gather',async()=>{
 const a=new AbortController();let short=false;
 await transformationThenLight(async()=>({status:'skipped'}),async s=>{short=s;},a.signal);assert(short);
 await transformationThenLight(async()=>{a.abort();return {status:'completed'};},async()=>assert.fail('late gather'),a.signal);
 for(const status of ['cancelled','invalid','duplicate'] as const)await transformationThenLight(async()=>({status}),async()=>assert.fail('invalid gather'),new AbortController().signal);
});
test('spirals begin separated and hollow, rotate counterclockwise and merge together',()=>{
 const a=lightSpiralPoint(0,0),b=lightSpiralPoint(0,1);assert(Math.hypot(a.x-b.x,a.y-b.y)>1.8);
 assert(Math.hypot(lightSpiralPoint(.15,0).x,lightSpiralPoint(.15,0).y)>.85);
 for(let p=.01;p<.7;p+=.01){const u=lightSpiralPoint(p-.001,0),v=lightSpiralPoint(p,0);assert(u.x*v.y-u.y*v.x<0);}
 for(const arm of [0,1])assert(Math.hypot(lightSpiralPoint(.76,arm).x,lightSpiralPoint(.76,arm).y)<1e-8);
 assert.deepEqual(modes.map(m=>lightGatherDuration(m)),[2325,1550,480,480,360]);
});
function dom(){
 const timers=new Map<number,()=>void>(),frames=new Map<number,FrameRequestCallback>();let id=0,count=0,rect={left:10,top:20,width:260,height:350};
 const win=Object.assign(new EventTarget(),{performance:{now:()=>0},devicePixelRatio:1,matchMedia:()=>({matches:false}),setTimeout:(f:()=>void)=>{timers.set(++id,f);return id;},clearTimeout:(i:number)=>timers.delete(i),requestAnimationFrame:(f:FrameRequestCallback)=>{frames.set(++id,f);return id;},cancelAnimationFrame:(i:number)=>frames.delete(i)});
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:()=>true});
 const doc={defaultView:win,body:{dataset:{},append(){count++;}},createElement:()=>({style:{},setAttribute(){},getContext:()=>ctx,remove(){count--;}})};
 const board={ownerDocument:doc,isConnected:true,getBoundingClientRect:()=>rect} as unknown as HTMLElement;
 return {board,win,timers,frames,get count(){return count;},resize(){rect={...rect,width:300};win.dispatchEvent(new Event('resize'));}};
}
for(const stop of ['abort','resize','scroll','pagehide','clear','deadline','complete'] as const)test('gather cleanup: '+stop,async()=>{
 const h=dom(),effect=createImashiruLight(h.board),a=new AbortController(),pending=effect.play(a.signal,modes[1]!);assert(effect.active);assert.equal(h.count,1);
 if(stop==='abort')a.abort();else if(stop==='resize')h.resize();else if(stop==='scroll'||stop==='pagehide')h.win.dispatchEvent(new Event(stop));else if(stop==='clear')effect.clear();else if(stop==='deadline')[...h.timers.values()][0]!();else {const [id,f]=[...h.frames.entries()][0]!;h.frames.delete(id);f(2200);}
 await pending;assert(!effect.active);assert.equal(h.count,0);assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);effect.clear();
});
test('replacement removes old canvas and cancellation prevents shiny reveal',async()=>{
 const h=dom(),effect=createImashiruLight(h.board),a=new AbortController();const p=effect.play(a.signal,modes[0]!);const q=effect.play(a.signal,modes[2]!);await p;assert.equal(h.count,1);a.abort();await q;assert.equal(h.count,0);
 const {before,result}=fixture(),abort=new AbortController();let completed=false,last:BattleState=before;
 const hooks:BattleAnimationHooks={motion:()=>modes[1]!,playSound(){},describe(){},observe(){},highlight(){},render(s){last=s;},drop(){},react(){},feedback(){return {remove(){}};},complete(){completed=true;},pause:async()=>{},transform:async()=>{abort.abort();}};
 await createBattleAnimator(hooks)(result.resolution!,before,result.state,abort.signal);assert(!completed);assert.equal(last.boxes.find(b=>b.id==='b')?.type,'normal');
});

test('main orbit is circular, diametrically opposed and shrinks without radial wobble',()=>{
 let previous=1;
 for(let i=0;i<=760;i++){
  const p=i/1000,a=lightSpiralPoint(p,0),b=lightSpiralPoint(p,1),radius=Math.hypot(a.x,a.y);
  assert(Math.abs(a.x+b.x)<1e-12&&Math.abs(a.y+b.y)<1e-12,'same radius and opposite phase');
  if(p<=.72*.16)assert(Math.abs(radius-1)<1e-12,'opening orbit is a true circle');
  assert(radius<=previous+1e-12,'convergence never bulges outward');previous=radius;
 }
 assert(previous<1e-12);
 const head=lightSpiralPoint(.15,0),strand=lightSpiralPoint(.15,0,1);
 assert(Math.hypot(head.x-strand.x,head.y-strand.y)>0,'fine tail strands remain distinct');
});
test('actual painter and canvas CSS mapping keep equal radii on tall, wide and fractional small screens',()=>{
 for(const [width,height] of [[264,352],[190,254],[262,350],[304,260],[253.6,339.2]]){
  for(const dpr of [1,1.25,2,3]){
   let sx=0,sy=0;const heads:number[][]=[];
   const ctx=new Proxy({scale:(x:number,y:number)=>{sx=x;sy=y;},createRadialGradient:(x:number,y:number)=>{heads.push([x,y]);return {addColorStop(){}};}},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:()=>true});
   const canvas={width:0,height:0,style:{},getContext:()=>ctx} as unknown as HTMLCanvasElement;
   assert.equal(configureLightCanvas(canvas,width!,height!,dpr),ctx);
   for(let i=1;i<21;i++){
    heads.length=0;paintLightGather(ctx as unknown as CanvasRenderingContext2D,width!,height!,i/100);
    assert.equal(heads.length,2);
    for(const [x,y] of heads){const screenX=x!*sx*width!/canvas.width,screenY=y!*sy*height!/canvas.height;
     assert(Math.abs(Math.hypot(screenX,screenY)-Math.min(width!,height!)*.39*lightOrbitMotion(i/100).radius)<1e-9,'screen-space radius independent of aspect ratio / DPR');
    }
   }
  }
 }
});

test('angular velocity increases smoothly with shrinking radius, not constant-speed playback',()=>{
 const velocity=(p:number)=>{const h=.000001;return -(lightOrbitMotion(p+h).angle-lightOrbitMotion(p-h).angle)/(2*h);};
 let previous=velocity(.13);
 for(let p=.14;p<.70;p+=.01){const v=velocity(p);assert(v>=previous-1e-8);assert(lightOrbitMotion(p).radius<lightOrbitMotion(p-.01).radius);previous=v;}
 assert(velocity(.69)>velocity(.05)*6,'more than sixfold acceleration as radius approaches zero');
 assert(Math.abs(velocity(.11519)-velocity(.11521))<.001,'no abrupt angular-speed jump at convergence start');
 assert.equal(lightGatherDuration(modes[1]!),1550);
 assert.equal(lightGatherDuration(modes[0]!),2325);
 assert.equal(lightGatherDuration(modes[2]!),480);
 assert.equal(lightGatherDuration({...modes[1]!,lowMotion:true}),360);
});
test('fusion flash has only one peak and settles before shiny reveal',()=>{
 let falling=false,last=0;
 for(let i=0;i<=1000;i++){const value=lightBurstEnvelope(i/1000);assert(value>=0&&value<=1);
  if(value<last-1e-10)falling=true;if(falling)assert(value<=last+1e-10,'no second flash');last=value;
 }
 assert.equal(lightBurstEnvelope(.72),0);assert.equal(lightBurstEnvelope(.77),1);assert.equal(lightBurstEnvelope(1),0);
});
test('burst adds broad light area and thicker layered rays; short and reduced stay subdued',()=>{
 const record=(reduced:boolean,subdued:boolean)=>{const widths:number[]=[],alphas:number[]=[],radii:number[]=[];let currentWidth=0;
 const target={createRadialGradient:(_x:number,_y:number,_r:number,_xx:number,_yy:number,r:number)=>{radii.push(r);return {addColorStop(_at:number,color:string){alphas.push(Number(color.split(',').at(-1)!.replace(')','')));}};},stroke(){widths.push(currentWidth);}};
 const ctx=new Proxy(target,{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{},set:(_o,k,v)=>{if(k==='lineWidth')currentWidth=v;return true;}});
 paintLightGather(ctx as unknown as CanvasRenderingContext2D,190,254,.80,reduced,subdued);return {widths,alphas,radii};};
 const full=record(false,false),short=record(false,true),low=record(true,false);
 assert(Math.max(...full.widths)>=12);assert(Math.max(...full.radii)>190*.39*.58);
 assert(Math.max(...short.widths)<Math.max(...full.widths));assert(Math.max(...short.alphas)<Math.max(...full.alphas));
 assert.equal(low.radii.length,1);assert.equal(low.widths.length,1);assert.equal(low.widths[0],1);
});

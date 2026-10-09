import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {previewTiming,inspectionTime,seekDropFrame,INSPECTION_DURATION} from '../experiments/ruby-auto-drop/playback.ts';
import {createBattle,applyAction,defaultConfig} from '../src/next/core/index.ts';
import {createBattleAnimator} from '../src/next/ui/battleAnimator.ts';
import {dropMotionFrames,dropMotionGeometry} from '../src/next/ui/dropMotion.ts';
import {rubyDropFlameFrames} from '../src/next/ui/rubyDropFlame.ts';
for(const rate of [1,.25,.1])for(const speed of ['medium','slow','fast'] as const)test('preview '+rate+'x / '+speed+' shares the fall and wait budget',async()=>{
 const before=createBattle({...defaultConfig,characterId:'red',initialTransformation:{character:'red',scope:'run',remainingStarts:2}}),r=applyAction(before,{type:'start-turn'});assert(r.accepted);
 const waits:number[]=[];let duration=0;const snapshot=JSON.stringify({before,r});
 await createBattleAnimator({motion:()=>({speed,short:speed==='fast',lowMotion:false}),playSound(){},describe(){},observe(){},highlight(){},render(){},drop(_e,_s,m){duration=m.timeline!.drop;},react(){},feedback(){return {remove(){}};},transform:async()=>{},complete(){},pause:async ms=>{waits.push(ms);}},previewTiming(rate))(r.resolution!,before,r.state,new AbortController().signal);
 const expected=speed==='fast'?15:180/rate*(speed==='slow'?1.5:1);assert.equal(duration,expected);assert.deepEqual(waits.slice(0,2),[expected,expected]);assert.equal(JSON.stringify({before,r}),snapshot);
});
test('preview 0.25x default and 0.1x observation do not change production timing constants',()=>{assert.deepEqual(previewTiming(NaN),{dropHoldMs:720,shortDropHoldMs:15});assert.equal(previewTiming(.1).dropHoldMs,1800);assert.equal(previewTiming(1).dropHoldMs,180);});
for(const percent of [0,60,100])test('inspection seeks box and flame together at flight '+percent+'%',()=>{
 const animations=[{paused:false,currentTime:null as number|null,pause(){this.paused=true;}},{paused:false,currentTime:null as number|null,pause(){this.paused=true;}}];
 const time=seekDropFrame(animations,percent);assert.equal(time,percent/100*40000);assert(animations.every(a=>a.paused&&a.currentTime===time));assert.equal(INSPECTION_DURATION,60000);
 const offsets=rubyDropFlameFrames(2/3);assert.equal(offsets[0]!.easing,'steps(1,end)');assert.equal(percent===100?offsets[1]!.opacity:offsets[0]!.opacity,percent===100?0:1);
});
test('production fall has distinct initial/intermediate/landing keyframes and extinguishes at the landing offset',()=>{
 const geometry={width:36,height:36,points:Array.from({length:8},(_,i)=>({x:24,y:40+38*i}))},frames=dropMotionFrames(geometry),initial=frames[0]!,middle=frames[3]!,landing=frames[7]!;
 assert.equal(initial.transform,'translate(24px, 40px) scaleY(1)');assert.equal(middle.transform,'translate(24px, 154px) scaleY(1)');assert.equal(landing.transform,'translate(24px, 306px) scaleY(1)');assert(Number(middle.offset)>0&&Number(middle.offset)<Number(landing.offset));assert.equal(landing.offset,2/3);assert.equal(rubyDropFlameFrames(2/3)[1]!.offset,landing.offset);assert.equal(frames.at(-1)!.transform,landing.transform);assert.equal(inspectionTime(100)/INSPECTION_DURATION,landing.offset);
});
test('uneven occupied-row geometry suppresses flight; equal preview tracks retain the real full path',()=>{
 const before=createBattle({...defaultConfig,characterId:'red',initialTransformation:{character:'red',scope:'run',remainingStarts:2}}),r=applyAction(before,{type:'start-turn'}),e=r.resolution!.events.find(e=>e.type==='drop')!;
 const area={left:0,top:0,width:300,height:400},rects=e.path.map(c=>({left:c.col*38,top:30+c.row*38,width:36,height:36}));assert(dropMotionGeometry(e,area,rects));const uneven=rects.map((v,i)=>i===rects.length-1?{...v,height:70}:v);assert.equal(dropMotionGeometry(e,area,uneven),null);
 const source=readFileSync(new URL('../experiments/ruby-auto-drop/check.ts',import.meta.url),'utf8');assert(source.includes("grid-template-rows:repeat(8,minmax(0,1fr))"));assert.match(source,/min-height:0/);assert.match(source,/const played=drop.play/);assert(source.includes("diagnostic(played)"));
});
test('inspection uses production moving-box animations; live preview records computed browser frames',()=>{
 const source=readFileSync(new URL('../experiments/ruby-auto-drop/check.ts',import.meta.url),'utf8'),html=readFileSync(new URL('../experiments/ruby-auto-drop/index.html',import.meta.url),'utf8');
 assert(source.includes("box.getAnimations()"));assert(source.includes("seekDropFrame(animations"));assert(source.includes("getComputedStyle(box).transform"));assert.match(source,/signal===abort.signal/);assert.match(html,/value="0.25" selected/);assert.match(html,/id="initial"/);assert.match(html,/id="middle"/);assert.match(html,/id="landed"/);assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB/);
});

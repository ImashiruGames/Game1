import {energyReviewFixture} from '../src/next/ui/energyReviewFixture.ts';
import test from 'node:test';import assert from 'node:assert/strict';
import {animationTimeline,captureAnimationMotion} from '../src/next/ui/animationTimeline.ts';
import {SETTINGS_GEAR_PATH,controlIcon} from '../src/next/ui/controlIcons.ts';
import {createBattleAnimator} from '../src/next/ui/battleAnimator.ts';
import type {BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {boardSkillCueForEvent} from '../src/next/ui/boardSkillPresentation.ts';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {prepareTrialSetup} from '../src/next/config.ts';

test('all motion flags derive one immutable profile; effects fit their event budget',()=>{
 for(const short of [false,true])for(const lowMotion of [false,true]){
  const p=animationTimeline({short,lowMotion});assert(Object.isFrozen(p)&&Object.isFrozen(p.attack)&&Object.isFrozen(p.skill));
  assert.equal(p.short,short);assert.equal(p.drop,p.short?15:180);
  assert.equal(p.attack.lead+p.attack.hold,p.short?150:600);assert.equal(p.feedback.lead+p.feedback.hold,p.short?150:600);
  assert(p.material<=p.drop);assert(p.portrait.mark<=p.attack.hold);assert(p.portrait.hit<=p.attack.hold);
 }
 const mutable={short:false,lowMotion:false},captured=captureAnimationMotion(mutable);mutable.short=true;
 assert.equal(captured.short,false);assert.equal(captured.timeline!.attack.lead,300);
});

test('conversion tail is finished before completion/input unlock for normal and both reduced flags',async()=>{
 for(const short of [false,true])for(const lowMotion of [false,true]){
  const setup=prepareTrialSetup({character:'red',firstEnemy:'marujiro',seed:1,stage:1,fixture:'normal',route:'boss-loop',mode:'manual'});
  const before=createBattle({...setup.config,initialBoxes:[{id:'e',row:7,col:1,owner:'enemy',type:'normal',status:'normal'}]});
  const result=applyAction(before,{type:'board-skill',skillId:'ember'});assert(result.accepted&&result.resolution);
  let elapsed=0,visualEnd=0,complete=false,ended=false;const seen:string[]=[],snapshot=JSON.stringify(result);
  const hooks:BattleAnimationHooks={motion:()=>({short,lowMotion}),begin:m=>assert(Object.isFrozen(m)),end:()=>{ended=true;},playSound(){},describe(){},observe:e=>{seen.push(e.type);},highlight(){},render(){},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},pause:async ms=>{elapsed+=ms;},
   boardSkill(e,r,b,_signal,m){const cue=boardSkillCueForEvent(e,r,b);if(!cue)return;const duration=cue.phase==='activation'?m.timeline!.skill.name:m.timeline!.skill.effect;visualEnd=elapsed+duration;return duration;},
   complete(){assert(elapsed>=visualEnd,'the old implementation unlocked with 240/420ms still running');complete=true;}};
  await createBattleAnimator(hooks)(result.resolution,before,result.state,new AbortController().signal);
  assert(complete&&ended);assert.deepEqual(seen,result.resolution.events.map(e=>e.type));assert.equal(JSON.stringify(result),snapshot);
  // 日本語: 発動の演出(760/240ms)が終わってから効果を出すので、その分だけ全体が長くなる。
  assert.equal(elapsed,short?390+240:1020+760);
 }
});

test('action cleanup runs on abort, preserving the committed event list',async()=>{
 const setup=prepareTrialSetup({character:'red',firstEnemy:'marujiro',seed:1,stage:1,fixture:'normal',route:'boss-loop',mode:'manual'}),before=createBattle(setup.config),r=applyAction(before,{type:'board-skill',skillId:'ember'});assert(r.accepted&&r.resolution);
 let ends=0,completes=0;const abort=new AbortController();const hooks:BattleAnimationHooks={motion:()=>({short:false,lowMotion:false}),end(){ends++;},playSound(){},describe(){},observe(){},highlight(){},render(){},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete(){completes++;},pause:async()=>{abort.abort();}};
 await createBattleAnimator(hooks)(r.resolution,before,r.state,abort.signal);assert.equal(ends,1);assert.equal(completes,0);
});

test('gear has eight exactly repeated teeth and a centered circular bore, with no glyph fallback',()=>{
 const points=[...SETTINGS_GEAR_PATH.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(m=>[Number(m[1])-12,Number(m[2])-12] as const);assert.equal(points.length,32);
 for(let i=0;i<32;i++){const [x,y]=points[i]!,[rx,ry]=points[(i+8)%32]!;assert(Math.abs(rx+y)<.002&&Math.abs(ry-x)<.002);}
 const markup=controlIcon('settings');assert.match(markup,/viewBox="0 0 24 24"/);assert.match(markup,/<circle cx="12" cy="12" r="3.2"/);assert.doesNotMatch(markup,/⚙/);
});

test('every link lands immediately before its HP change and label, at the captured 300/0ms lead',async()=>{
 for(const short of [false,true])for(const lowMotion of [false,true]){
  const before=createBattle(energyReviewFixture('axes').config),r=applyAction(before,{type:'drop',candidateId:'ceiling:2:0'});assert(r.accepted&&r.resolution);
  let elapsed=0,flightAt=0,lastImpact=-1,impactCount=0;let shown=before;const expected=r.resolution.events.filter(e=>e.type==='attack');
  const hooks:BattleAnimationHooks={motion:()=>({short,lowMotion}),playSound(){},describe(e){if(e.type==='attack')assert.equal(lastImpact,elapsed);},observe(){},highlight(){},render(s){if(s.hp.enemy.current!==shown.hp.enemy.current||s.hp.player.current!==shown.hp.player.current)assert.equal(lastImpact,elapsed);shown=s;},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete(){},pause:async ms=>{elapsed+=ms;},energy(e,_links,_s,_signal,m){if(e.type==='attack'){assert.equal(m.timeline!.attack.lead,short?0:300);flightAt=elapsed;}},impact(e){if(e.type==='attack'){assert.equal(elapsed-flightAt,short?0:300);lastImpact=elapsed;impactCount++;}}};
  await createBattleAnimator(hooks)(r.resolution,before,r.state,new AbortController().signal);assert.equal(impactCount,expected.length);assert.equal(shown.hp.enemy.current,r.state.hp.enemy.current);
 }
});

test('three speeds keep identical pacing across all app/OS reduction combinations',async()=>{
 const {transformationTiming}=await import('../src/next/ui/transformationCinematic.ts');
 const {stageNumberTiming}=await import('../src/next/ui/stageNumberCinematic.ts');
 for(const speed of ['slow','medium','fast'] as const){
  const expected=animationTimeline({speed,short:speed==='fast',lowMotion:false});
  for(const app of [false,true])for(const os of [false,true]){
   const m=captureAnimationMotion({speed,short:speed==='fast',lowMotion:app||os});
   assert.deepEqual(m.timeline,expected);assert.equal(m.lowMotion,app||os);
   assert.equal(transformationTiming(m).total,speed==='slow'?3150:speed==='medium'?2100:250);
   assert.equal(stageNumberTiming(m).total,speed==='slow'?1650:speed==='medium'?1100:250);
  }
 }
});

test('slow action keeps its impact boundary when preference changes mid-action; next action uses fast',async()=>{
 const before=createBattle(energyReviewFixture('axes').config),r=applyAction(before,{type:'drop',candidateId:'ceiling:2:0'});assert(r.accepted&&r.resolution);
 let speed:'slow'|'medium'|'fast'='slow',elapsed=0,flight=0,expectedLead=450,impactCount=0;
 const hooks:BattleAnimationHooks={motion:()=>({speed,short:speed==='fast',lowMotion:true}),playSound(){},describe(){},observe(){},highlight(){},render(){},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete(){},pause:async ms=>{elapsed+=ms;speed='fast';},energy(e){if(e.type==='attack')flight=elapsed;},impact(e){if(e.type==='attack'){assert.equal(elapsed-flight,expectedLead);impactCount++;}}};
 const animate=createBattleAnimator(hooks);await animate(r.resolution,before,r.state,new AbortController().signal);assert(impactCount>0);
 expectedLead=0;await animate(r.resolution,before,r.state,new AbortController().signal);
});

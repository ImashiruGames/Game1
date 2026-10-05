import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {prepareTrialSetup} from '../src/next/config.ts';
import type {BattleState} from '../src/next/core/types.ts';
import {feedbackPosition} from '../src/next/ui/battleFeedback.ts';
import {createBattleAnimator} from '../src/next/ui/battleAnimator.ts';
import type {BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';

test('skill presentation sees committed board mutations only after their render, preserving HP order',async()=>{
 for(const character of ['blue','red'] as const){
  const setup=prepareTrialSetup({character,firstEnemy:'marujiro',seed:1,stage:1,fixture:'normal',route:'boss-loop',mode:'manual'});
  const before=createBattle({...setup.config,initialBoxes:[{id:'enemy',row:7,col:1,owner:'enemy',type:'normal',status:'normal'},{id:'own',row:7,col:2,owner:'player',type:'normal',status:'normal'}]});
  const result=applyAction(before,{type:'board-skill',skillId:character==='blue'?'pain-shared':'ember',...(character==='blue'?{row:7}:{})});assert(result.accepted&&result.resolution);
  let shown:BattleState|undefined;const cues:{type:string;hp:number;boxes:BattleState['boxes']}[]=[];let completes=0;
  const hooks:BattleAnimationHooks={motion:()=>({short:true,lowMotion:false}),playSound(){},describe(){},observe(){},highlight(){},render:s=>{shown=s;},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete:()=>{completes++;},pause:async()=>{},boardSkill(event,resolution,origin){assert.strictEqual(resolution,result.resolution);assert.strictEqual(origin,before);assert(shown);cues.push({type:event.type,hp:shown.hp.player.current,boxes:shown.boxes});}};
  const snapshot=JSON.stringify({before,result});await createBattleAnimator(hooks)(result.resolution,before,result.state,new AbortController().signal);
  assert.equal(completes,1);assert.deepEqual(cues.map(c=>c.type),result.resolution.events.map(e=>e.type));assert.equal(JSON.stringify({before,result}),snapshot);
  const mutation=cues.find(c=>c.type===(character==='blue'?'row-cleared':'boxes-converted'))!;assert(mutation);assert.deepEqual(mutation.boxes,result.state.boxes);
  assert.equal(mutation.hp,character==='blue'?before.hp.player.current:result.state.hp.player.current);
 }
});
test('aborted presentations never deliver a skill cue or finish callback',async()=>{
 const setup=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:1,stage:1,fixture:'normal',route:'boss-loop',mode:'manual'}),before=createBattle(setup.config),r=applyAction(before,{type:'board-skill',skillId:'pain-shared',row:7});assert(r.accepted&&r.resolution);let count=0;
 const hooks:BattleAnimationHooks={motion:()=>({short:false,lowMotion:false}),playSound(){},describe(){},observe(){},highlight(){},render(){},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete:()=>{count++;},boardSkill:()=>{count++;},pause:async()=>{}};
 const abort=new AbortController();abort.abort();await createBattleAnimator(hooks)(r.resolution,before,r.state,abort.signal);assert.equal(count,0);
});

test('skill names reserve only floating-feedback space, including its rise, without overflowing',()=>{
 for(const width of [320,390,540])for(const reserved of [0,32,56]){
  const area={width,height:370},label={width:280,height:60};
  const p=feedbackPosition(area,[],label,'player',reserved);
  assert.ok(p.y-label.height-p.rise>=reserved+6);assert.ok(p.y<=area.height-6);
  assert.ok(p.x>=label.width/2+6);assert.ok(p.x+label.width/2<=width-6);
  if(reserved===0)assert.deepEqual(p,feedbackPosition(area,[],label,'player'));
 }
 const p=feedbackPosition({width:390,height:200},[],{width:200,height:60},'enemy',10_000);assert.equal(p.y,194);assert.equal(p.rise,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {trialFixture} from '../src/next/config.ts';
import {readabilityReviewFixture} from '../src/next/ui/readabilityReviewFixture.ts';
import {createBattleAnimator,pauseAnimation,DEFAULT_BATTLE_ANIMATION_TIMING} from '../src/next/ui/battleAnimator.ts';
import type {BattleAnimationHooks,AnimationMotion} from '../src/next/ui/battleAnimator.ts';
import type {BattleState} from '../src/next/core/types.ts';
function harness(motion:AnimationMotion={short:false,lowMotion:false}){
 const trace:unknown[][]=[];let shown:BattleState|undefined;let reads=0;
 const hooks:BattleAnimationHooks={
  motion:()=>{reads++;return motion;},playSound:e=>{trace.push(['sound',e.type]);},describe:e=>{trace.push(['label',e.type]);},observe:e=>{trace.push(['observe',e.type]);},
  highlight:(ids,tone)=>{trace.push(['highlight',[...ids],tone]);},render:s=>{shown=s;trace.push(['render',s.hp.player.current,s.hp.enemy.current,s.gauge,s.boxes.map(b=>b.id)]);},
  drop:e=>{trace.push(['drop',e.box.id]);},react:e=>{trace.push(['react',e.type]);},feedback:f=>{trace.push(['bubble',f.text]);return {remove(){trace.push(['remove']);}};},
  transform:async e=>{trace.push(['transform',e.character]);},complete:(_r,turn)=>{trace.push(['complete',turn]);},
  pause:async ms=>{trace.push(['pause',ms,shown?.hp.player.current,shown?.hp.enemy.current]);},
 };
 return {hooks,trace,get reads(){return reads;}};
}
const corner=()=>{const before=createBattle(readabilityReviewFixture('corner').config);const result=applyAction(before,{type:'drop',candidateId:'ceiling:1:0'});assert(result.accepted);return {before,result};};
test('committed shape damage retains lead-before-HP, hold-after-HP and audio ordering',async()=>{
 const {before,result}=corner(),h=harness(),original=JSON.stringify({before,result});
 await createBattleAnimator(h.hooks)(result.resolution!,before,result.state,new AbortController().signal);
 assert.deepEqual(h.trace.filter(x=>x[0]==='pause'),[['pause',180,30,60],['pause',100,30,60],['pause',500,30,57]]);
 assert.deepEqual(h.trace.slice(0,3).map(x=>x.slice(0,2)),[['sound','drop'],['label','drop'],['observe','drop']]);
 assert(h.trace.find(x=>x[0]==='complete'));assert.equal(h.reads,1);assert.equal(JSON.stringify({before,result}),original);
});
test('lead and hold aborts never finish an action; a shown bubble is still removed',async()=>{
 const {before,result}=corner();
 for(const stop of [100,500]){
  const h=harness(),abort=new AbortController(),pause=h.hooks.pause!;
  h.hooks.pause=async(ms,signal)=>{await pause(ms,signal);if(ms===stop)abort.abort();};
  await createBattleAnimator(h.hooks)(result.resolution!,before,result.state,abort.signal);
  assert(!h.trace.some(x=>x[0]==='complete'));assert.equal(h.trace.some(x=>x[0]==='bubble'),stop===500);assert.equal(h.trace.some(x=>x[0]==='remove'),stop===500);
 }
});
test('short and low-motion use existing budgets; configurable drop time changes presentation only',async()=>{
 const {before,result}=corner();
 for(const motion of [{short:true,lowMotion:false},{short:false,lowMotion:true}]){
  const h=harness(motion);await createBattleAnimator(h.hooks)(result.resolution!,before,result.state,new AbortController().signal);
  assert.deepEqual(h.trace.filter(x=>x[0]==='pause').map(x=>x[1]),motion.short?[15,0,150]:[180,100,500]);
 }
 const h=harness();await createBattleAnimator(h.hooks,{...DEFAULT_BATTLE_ANIMATION_TIMING,dropHoldMs:45})(result.resolution!,before,result.state,new AbortController().signal);
 assert.deepEqual(h.trace.filter(x=>x[0]==='pause').map(x=>x[1]),[45,100,500]);
 assert.equal(result.state.hp.enemy.current,57);
});
test('transformation has exactly one dedicated hook, not a generic event sound',async()=>{
 const before=createBattle(trialFixture('charged','red','marujiro',1,'manual')),r=applyAction(before,{type:'transform'});assert(r.accepted);
 const h=harness();await createBattleAnimator(h.hooks)(r.resolution!,before,r.state,new AbortController().signal);
 assert.deepEqual(h.trace.filter(x=>x[0]==='transform'),[['transform','red']]);assert(!h.trace.some(x=>x[0]==='sound'&&x[1]==='transformation'));
 assert.equal(r.state.gauge,0);assert(h.trace.some(x=>x[0]==='complete'));
});
test('aborted input emits no audio, labels, render or completion',async()=>{
 const {before,result}=corner(),h=harness(),abort=new AbortController();abort.abort();await createBattleAnimator(h.hooks)(result.resolution!,before,result.state,abort.signal);assert.deepEqual(h.trace,[]);
});
test('abortable presentation waits settle immediately on cancellation',async()=>{
 const a=new AbortController();const wait=pauseAnimation(60_000,a.signal);a.abort();await wait;await pauseAnimation(60_000,a.signal);
});

test('intermediate rubble crush never reveals a future drop or duplicates its box during replay',async()=>{
 const {createTrialConfig}=await import('../src/next/config.ts');const base=createTrialConfig('blue','mother-core');
 const before=createBattle({...base,board:{...base.board,width:1,height:3},firstActor:'enemy',initialEnemyTurnCount:5,combatants:{player:{...base.combatants.player,maxHp:1000,initialHp:1000},enemy:{...base.combatants.enemy,maxHp:1000,initialHp:1000}},initialBoxes:[{id:'rubble',row:2,col:0,type:'rubble',owner:'enemy',status:'normal'},{id:'top',row:1,col:0,type:'normal',owner:'enemy',status:'normal'}]});
 const result=applyAction(before,{type:'enemy'});assert(result.accepted);
 const drops=result.resolution!.events.filter(e=>e.type==='drop');assert.equal(drops.length,2);
 const h=harness(),render=h.hooks.render;let seenSecond=false,crushed=false;
 h.hooks.observe=e=>{if(e.type==='drop'&&e.box.id===drops[1]!.box.id)seenSecond=true;if(e.type==='rubble-crushed')crushed=true;};
 h.hooks.render=(state,enemy)=>{const ids=state.boxes.map(b=>b.id);assert.equal(new Set(ids).size,ids.length);if(!seenSecond)assert(!ids.includes(drops[1]!.box.id));if(crushed)assert(!ids.includes('rubble'));if(crushed&&!seenSecond){assert.equal(state.boxes.length,2);assert.equal(state.boxes.find(b=>b.id===drops[0]!.box.id)!.row,1);}render(state,enemy);};
 await createBattleAnimator(h.hooks)(result.resolution!,before,result.state,new AbortController().signal);
 assert(seenSecond&&crushed);assert(h.trace.some(x=>x[0]==='complete'));
});

test('speed changes during an action apply only to the next committed animation',async()=>{
 const {before,result}=corner(),h=harness();let short=false;h.hooks.motion=()=>({short,lowMotion:false});const pause=h.hooks.pause!;h.hooks.pause=async(ms,signal)=>{short=true;await pause(ms,signal);};const animate=createBattleAnimator(h.hooks);
 await animate(result.resolution!,before,result.state,new AbortController().signal);
 assert.deepEqual(h.trace.filter(x=>x[0]==='pause').map(x=>x[1]),[180,100,500]);h.trace.length=0;
 await animate(result.resolution!,before,result.state,new AbortController().signal);
 assert.deepEqual(h.trace.filter(x=>x[0]==='pause').map(x=>x[1]),[15,0,150]);
});

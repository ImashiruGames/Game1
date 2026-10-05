import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {energyReviewFixture} from '../src/next/ui/energyReviewFixture.ts';
import {readabilityReviewFixture} from '../src/next/ui/readabilityReviewFixture.ts';
import {createBattleAnimator} from '../src/next/ui/battleAnimator.ts';
import type {BattleAnimationHooks,AnimationMotion} from '../src/next/ui/battleAnimator.ts';
import {eventFeedbackTiming,feedbackTiming} from '../src/next/ui/battleFeedback.ts';
import {createEnergyLinks} from '../src/next/ui/energyLinks.ts';
import type {BattleEvent,BattleState} from '../src/next/core/types.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import {KineticNode} from './helpers/kineticDom.ts';
const full={short:false,lowMotion:false};
const axes=()=>{const before=createBattle(energyReviewFixture('axes').config),r=applyAction(before,{type:'drop',candidateId:'ceiling:2:0'});assert(r.accepted);return {before,r};};
function harness(motion:AnimationMotion=full){
 let time=0,shown:BattleState;const trace:{t:number;kind:string;hp?:number;event?:BattleEvent}[]=[];
 const record=(kind:string,event?:BattleEvent)=>trace.push({t:time,kind,hp:shown?.hp.enemy.current,event});
 const hooks:BattleAnimationHooks={motion:()=>motion,playSound:e=>record('sound',e),describe:e=>record('describe',e),observe:()=>{},highlight:()=>{},render:s=>{shown=s;record('render');},drop:()=>{},react:e=>record('react',e),energy:e=>record('flight',e),impact:e=>record('impact',e),feedback:()=>{record('feedback');return {remove(){record('remove');}};},transform:async()=>{},complete:()=>record('complete'),pause:async ms=>{record('pause');time+=ms;}};
 return {trace,hooks};
}
test('each axis arrives before its HP number, bar render, hit and label; all 4 axes retain original 600ms budget',async()=>{
 const {before,r}=axes(),frozen=JSON.stringify({before,r}),h=harness();await createBattleAnimator(h.hooks)(r.resolution!,before,r.state,new AbortController().signal);
 const attacks=r.resolution!.events.filter(e=>e.type==='attack');assert.equal(attacks.length,4);
 for(const event of attacks){const flight=h.trace.find(x=>x.kind==='flight'&&x.event===event)!,impact=h.trace.find(x=>x.kind==='impact'&&x.event===event)!,react=h.trace.find(x=>x.kind==='react'&&x.event===event)!,label=h.trace.find(x=>x.kind==='describe'&&x.event===event)!;assert.equal(impact.t-flight.t,300);assert.equal(impact.hp,event.hpBefore);assert.equal(react.hp,event.hpAfter);assert.equal(react.t,impact.t);assert.equal(label.t,impact.t);assert(h.trace.indexOf(impact)<h.trace.indexOf(react));assert.equal(eventFeedbackTiming(event,false).lead+eventFeedbackTiming(event,false).hold,600);}
 assert.equal(JSON.stringify({before,r}),frozen);assert.equal(h.trace.at(-1)?.hp,r.state.hp.enemy.current);
});
test('all staggered particles share one arrival time; impact removes flight before renderer can lower HP',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const {before,r}=axes(),s={...before,boxes:r.state.boxes};dom.root.rect={left:0,top:0,width:390,height:600};for(const b of s.boxes){const cell=dom.cell(b.row,b.col);cell.classList.add(b.owner);cell.dataset.boxId=b.id;}
 const ui=createEnergyLinks(dom.root.asElement()),attack=r.resolution!.events.find(e=>e.type==='attack')!;assert(ui.play(attack,r.resolution!.links,s,new AbortController().signal,full));
 const layer=dom.root.querySelector<KineticNode>('.energy-link-layer')!,sparks=layer.children.filter(n=>n.className==='energy-attack-particle');assert.equal(sparks.length,3);for(const spark of sparks){const timing=spark.animations[0]!.options;assert.equal(Number(timing.delay)+Number(timing.duration),300);}
 ui.impact({...attack});assert.equal(layer.children.filter(n=>n.className==='energy-attack-particle').length,3);ui.impact(attack);assert.equal(layer.dataset.phase,'impact');assert.equal(layer.children.filter(n=>n.className==='energy-attack-particle').length,0);ui.impact(attack);ui.clear();ui.impact(attack);assert.equal(dom.timers.size,0);ui.dispose();
});
test('short and reduced motion synchronize static cue, HP and feedback without flight delay',async()=>{
 for(const motion of [{short:true,lowMotion:false},{short:false,lowMotion:true}]){const {before,r}=axes(),h=harness(motion);await createBattleAnimator(h.hooks)(r.resolution!,before,r.state,new AbortController().signal);for(const e of r.resolution!.events.filter(e=>e.type==='attack')){const f=h.trace.find(x=>x.kind==='flight'&&x.event===e)!,i=h.trace.find(x=>x.kind==='impact'&&x.event===e)!;assert.equal(i.t-f.t,motion.short?0:300);assert.deepEqual(eventFeedbackTiming(e,true),{lead:0,hold:150});}}
});
test('cancelled flight cannot hit, react, complete or replay damage',async()=>{
 const {before,r}=axes(),h=harness(),a=new AbortController();h.hooks.pause=async ms=>{if(ms===300)a.abort();};await createBattleAnimator(h.hooks)(r.resolution!,before,r.state,a.signal);assert(!h.trace.some(x=>x.kind==='complete'||(['impact','react'].includes(x.kind)&&x.event?.type==='attack')));
});
test('shape, healing, reflection and self-cost timings are unchanged and never launch an offensive axis',async()=>{
 for(const kind of ['health','corner','square'] as const){let before=createBattle(readabilityReviewFixture(kind).config);if(kind==='health'){const tr=applyAction(before,{type:'transform'});assert(tr.accepted);before=tr.state;}const r=applyAction(before,{type:'drop',candidateId:kind==='square'?'ceiling:2:0':'ceiling:1:0'});assert(r.accepted);const h=harness();await createBattleAnimator(h.hooks)(r.resolution!,before,r.state,new AbortController().signal);for(const e of r.resolution!.events.filter(e=>e.type==='heal'||e.type==='damage')){assert.deepEqual(eventFeedbackTiming(e,false),feedbackTiming(false));const i=h.trace.find(x=>x.kind==='impact'&&x.event===e)!,react=h.trace.find(x=>x.kind==='react'&&x.event===e)!;assert.equal(i.t,react.t);}}
});
test('enemy attacks share the same impact boundary and lethal attacks show terminal state only after impact',async()=>{
 for(const kind of ['enemy','lethal'] as const){const before=createBattle(energyReviewFixture(kind).config),r=applyAction(before,kind==='enemy'?{type:'enemy'}:{type:'drop',candidateId:'ceiling:2:0'});assert(r.accepted);const event=r.resolution!.events.find(e=>e.type==='attack')!;assert(event&&event.type==='attack');assert.equal(event.actor,kind==='enemy'?'enemy':'player');const h=harness(),states:BattleState[]=[];const render=h.hooks.render;h.hooks.render=s=>{states.push(s);render(s);};await createBattleAnimator(h.hooks)(r.resolution!,before,r.state,new AbortController().signal);const impact=h.trace.find(x=>x.kind==='impact'&&x.event===event)!,react=h.trace.find(x=>x.kind==='react'&&x.event===event)!;assert.equal(impact.t,react.t);if(kind==='lethal'){assert.equal(r.state.result?.winner,'player');assert(states.slice(0,-1).every(s=>s.result===null));assert.equal(states.at(-1)?.result?.winner,'player');assert.equal(r.resolution!.events.filter(e=>e.type==='attack').length,4);}else{assert.equal(r.state.hp.player.current,96);}}
});

import {gaugeDefinition} from '../src/next/core/gauge.ts';
import {tuningOf} from '../src/next/core/tuning.ts';
import test from 'node:test';import assert from 'node:assert/strict';
import {createProfile,freezeRunMeta} from '../src/next/meta/profile.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {createBattle} from '../src/next/core/battle.ts';
import {resolveActiveDrop} from '../src/next/core/activeDrop.ts';
import {completePlayerTurn} from '../src/next/core/transformations.ts';
import {recordedSkillActivations} from '../src/next/core/skillActivationRecord.ts';
import {skillActivationCue,characterSkillTheme,createSkillActivationEffects} from '../src/next/ui/skillActivationEffects.ts';
import {createBattleAnimator} from '../src/next/ui/battleAnimator.ts';
import type {BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';import {KineticNode} from './helpers/kineticDom.ts';
import type {RosterId} from '../src/next/meta/roster.ts';
import type {BattleState,Box,Cell,BattleEvent,NormalSkillId,Link} from '../src/next/core/types.ts';
const box=(row:number,col:number,owner:Box['owner']='player'):Box=>({id:row+':'+col,row,col,owner,type:'normal',status:'normal'});
function state(id:RosterId,boxes:Box[]):BattleState{
 const p=createProfile(1);p.ownedCharacters=['blue','red','mint','amber','violet','silver','rose','imashiru'];
 const config=prepareDeparture(freezeRunMeta(p,id,false),1).config;
 return createBattle({...config,initialBoxes:boxes,board:{width:6,height:8,gravity:'down',terrain:[],invalidCells:[]}});
}
const drop=(s:BattleState,origin:Cell={row:7,col:2})=>resolveActiveDrop(s,{id:'test',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:origin.row,path:[origin]});
function attackCase(id:RosterId){
 const boxes=id==='blue'?[box(5,2),box(6,1),box(6,3),box(7,2)]:id==='mint'?[box(6,1),box(7,1)]:id==='amber'?[box(6,1),box(6,2),box(7,1)]:id==='violet'?[box(7,0),box(7,1),box(7,3),box(7,5,'enemy')]:id==='rose'?[box(7,0),box(7,1)]:[box(5,2),box(6,2)];
 const before=state(id,boxes),step=drop(before,id==='blue'?{row:6,col:2}:{row:7,col:2});
 const event=step.events.find(e=>skillActivationCue(e,step.links,step.state)?.ids.includes(before.build!.fixed.id))!;
 assert(event,id);return {before,step,event};
}
function domScene(dom:ReturnType<typeof boardSkillDom>,s:BattleState){
 dom.root.rect={left:0,top:0,width:390,height:600};
 for(const b of s.boxes){const c=dom.cell(b.row,b.col);c.classList.add(b.owner);c.dataset.boxId=b.id;}
 const icon=new KineticNode();icon.className='hud-skill skill-trigger--'+s.build!.fixed.id;icon.rect={left:80,top:90,width:32,height:32};dom.root.append(icon);
 const gauge=new KineticNode();gauge.id='gauge-text';gauge.rect={left:90,top:65,width:80,height:20};dom.root.append(gauge);
}
const layer=(dom:ReturnType<typeof boardSkillDom>)=>dom.root.querySelector<KineticNode>('.skill-activation-layer');
test('character accents: five attacking/healing fixed skills have correct theme and actual affected cells',()=>{
 for(const id of ['blue','mint','amber','violet','rose'] as const){const f=attackCase(id),cue=skillActivationCue(f.event,f.step.links,f.step.state)!;assert.equal(characterSkillTheme(cue,f.step.state),id);assert(!cue.fire);assert(cue.boxIds.every(id=>f.step.state.boxes.some(b=>b.id===id)));const snapshot=JSON.stringify(f.step.state);skillActivationCue(f.event,f.step.links,f.step.state);assert.equal(JSON.stringify(f.step.state),snapshot);}
 const ruby=attackCase('red'),cue=skillActivationCue(ruby.event,ruby.step.links,ruby.step.state)!;assert(cue.fire);assert.equal(characterSkillTheme(cue,ruby.step.state),null);
});
test('character accents: normal free-slot skills cannot impersonate the fixed identity',()=>{
 const f=attackCase('rose');const other={...f.step.state,build:{...f.step.state.build!,fixed:{...f.step.state.build!.fixed,id:'health' as NormalSkillId}}};
 assert.equal(characterSkillTheme({ids:['horizontal-slash'],boxIds:[],fire:false},other),null);
 assert.equal(skillActivationCue({type:'turn-start',remainingStarts:0,skipped:false},[],f.step.state),null);
});
test('silver: first guard records only the real first damaging enemy link, without changing state or event schema',()=>{
 let s={...state('silver',[box(5,2,'enemy'),box(6,2,'enemy')]),actor:'enemy' as const};
 const first=drop(s),event=first.events.find(e=>e.type==='attack')!;assert(recordedSkillActivations(event).includes('first-guard'));
 const cue=skillActivationCue(event,first.links,first.state)!;assert.equal(cue.anchor,'guard');assert.deepEqual(cue.boxIds,[]);assert.equal(characterSkillTheme(cue,first.state),'silver');assert(!JSON.stringify(event).includes('first-guard'));
 const second=resolveActiveDrop(s,{id:'test',available:true,landing:{row:7,col:2},spawn:{row:0,col:2},edge:{row:0,col:2,side:'top'},segmentEndRow:7,path:[]},true),hit=second.events.find(e=>e.type==='attack')!;
 assert.equal(skillActivationCue(hit,second.links,second.state),null);assert(first.state.hp.player.current>=second.state.hp.player.current);assert.equal(first.state.rngState,s.rngState);
});
test('imashiru: only committed turn charging has an accent; full gauge, other charge sources and nonfixed copies stay silent',()=>{
 const s=state('imashiru',[]),step=completePlayerTurn(s),event=step.events.find(e=>e.type==='gauge')!;assert(recordedSkillActivations(event).includes('charge'));
 assert.equal(skillActivationCue(event,[],step.state)?.anchor,'charge');assert.equal(characterSkillTheme(skillActivationCue(event,[],step.state)!,step.state),'imashiru');
 const capped=completePlayerTurn({...s,gauge:gaugeDefinition(s.config.characterId,tuningOf(s.config))!.cap});assert(!capped.events.some(e=>skillActivationCue(e,[],capped.state)));assert.equal(step.state.rngState,s.rngState);
 const clone=structuredClone(event);assert.equal(skillActivationCue(clone,[],step.state),null);
});
test('character accents: local shapes never launch fire seeds; reduced motion removes ornaments',t=>{
 const dom=boardSkillDom();const ui=createSkillActivationEffects(dom.root.asElement());t.after(()=>{ui.dispose();dom.restore();});
 for(const id of ['blue','mint','amber','violet','rose'] as const){
  const f=attackCase(id);domScene(dom,f.step.state);assert(ui.play(f.event,f.step.links,f.step.state,new AbortController().signal,{short:false,lowMotion:false}));
  assert(layer(dom)!.children.some(n=>n.classList.contains('theme-'+id)));assert(!layer(dom)!.children.some(n=>n.classList.contains('skill-fire-seed')));assert(layer(dom)!.children.some(n=>n.classList.contains('skill-character-accent')));ui.clear();
  const next=attackCase(id);assert(ui.play(next.event,next.step.links,next.step.state,new AbortController().signal,{short:false,lowMotion:true}));assert(!layer(dom)!.children.some(n=>n.classList.contains('skill-character-accent')));ui.clear();
 }
});
test('charge: short independent tail adds no wait and clears on new cue, cancellation, hiding and timeout',t=>{
 const dom=boardSkillDom();const s=state('imashiru',[]);domScene(dom,s);const ui=createSkillActivationEffects(dom.root.asElement());t.after(()=>{ui.dispose();dom.restore();});
 const play=(signal=new AbortController().signal)=>{const step=completePlayerTurn(s),event=step.events.find(e=>e.type==='gauge')!;assert(ui.play(event,[],step.state,signal,{short:false,lowMotion:false}));};
 play();ui.finish();assert(layer(dom));assert.equal(dom.timers.size,1);dom.tick(149);assert(layer(dom));dom.tick(1);assert.equal(layer(dom),null);
 for(let i=0;i<40;i++){play();ui.finish();assert.equal(dom.timers.size,1);}ui.clear();assert.equal(dom.timers.size,0);
 const abort=new AbortController();play(abort.signal);abort.abort();assert.equal(layer(dom),null);
 play();Object.defineProperty(document,'hidden',{value:true,configurable:true});ui.finish();assert.equal(layer(dom),null);Object.defineProperty(document,'hidden',{value:false,configurable:true});
});
test('passive cues: animator renders confirmed charge without inserting a pause or altering HP/gauge',async()=>{
 const before=state('imashiru',[]),step=completePlayerTurn(before),resolution={actor:'player' as const,originBoxId:null,links:[] as Link[],events:step.events,enemyPlannedAction:null};
 const run=async(on:boolean)=>{const waits:number[]=[],states:BattleState[]=[],cues:BattleEvent[]=[];const hooks:BattleAnimationHooks={motion:()=>({short:false,lowMotion:false}),playSound(){},describe(){},observe(){},highlight(){},render:s=>{states.push(s);},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete(){},pause:async ms=>{waits.push(ms);}};
  if(on)hooks.skillActivation=(e,l,s)=>{if(skillActivationCue(e,l,s))cues.push(e);};await createBattleAnimator(hooks)(resolution,before,step.state,new AbortController().signal);return {waits,states,cues};};
 const a=await run(false),b=await run(true);assert.deepEqual(a.waits,b.waits);assert.deepEqual(a.states,b.states);assert.equal(b.cues.length,1);assert.deepEqual(b.waits,[]);
});

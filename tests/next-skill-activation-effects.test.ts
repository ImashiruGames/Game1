import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultConfig} from '../src/next/core/definitions.ts';
import {createBattle} from '../src/next/core/battle.ts';
import {resolveActiveDrop} from '../src/next/core/activeDrop.ts';
import {createSkill} from '../src/next/core/playerBuild.ts';
import {normalLinkBonus,trophyLinkBonus} from '../src/next/core/normalSkillEffects.ts';
import {recordedSkillActivations} from '../src/next/core/skillActivationRecord.ts';
import {skillActivationCue,createSkillActivationEffects} from '../src/next/ui/skillActivationEffects.ts';
import {createBattleAnimator} from '../src/next/ui/battleAnimator.ts';
import type {BattleAnimationHooks} from '../src/next/ui/battleAnimator.ts';
import {createEnergyLinks} from '../src/next/ui/energyLinks.ts';
import type {AnimationMotion} from '../src/next/ui/animationTimeline.ts';
import {captureAnimationMotion} from '../src/next/ui/animationTimeline.ts';
import {skillHudHtml} from '../src/next/ui/skillHud.ts';
import {createTuning} from '../src/next/core/tuning.ts';
import {boardSkillDom} from './helpers/boardSkillDom.ts';
import {KineticNode} from './helpers/kineticDom.ts';
import type {BattleState,Box,Cell,NormalSkillId,Link,BattleEvent} from '../src/next/core/types.ts';
const full={short:false,lowMotion:false};
const box=(row:number,col:number,owner:Box['owner']='player',type:Box['type']='normal'):Box=>({id:row+':'+col,row,col,owner,type,status:'normal'});
function state(ids:NormalSkillId[]=['grow-fire'],rank:1|2=1,boxes:Box[]=[box(5,2),box(6,2)]):BattleState{
 const s=createBattle({...defaultConfig,tuning:{...createTuning(),skillRevision:2}});
 return {...s,boxes,build:{fixed:createSkill(ids[0]!,rank),slots:[ids[1]?createSkill(ids[1],rank):null,ids[2]?createSkill(ids[2],rank):null],power:{3:0,4:0,5:0}}};
}
const drop=(s:BattleState,origin:Cell={row:7,col:2})=>resolveActiveDrop(s,{id:'test',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:origin.row,path:[origin]});
function fixture(ids:NormalSkillId[]=['grow-fire'],rank:1|2=1){const before=state(ids,rank),step=drop(before),event=step.events.find(e=>e.type==='attack')!;return {before,step,event};}
function scene(dom:ReturnType<typeof boardSkillDom>,s:BattleState,ids:NormalSkillId[]=['grow-fire']){
 dom.root.rect={left:0,top:0,width:390,height:600};
 for(const c of dom.cells){c.className='cell';delete c.dataset.boxId;}
 for(const b of s.boxes){const c=dom.cell(b.row,b.col);c.classList.add(b.owner);c.dataset.boxId=b.id;}
 const icons=ids.map((id,i)=>{const n=new KineticNode();n.className='hud-skill skill-trigger--'+id;n.rect={left:60+i*40,top:85,width:32,height:32};dom.root.append(n);return n;});
 return icons;
}
const layer=(dom:ReturnType<typeof boardSkillDom>)=>dom.root.querySelector<KineticNode>('.skill-activation-layer');
const nodes=(dom:ReturnType<typeof boardSkillDom>,cls:string)=>layer(dom)?.children.filter(n=>n.classList.contains(cls))??[];
test('activation: actual vertical grow fire and plus link exact boxes; horizontal/equipped-only/enemy stay silent',()=>{
 for(const rank of [1,2] as const){
  const {before,step,event}=fixture(['grow-fire'],rank),cue=skillActivationCue(event,step.links,step.state)!;
  assert.deepEqual(cue.ids,['grow-fire']);assert(cue.fire);assert.deepEqual(cue.boxIds,step.links.find(l=>l.axis==='vertical')!.boxIds);
  assert.equal(step.state.rngState,before.rngState);assert.equal(step.state.turn,before.turn);
  assert.match(skillHudHtml(before,true),/skill-trigger--grow-fire/);if(rank===2)assert.match(skillHudHtml(before,true),/skill-rank/);
  const sideways=drop(state(['grow-fire'],rank,[box(7,0),box(7,1)]));
  assert.equal(skillActivationCue(sideways.events.find(e=>e.type==='attack')!,sideways.links,sideways.state),null);
  assert.equal(skillActivationCue(step.events[0]!,step.links,step.state),null);
  assert.equal(skillActivationCue({...event,actor:'enemy'} as BattleEvent,step.links,step.state),null);
 }
});
test('activation: all four axes associate independently and simultaneous bonuses survive a primary skill ID',()=>{
 const s=state(['grow-fire','diagonal-shot','crossfire'],1,[box(5,0),box(5,1),box(6,2),box(7,2),box(6,3),box(7,4),box(6,1),box(7,0)]);
 const r=drop(s,{row:5,col:2}),hits=r.events.filter(e=>e.type==='attack');assert.equal(hits.length,4);
 for(const hit of hits){const cue=skillActivationCue(hit,r.links,r.state)!;assert(cue.ids.includes('crossfire'));assert.equal(cue.fire,hit.axis==='vertical');assert.equal(cue.ids.includes('diagonal-shot'),hit.axis.startsWith('diagonal'));assert.deepEqual(new Set(cue.boxIds),new Set(r.links.find(l=>l.axis===hit.axis)!.boxIds));}
 const mixed=fixture(['grow-fire','full-power','foundation']);assert.deepEqual(new Set(recordedSkillActivations(mixed.event)),new Set(['grow-fire','full-power','foundation']));
});
test('activation: metadata never changes serialized event/state or survives save-style cloning',()=>{
 const {before,step,event}=fixture(['grow-fire','full-power']),raw=JSON.stringify(event);
 assert(recordedSkillActivations(event).length===2);assert.deepEqual(recordedSkillActivations(structuredClone(event)),[]);
 assert(!raw.includes('full-power'));assert(!JSON.stringify(step.state).includes('activations'));assert.equal(JSON.stringify(event),raw);assert.equal(before.link3Growth,0);
});
test('activation: conditional bonus recording stays silent at false conditions and keeps exact numeric result',()=>{
 const cases:{id:NormalSkillId;boxes:Box[];count?:number;links?:Link[]}[]=[
  {id:'siege',boxes:[box(7,0),box(7,1),box(7,2),box(6,2,'enemy')]},
  {id:'snake-line',boxes:Array.from({length:5},(_,i)=>box(7,i)),count:5},
  {id:'edge-strike',boxes:[box(7,0),box(7,1),box(7,2)]},
  {id:'clear-column',boxes:[box(5,2),box(6,2),box(7,2)]},
  {id:'pincer-strike',boxes:[box(7,1),box(7,2),box(6,2,'enemy'),box(5,2)]},
  {id:'square-conduit',boxes:[box(7,1),box(7,2),box(6,1),box(6,2)]},
  {id:'venom-edge',boxes:[box(7,1),box(7,2),box(6,2,'enemy','poison')]},
  {id:'frost-edge',boxes:[box(7,1),box(7,2),box(6,2,'enemy','frozen')]},
  {id:'exact-four',boxes:[box(7,1),box(7,2)],count:4},
  {id:'shiny-relay',boxes:[box(7,1,'player','shiny'),box(7,2,'player','shiny')]},
  {id:'heavy-swing',boxes:[box(7,1),box(7,2)],count:5},
 ];
 for(const c of cases){
  const s=state([c.id],1,c.boxes),l:Link={axis:'horizontal',count:c.count??3,tier:3,boxIds:c.boxes.filter(b=>b.owner==='player').map(b=>b.id)},origin=c.boxes.find(b=>b.row===7&&b.col===2)!;
  const ids:NormalSkillId[]=[],before=structuredClone(s),amount=normalLinkBonus(s,origin,l,[l],id=>ids.push(id));
  assert.equal(amount,normalLinkBonus(s,origin,l,[l]));assert.deepEqual(s,before);assert(ids.includes(c.id),c.id);
 }
 const s=state(['siege'],1,[box(4,1),box(4,2),box(4,3)]),l:Link={axis:'horizontal',count:3,tier:3,boxIds:s.boxes.map(b=>b.id)},ids:NormalSkillId[]=[];
 normalLinkBonus(s,s.boxes[2]!,l,[l],id=>ids.push(id));
 trophyLinkBonus(state(['heavy-swing']),s.boxes[2]!,{...l,tier:null},[l],id=>ids.push(id));assert.deepEqual(ids,[]);
});
test('activation: actual shape hits/heals and X boost glow, reflection and combo reward do not duplicate',()=>{
 const corner=drop(state(['corner-strike'],1,[box(6,1),box(7,1)]),{row:7,col:2}),event=corner.events.find(e=>e.type==='damage'&&e.source==='corner-strike')!;
 assert(event);assert.deepEqual(skillActivationCue(event,corner.links,corner.state)?.ids,['corner-strike']);
 const health=drop(state(['health'],1,[box(6,1),box(6,3),box(5,2),box(7,2)]),{row:6,col:2}),heal=health.events.find(e=>e.type==='heal')!;
 assert.deepEqual(skillActivationCue(heal,health.links,health.state)?.ids,['health']);
 const cross=drop(state(['cross-strike'],1,[box(3,1),box(3,3),box(5,1),box(5,3)]),{row:4,col:2}),boost=cross.events.find(e=>e.type==='power-boost')!;
 assert(boost);assert.deepEqual(skillActivationCue(boost,cross.links,cross.state)?.ids,['cross-strike']);
 assert.equal(skillActivationCue({type:'power-boost',source:'combo-unit',tier:4,amount:1,boxIds:[]},[],corner.state),null);
 if(event.type==='damage')assert.equal(skillActivationCue({...event,source:'blue-transformation'},corner.links,corner.state),null);
});
test('activation: grow fire overlay links real HUD to exact cells; simultaneous other icons have no projectiles',t=>{
 const dom=boardSkillDom();const f=fixture(['grow-fire','full-power']);scene(dom,f.step.state,['grow-fire','full-power']);
 const ui=createSkillActivationEffects(dom.root.asElement());t.after(()=>{ui.dispose();dom.restore();});
 assert(ui.play(f.event,f.step.links,f.step.state,new AbortController().signal,full));assert.equal(nodes(dom,'skill-activation-icon').length,2);assert.equal(nodes(dom,'skill-fire-seed').length,6);assert.equal(nodes(dom,'skill-activation-box').length,3);assert.equal(layer(dom)!.getAttribute('aria-hidden'),'true');
 assert.equal(nodes(dom,'skill-fire-seed')[0]!.animations[0]!.options.duration,60);
 dom.tick(599);assert(layer(dom));dom.tick(1);assert.equal(layer(dom),null);assert.equal(dom.timers.size,0);
 const other=fixture(['full-power']);scene(dom,other.step.state,['full-power']);assert(ui.play(other.event,other.step.links,other.step.state,new AbortController().signal,full));assert.equal(nodes(dom,'skill-fire-seed').length,0);assert.equal(nodes(dom,'skill-activation-box').length,0);
});
test('activation: repeat event deduplicates, new consecutive event replaces, stale timeout and abort cannot clear new cue',t=>{
 const dom=boardSkillDom();const f=fixture();scene(dom,f.step.state);const ui=createSkillActivationEffects(dom.root.asElement());t.after(()=>{ui.dispose();dom.restore();});const old=new AbortController();
 assert(ui.play(f.event,f.step.links,f.step.state,old.signal,full));assert(!ui.play(f.event,f.step.links,f.step.state,old.signal,full));const stale=[...dom.timers.values()][0]!.fn;
 for(let i=0;i<30;i++){const next=fixture();assert(ui.play(next.event,next.step.links,next.step.state,new AbortController().signal,full));assert.equal(dom.timers.size,1);assert.equal(dom.root.children.filter(n=>n.className.startsWith('skill-activation-layer')).length,1);}
 const current=layer(dom);old.abort();stale();assert.equal(layer(dom),current);ui.clear();assert.equal(dom.timers.size,0);
});
test('activation: identical rerender stays aligned; changed boxes or geometry clear immediately',t=>{
 const dom=boardSkillDom();const f=fixture();const icons=scene(dom,f.step.state),ui=createSkillActivationEffects(dom.root.asElement());t.after(()=>{ui.dispose();dom.restore();});
 ui.play(f.event,f.step.links,f.step.state,new AbortController().signal,full);const first=layer(dom);dom.rerender();ui.refresh();assert.equal(layer(dom),first);
 const node=dom.board.querySelector<KineticNode>('[data-cell-row="5"][data-cell-col="2"]')!;node.dataset.boxId='new';ui.refresh();assert.equal(layer(dom),null);
 node.dataset.boxId='5:2';const next=fixture();ui.play(next.event,next.step.links,next.step.state,new AbortController().signal,full);icons[0]!.rect.left++;ui.refresh();assert.equal(layer(dom),null);
});
test('activation: absent icon falls back to boxes; missing one cell never invents a target or blocks play',t=>{
 const dom=boardSkillDom();const f=fixture();scene(dom,f.step.state,[]);const ui=createSkillActivationEffects(dom.root.asElement());t.after(()=>{ui.dispose();dom.restore();});
 assert(ui.play(f.event,f.step.links,f.step.state,new AbortController().signal,full));assert.equal(nodes(dom,'skill-fire-seed').length,0);assert.equal(nodes(dom,'skill-activation-box').length,3);
 dom.cell(5,2).dataset.boxId='wrong';const next=fixture();ui.play(next.event,next.step.links,next.step.state,new AbortController().signal,full);assert.equal(nodes(dom,'skill-activation-box').length,2);
 for(const b of f.step.state.boxes)dom.cell(b.row,b.col).remove();const missing=fixture();assert(!ui.play(missing.event,missing.step.links,missing.step.state,new AbortController().signal,full));assert.equal(dom.timers.size,0);
});
test('activation: fast/low/system reduction and unavailable WAAPI remain static without flying sparks',t=>{
 const dom=boardSkillDom();const f=fixture();scene(dom,f.step.state);const ui=createSkillActivationEffects(dom.root.asElement());t.after(()=>{ui.dispose();dom.restore();});
 for(const motion of [{short:true,lowMotion:false},{short:false,lowMotion:true},full]){
  if(motion===full)dom.systemMotion(true);const next=fixture();assert(ui.play(next.event,next.step.links,next.step.state,new AbortController().signal,motion));assert.equal(nodes(dom,'skill-fire-seed').length,0);assert(layer(dom)!.children.every(n=>!n.animations.length));ui.clear();
 }
 dom.systemMotion(false);dom.omitWAAPI();const no=fixture();assert(ui.play(no.event,no.step.links,no.step.state,new AbortController().signal,full));assert.equal(nodes(dom,'skill-fire-seed').length,0);
});
test('activation: abort, resize, scroll, background, navigation, settings and disposal leave no timers',t=>{
 const dom=boardSkillDom();t.after(()=>dom.restore());const f=fixture();scene(dom,f.step.state);const ui=createSkillActivationEffects(dom.root.asElement());
 const play=(signal=new AbortController().signal)=>{const next=fixture();assert(ui.play(next.event,next.step.links,next.step.state,signal,full));};
 for(const name of ['resize','scroll','pagehide']){play();dom.fire(name);assert.equal(layer(dom),null);assert.equal(dom.timers.size,0);}
 play();dom.settings({short:false,lowMotion:true});assert.equal(layer(dom),null);dom.body.dataset.reducedMotion='false';
 const a=new AbortController();play(a.signal);a.abort();assert.equal(dom.timers.size,0);
 play();Object.defineProperty(document,'hidden',{value:true,configurable:true});ui.refresh();assert.equal(layer(dom),null);assert(!ui.play(f.event,f.step.links,f.step.state,new AbortController().signal,full));Object.defineProperty(document,'hidden',{value:false,configurable:true});
 play();ui.dispose();assert.equal(dom.timers.size,0);assert.equal(dom.listenerCount('resize'),0);assert(!ui.play(f.event,f.step.links,f.step.state,new AbortController().signal,full));
});
test('activation: unsupported animation errors and invalid committed geometry fail safely',t=>{
 const dom=boardSkillDom();const f=fixture();scene(dom,f.step.state);dom.failNewAnimations();const ui=createSkillActivationEffects(dom.root.asElement());t.after(()=>{ui.dispose();dom.restore();});
 assert(ui.play(f.event,f.step.links,f.step.state,new AbortController().signal,full));assert.equal(nodes(dom,'skill-fire-seed').length,0);ui.clear();
 const next=fixture();assert.equal(skillActivationCue(next.event,[],next.step.state),null);assert.equal(skillActivationCue(next.event,next.step.links,{...next.step.state,boxes:[]}),null);
 assert.equal(skillActivationCue(next.event,next.step.links,{...next.step.state,boxes:next.step.state.boxes.map(b=>({...b,owner:'enemy'}))}),null);
});
test('activation: animator hook adds no waits, damage renders or timing changes, including failures and abort',async()=>{
 const f=fixture(['grow-fire','full-power']),resolution={actor:'player' as const,originBoxId:f.step.originBoxId,links:f.step.links,events:f.step.events,enemyPlannedAction:null};
 const run=async(mode:'none'|'cue'|'throw',motion:AnimationMotion=full)=>{
  const trace:unknown[]=[],cues:string[][]=[];const hooks:BattleAnimationHooks={motion:()=>motion,playSound(){},describe(){},observe(){},highlight(){},render:s=>{trace.push(['hp',s.hp]);},drop(){},react(){},feedback:()=>({remove(){}}),transform:async()=>{},complete(){},pause:async ms=>{trace.push(['pause',ms]);}};
  if(mode!=='none')hooks.skillActivation=(event,links,s)=>{if(mode==='throw')throw Error('cosmetic failure');const c=skillActivationCue(event,links,s);if(c)cues.push([...c.ids]);};
  await createBattleAnimator(hooks)(resolution,f.before,f.step.state,new AbortController().signal);return {trace,cues};
 };
 for(const speed of ['medium','slow','fast'] as const)for(const lowMotion of [false,true]){const motion=captureAnimationMotion({speed,short:false,lowMotion});const a=await run('none',motion),b=await run('cue',motion),c=await run('throw',motion);assert.deepEqual(b.trace,a.trace);assert.deepEqual(c.trace,a.trace);assert(b.cues.some(ids=>ids.includes('grow-fire')));}
 const profile=captureAnimationMotion({speed:'slow',short:false,lowMotion:false}).timeline!;assert.deepEqual(profile.attack,{lead:450,hold:450});
});
test('activation: overlay CSS cannot intercept input or paint box cores; production lifecycle integrates cleanup',()=>{
 const css=readFileSync(new URL('../src/next/ui/skillActivationEffects.css',import.meta.url),'utf8');
 assert.match(css,/pointer-events:none!important/);assert.match(css,/background:transparent/);assert.match(css,/prefers-reduced-motion/);
 const main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8');assert.match(main,/skillActivationEffects\.refresh\(\)/);assert.match(main,/function showHome\(\):void\{[^\n]*skillActivationEffects\.clear\(\)/);assert.match(main,/skillActivation:\(event,links,state,signal,motion\)/);
});

// Compare actual WAAPI schedules from both production renderers, never a duplicate timing formula.
const relayModes:{name:string;motion:AnimationMotion;reduced?:'system'|'body'|'control';still:boolean}[]=[
 {name:'normal',motion:{speed:'medium',short:false,lowMotion:false},still:false},
 {name:'slow',motion:{speed:'slow',short:false,lowMotion:false},still:false},
 {name:'fast',motion:{speed:'fast',short:false,lowMotion:false},still:true},
 {name:'legacy short',motion:{short:true,lowMotion:false},still:true},
 {name:'low motion normal',motion:{speed:'medium',short:false,lowMotion:true},still:true},
 {name:'low motion slow',motion:{speed:'slow',short:false,lowMotion:true},still:true},
 {name:'system reduced',motion:full,reduced:'system',still:true},
 {name:'body reduced',motion:full,reduced:'body',still:true},
 {name:'control reduced',motion:full,reduced:'control',still:true},
];
for(const mode of relayModes)test('relay ordering: '+mode.name+' preserves attack timing across consecutive multi-axis events',t=>{
 const dom=boardSkillDom(),motion=captureAnimationMotion(mode.motion),ui=createSkillActivationEffects(dom.root.asElement()),energy=createEnergyLinks(dom.root.asElement());
 t.after(()=>{ui.dispose();energy.dispose();dom.restore();});
 if(mode.reduced==='system')dom.systemMotion(true);
 if(mode.reduced==='body')dom.body.dataset.reducedMotion='true';
 // A captured timeline already contains the user's short setting. Low-motion control is also read live by the skill renderer.
 if(mode.reduced==='control'){const checkbox=new KineticNode();checkbox.id='reduce';Object.assign(checkbox,{checked:true});dom.root.append(checkbox);}
 for(let repeat=0;repeat<2;repeat++){
  const before=state(['grow-fire','diagonal-shot','crossfire'],1,[box(5,0),box(5,1),box(6,2),box(7,2),box(6,3),box(7,4),box(6,1),box(7,0)]),step=drop(before,{row:5,col:2});
  const snapshot=JSON.stringify(step),profile=JSON.stringify(motion);
  scene(dom,step.state,['grow-fire','diagonal-shot','crossfire']);
  const hits=step.events.filter(e=>e.type==='attack');assert.equal(hits.length,4);
  for(const hit of hits){
   // Establish the unchanged attack schedule first using the same event.
   const baseline=createEnergyLinks(dom.root.asElement());assert(baseline.play(hit,step.links,step.state,new AbortController().signal,motion));
   const scheduled=()=>dom.root.querySelector<KineticNode>('.energy-link-layer')!.children.filter(n=>n.classList.contains('energy-attack-particle')).map(n=>n.animations[0]!.options);
   const original=structuredClone(scheduled());baseline.dispose();
   assert(ui.play(hit,step.links,step.state,new AbortController().signal,motion));
   assert(energy.play(hit,step.links,step.state,new AbortController().signal,motion));
   const attacks=scheduled();assert.deepEqual(attacks,original);
   const seeds=nodes(dom,'skill-fire-seed'),rims=nodes(dom,'skill-activation-box');
   if(hit.axis==='vertical'&&!mode.still){
    assert.equal(seeds.length,hit.linkCount*2);assert.equal(rims.length,hit.linkCount);
    assert.equal(attacks.length,hit.linkCount);
    const firstLaunch=Math.min(...attacks.map(a=>Number(a.delay)));
    const arrival=Math.max(...seeds.map(n=>Number(n.animations[0]!.options.delay)+Number(n.animations[0]!.options.duration)));
    for(const rim of rims){const a=rim.animations[0]!,peak=a.frames.find(frame=>frame.opacity===1)!;const ignition=Number(a.options.delay)+Number(a.options.duration)*Number(peak.offset);assert(arrival<=ignition);assert(ignition<firstLaunch,mode.name+' ignition must finish before any attack launches');}
    for(const a of attacks)assert.equal(Number(a.delay)+Number(a.duration),motion.timeline!.attack.lead);
   }else{assert.equal(seeds.length,0);if(mode.still)assert(layer(dom)!.children.every(n=>!n.animations.length));}
   assert.equal(JSON.stringify(step),snapshot);assert.equal(JSON.stringify(motion),profile);
   ui.clear();energy.clear();assert.equal(dom.timers.size,0);
  }
 }
});

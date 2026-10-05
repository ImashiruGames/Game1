import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultConfig} from '../src/next/core/definitions.ts';
import {createBattle,applyAction} from '../src/next/core/index.ts';
import {createSkill,acquireSkill,canReceiveSkillReward,validatePlayerBuild} from '../src/next/core/playerBuild.ts';
import {skillCatalog,skillValue,trophySkillIds,characterTrophySkillIds} from '../src/next/core/skillCatalog.ts';
import {trophyLinkBonus} from '../src/next/core/normalSkillEffects.ts';
import {resolveActiveDrop} from '../src/next/core/activeDrop.ts';
import {matchShape,rescueKitPattern,shapeOrientations} from '../src/next/core/shapePatterns.ts';
import {createTuning,validateTuning} from '../src/next/core/tuning.ts';
import {rewardPool,generateCategoryOffer,applyRunReward} from '../src/next/app/rewards.ts';
import {shapeFeedbackForEvent,shapeFeedbackHtml} from '../src/next/ui/shapeFeedback.ts';
import {actionBreakdown} from '../src/next/ui/battleReadability.ts';
import {rewardCardView} from '../src/next/ui/rewardPresentation.ts';
import type {Box,BattleState,NormalSkillId,Link,Cell} from '../src/next/core/types.ts';
const box=(row:number,col:number,owner:Box['owner']='player',type:Box['type']='normal'):Box=>({id:`${row}:${col}`,row,col,owner,type,status:'normal'});
const cells=[box(4,1),box(4,2),box(4,3)];
function state(id:NormalSkillId,rank:1|2=1,boxes:Box[]=cells):BattleState {return {...createBattle({...defaultConfig,characterId:'blue',initialBuild:{fixed:createSkill('health'),slots:[createSkill(id,rank),null],power:{3:0,4:0,5:0}}}),boxes};}
const link=(boxes:Box[]=cells,count=3,axis:Link['axis']='horizontal'):Link=>({axis,count,tier:count>=5?5:count===4?4:3,boxIds:boxes.map(b=>b.id)});
const drop=(s:BattleState,origin:Cell)=>resolveActiveDrop(s,{id:'test',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:origin.row,path:[origin]});

test('ten trophy identities are gated, rescue is rank1 only, old tuning remains valid',()=>{
 assert.equal(trophySkillIds.length,10);assert.equal(new Set(Object.values(characterTrophySkillIds)).size,8);
 for(const id of trophySkillIds)assert.equal(skillCatalog[id].rewardAccess,'trophy');
 const build=state('rescue-kit').build!;assert(!canReceiveSkillReward(build,'rescue-kit'));assert.equal(acquireSkill(build,'rescue-kit'),null);
 assert.throws(()=>validatePlayerBuild({...build,slots:[createSkill('rescue-kit',2),null]},state('rescue-kit').config));
 assert.equal(rewardCardView(state('rescue-kit'),'rescue-kit').upgrade,false);
 assert(!rewardCardView(state('rescue-kit'),'rescue-kit').title.includes('＋'));
 for(const id of trophySkillIds)assert(!rewardPool(state('charge').build!).includes(id));
 const granted=generateCategoryOffer(state('charge').build!,55,'owned','skills',undefined,['rescue-kit','heavy-swing']);assert.deepEqual(new Set(granted.offer.choices),new Set(['rescue-kit','heavy-swing']));
 const exhausted=generateCategoryOffer(build,55,'owned','skills',undefined,['rescue-kit']);assert.deepEqual(exhausted.offer.choices,[]);assert.equal(exhausted.rngState,55);
 const won={...state('charge'),result:{winner:'player' as const,reason:'hp-zero' as const}};assert.equal(applyRunReward(won,'heavy-swing'),null);
 const tuning=structuredClone(createTuning());for(const id of trophySkillIds)delete (tuning.skills as Record<string,unknown>)[id];validateTuning(tuning);assert.equal(skillValue('heavy-swing',1,tuning),50);
});

test('heavy swing adds half/full current five power with floor, including 6+, never multiplies whole hit',()=>{
 for(const rank of [1,2] as const)for(const count of [3,4,5,6,7]){
  let s=state('heavy-swing',rank);s={...s,build:{...s.build!,power:{3:0,4:0,5:3}}};const l=link(cells,count);
  const power=s.config.combatants.player.attacks[5]+3;
  assert.equal(trophyLinkBonus(s,cells[2]!,l,[l]),count>=5?Math.floor(power*(rank===1?.5:1)):0);
 }
 const initial=state('heavy-swing',1,[box(7,0),box(7,1),box(7,2),box(7,3)]);
 const s={...initial,build:{...initial.build!,power:{3:0,4:0,5:3}}};const r=drop(s,{row:7,col:4});
 const hit=r.events.find(e=>e.type==='attack');assert(hit?.type==='attack');const p=s.config.combatants.player.attacks[5]+3;assert.equal(hit.damage,p+Math.floor(p/2));assert.equal(r.state.rngState,s.rngState);
});

test('all eight character rewards: representative board condition positive, negative, rank delta, nonstacking',()=>{
 const origin=cells[2]!, l=link();
 const cases:{id:NormalSkillId;boxes:Box[];ln?:Link;links?:Link[]}[]=[
  {id:'clear-column',boxes:[...cells,box(5,3),box(6,3)]},
  {id:'pincer-strike',boxes:[...cells,box(5,3,'enemy'),box(6,3)]},
  {id:'twin-diagonal',boxes:cells,links:[l,link(cells,3,'diagonal-down'),link(cells,3,'diagonal-up')]},
  {id:'square-conduit',boxes:[...cells,box(5,1),box(5,2)]},
  {id:'venom-edge',boxes:[...cells,box(5,3,'enemy','poison'),box(3,3,'enemy','deadly-poison')]},
  {id:'frost-edge',boxes:[...cells,box(5,3,'enemy','frozen'),box(3,3,'enemy','absolute-zero')]},
  {id:'exact-four',boxes:cells,ln:link(cells,4)},
  {id:'shiny-relay',boxes:cells.map((b,i)=>({...b,type:i<2?'shiny':'normal'}))},
 ];
 for(const c of cases)for(const rank of [1,2] as const){const s=state(c.id,rank,c.boxes);const ln=c.ln??l;assert.equal(trophyLinkBonus(s,origin,ln,c.links??[ln]),skillValue(c.id,rank),`${c.id} rank${rank}`);assert.equal(trophyLinkBonus(state(c.id,rank),origin,l,[l]),0,`${c.id} negative`);assert.equal(trophyLinkBonus(s,origin,{...ln,tier:null},c.links??[ln]),0);}
 // Enemy/neutral obstruction breaks all-own column; diagonal adjacency cannot satisfy orthogonal conditions.
 for(const owner of ['enemy','neutral'] as const){const s=state('clear-column',1,[...cells,box(5,3),box(6,3,owner)]);assert.equal(trophyLinkBonus(s,origin,l,[l]),0);}
 for(const id of ['venom-edge','frost-edge'] as const){const type=id==='venom-edge'?'poison':'frozen';assert.equal(trophyLinkBonus(state(id,1,[...cells,box(5,4,'enemy',type)]),origin,l,[l]),0);assert.equal(trophyLinkBonus(state(id,1,[...cells,box(5,3,'player',type)]),origin,l,[l]),0);}
 const unrelated=[...cells,box(6,5),box(6,6),box(7,5),box(7,6)];assert.equal(trophyLinkBonus(state('square-conduit',1,unrelated),origin,l,[l]),0);
 assert.equal(trophyLinkBonus(state('shiny-relay',1,[...cells,box(6,5,'player','shiny'),box(6,6,'player','shiny')]),origin,l,[l]),0);
});

test('rescue fixed geometry accepts any top centre, requires five own boxes and active origin, fires once',()=>{
 const parts=rescueKitPattern.cells.map(c=>box(c.row+5,c.col+1));
 assert.equal(shapeOrientations(rescueKitPattern).length,1);
 for(const wildcard of [undefined,box(5,2,'enemy'),box(5,2),box(5,2,'neutral'),box(5,2,'enemy','thorn')]){
  const boxes=[...parts,...(wildcard?[wildcard]:[])];assert.equal(matchShape(defaultConfig.board,boxes,parts[0]!.id,rescueKitPattern).length,1);
  if(wildcard)assert.equal(matchShape(defaultConfig.board,boxes,wildcard.id,rescueKitPattern).length,0,'wildcard is not an active required cell');
 }
 for(let missing=0;missing<parts.length;missing++)assert.equal(matchShape(defaultConfig.board,parts.filter((_,i)=>i!==missing),parts[(missing+1)%parts.length]!.id,rescueKitPattern).length,0);
 const inverted=parts.map(b=>({...b,row:11-b.row}));assert.equal(matchShape(defaultConfig.board,inverted,inverted[0]!.id,rescueKitPattern).length,0);
 const others=parts.slice(0,-1);let s=state('rescue-kit',1,others);s={...s,hp:{...s.hp,player:{current:10,max:30}}};const r=drop(s,parts.at(-1)!);const heals=r.events.filter(e=>e.type==='heal'&&e.source==='rescue-kit');assert.equal(heals.length,1);assert(heals[0]?.type==='heal');assert.equal(heals[0].requestedAmount,10);assert.equal(r.state.hp.player.current,20);assert.equal(r.state.rngState,s.rngState);
 const capped=drop({...s,hp:{...s.hp,player:{current:27,max:30}},transformation:{character:'blue',scope:'stage'}},parts.at(-1)!);const heal=capped.events.find(e=>e.type==='heal'&&e.source==='rescue-kit');assert(heal?.type==='heal');assert.equal(heal.amount,3);assert.equal(capped.events.find(e=>e.type==='damage'&&e.source==='blue-transformation')?.type,'damage');
 const shiny=drop({...s,boxes:others.map(b=>({...b,type:'shiny' as const}))},parts.at(-1)!);const doubled=shiny.events.find(e=>e.type==='heal'&&e.source==='rescue-kit');assert(doubled?.type==='heal');assert.equal(doubled.requestedAmount,20);
 assert.equal(drop({...s,actor:'enemy'},parts.at(-1)!).events.filter(e=>e.type==='heal').length,0);
});


test('rescue legal top-corner insertion heals once and has no passive retrigger',()=>{
 const ground=[box(7,0),box(7,1),box(7,2),box(6,2)];
 const s={...state('rescue-kit',1,ground),hp:{player:{current:10,max:30},enemy:{current:100,max:100}}};
 const active=applyAction(s,{type:'drop',candidateId:'ceiling:0:0'});assert(active.accepted);
 const heals=active.resolution!.events.filter(e=>e.type==='heal'&&e.source==='rescue-kit');assert.equal(heals.length,1);
 assert.equal(active.state.hp.player.current,20);
 const passive=applyAction(active.state,{type:'enemy'});assert(passive.accepted);assert.equal(passive.resolution?.events.filter(e=>e.type==='heal'&&e.source==='rescue-kit').length??0,0);
});


test('rescue activation feedback renders exact fixed 2×3 occupied cells and a Japanese heal label',()=>{
 const boxes=rescueKitPattern.cells.map(c=>box(c.row+5,c.col+1));
 const event={type:'heal' as const,actor:'player' as const,target:'player' as const,source:'rescue-kit' as const,amount:3,requestedAmount:10,hpBefore:27,hpAfter:30,shapeBoxIds:boxes.map(b=>b.id)};
 const feedback=shapeFeedbackForEvent(event,boxes);assert(feedback);assert.equal(feedback.rows,2);assert.equal(feedback.columns,3);assert.deepEqual(feedback.filled,[true,false,true,true,true,true]);assert.match(feedback.detail,/名目10/);assert.match(shapeFeedbackHtml(feedback),/救急箱/);
 assert.equal(shapeFeedbackForEvent(event,boxes.map(b=>({...b,row:11-b.row}))),null);
 assert.equal(shapeFeedbackForEvent(event,boxes.slice(1)),null);
 const breakdown=actionBreakdown({actor:'player',originBoxId:null,links:[],enemyPlannedAction:null,events:[event]},1);assert.match(JSON.stringify(breakdown),/救急箱・形/);
});

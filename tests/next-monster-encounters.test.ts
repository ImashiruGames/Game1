import test from 'node:test';
import assert from 'node:assert/strict';
import {encounterBandsV1,encounterBandsV2,selectEncounter,validateEncounterTable} from '../src/next/app/encounters.ts';
import {bossLoopEncounter} from '../src/next/app/progression.ts';
import {createBattle,applyAction,getEnemyIntent,getEnemyDefinition} from '../src/next/core/index.ts';
import {createTrialConfig,prepareTrialSetup} from '../src/next/config.ts';
import {enemyIntentView} from '../src/next/ui/enemyIntent.ts';
import {monsterDetailsHtml} from '../src/next/ui/monsterPresentation.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {encodeSave,decodeSave,LATE_SAVE_RULES,prepareRetiredCheckpoint} from '../src/next/app/saveCheckpoint.ts';
import {defaultTuning,validateTuning} from '../src/next/core/tuning.ts';
import type {EnemyId,Box} from '../src/next/core/types.ts';
const view={render(){},async animate(){}};
const box=(row:number,col:number,owner:Box['owner']='player',type:Box['type']='normal'):Box=>({id:`b${row}:${col}`,row,col,owner,type,status:'normal'});
function enemy(id:EnemyId,count:number,boxes:Box[]=[]){return createBattle({...createTrialConfig('blue',id),firstActor:'enemy',initialEnemyTurnCount:count,initialBoxes:boxes});}
test('band draws are reproducible, complete, weighted and boss-first over three loops',()=>{
 const counts=new Map<string,number>();
 for(let seed=0;seed<500;seed++)for(let stage=1;stage<=150;stage++){
  const id=selectEncounter(stage,seed);assert.equal(id,selectEncounter(stage,seed));const local=(stage-1)%50+1;
  if(encounterBandsV1.bosses[local])assert.equal(id,encounterBandsV1.bosses[local]);else assert(encounterBandsV2.bands.find(b=>local>=b.from&&local<=b.to)!.pool.some(e=>e.enemyId===id));
  if(local<=24)counts.set(id,(counts.get(id)??0)+1);
 }
 assert.equal(counts.size,5);assert((counts.get('marujiro')??0)>(counts.get('merarun')??0));
 const overlap={...encounterBandsV1,encounterBandsV2,bands:encounterBandsV1.bands.map((b,i)=>i===0?{...b,to:25}:b)};validateEncounterTable(overlap);assert.equal(selectEncounter(25,99,'bands-v1',overlap),'speed-core');
});
test('invalid band IDs, gaps, overlaps, weights, overflow and bosses are rejected',()=>{
 for(const mutate of [(t:any)=>t.bands[0].to=23,(t:any)=>t.bands[1].from=24,(t:any)=>t.bands[0].pool[0].enemyId='bad',(t:any)=>t.bands[0].pool[0].weight=0,(t:any)=>t.bands[0].pool[0].weight=0x1_0000_0001,(t:any)=>t.bands[1].id=t.bands[0].id,(t:any)=>delete t.bosses[25]]){const t=structuredClone(encounterBandsV1);mutate(t);assert.throws(()=>validateEncounterTable(t));}
 assert.throws(()=>selectEncounter(0,1));assert.throws(()=>selectEncounter(1,-1));assert.throws(()=>selectEncounter(1,1,'bad' as any));
});
test('basic band has ordinary attacks only and distinct damage identities',()=>{
 for(const {enemyId} of encounterBandsV1.bands[0]!.pool)for(let n=0;n<30;n++)assert.deepEqual(getEnemyIntent(enemy(enemyId,n)),{type:'drop'});
 assert(getEnemyDefinition('twin-core').attacks[3]>getEnemyDefinition('marujiro').attacks[3]);assert(getEnemyDefinition('needle-core').attacks[5]>getEnemyDefinition('twin-core').attacks[5]);
});
test('freeze chooses uppermost then leftmost non-frozen own boxes without insertion/RNG',()=>{
 const s=enemy('rime-crown',2,[box(7,0),box(6,0),box(7,1),box(6,1),box(7,2,'enemy')]);const preview=enemyIntentView(s);assert.equal(preview.action,'凍結2個');assert.match(preview.detail,/1列・上から7段、2列・上から7段/);
 const r=applyAction(s,{type:'enemy'});assert(r.accepted);assert.deepEqual(r.state.boxes.filter(b=>b.type==='frozen').map(b=>b.id),['b6:0','b6:1']);assert.equal(r.state.rngState,s.rngState);assert.equal(r.state.nextBoxId,s.nextBoxId);assert(!r.resolution!.events.some(e=>['drop','attack','instant-kill','type-damage'].includes(e.type)));assert.equal(r.state.enemyTurnCount,3);
});
test('empty/full-board freeze never substitutes blocked instant-kill; overwrite clears poison source',()=>{
 const empty=enemy('frost-core',3);assert.equal(enemyIntentView(empty).action,'凍結0個（対象なし）');assert.equal(applyAction(empty,{type:'enemy'}).state.hp.player.current,30);
 const base=createTrialConfig('blue','frost-core');const s=createBattle({...base,board:{width:1,height:1,gravity:'down',terrain:[],invalidCells:[]},firstActor:'enemy',initialEnemyTurnCount:3,initialBoxes:[{...box(0,0,'player','poison'),poisonSource:'enemy'}]});
 const r=applyAction(s,{type:'enemy'});assert.equal(r.state.boxes[0]!.type,'frozen');assert.equal(r.state.boxes[0]!.poisonSource,undefined);assert.equal(r.state.hp.player.current,30);
});
test('thorn drop is typed at insertion and old neighboring thorns can kill the monster first',()=>{
 const base=createTrialConfig('blue','thorn-core');const s=createBattle({...base,firstActor:'enemy',initialEnemyTurnCount:3,board:{width:1,height:3,gravity:'down',terrain:[],invalidCells:[]},initialBoxes:[box(2,0,'enemy'),box(1,0,'enemy','thorn')],combatants:{...base.combatants,enemy:{...base.combatants.enemy,initialHp:1}}});
 const r=applyAction(s,{type:'enemy'});assert(r.accepted);const drop=r.resolution!.events.find(e=>e.type==='drop');assert(drop&&drop.type==='drop');assert.equal(drop.box.type,'thorn');assert.equal(r.state.result?.winner,'player');assert(!r.resolution!.events.some(e=>e.type==='attack'));
});
test('new saves pin encounter version, preserve selection through reward resume and mark retired saves too',async()=>{
 for(const stage of [24,25,26,39,40,41,49]){const setup=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:31,stage,mode:'manual',fixture:'reward',route:'boss-loop'});const c=new BattleController(setup.config,view,setup.options);await c.drop('ceiling:2:0');const raw=encodeSave(c.exportCheckpoint(),1,0);assert.equal(JSON.parse(raw).rules,LATE_SAVE_RULES);const copy=BattleController.restore(decodeSave(raw).checkpoint,view);await copy.chooseCategory(copy.runSnapshot!.offer!.id,'heal');assert.equal(copy.snapshot.config.enemyId,selectEncounter(stage+1,31));}
 const setup=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:0,stage:1,mode:'manual',fixture:'normal',route:'boss-loop'});const cp=new BattleController(setup.config,view,setup.options).exportCheckpoint();const retired=prepareRetiredCheckpoint(cp);assert.equal(JSON.parse(encodeSave(retired,2,0)).rules,LATE_SAVE_RULES);assert.deepEqual(decodeSave(encodeSave(retired,2,0)).checkpoint,JSON.parse(JSON.stringify(retired)));
});
test('legacy absent encounter version and old tuning snapshots preserve original route and clocks',()=>{
 const tuning=structuredClone(defaultTuning);for(const id of ['twin-core','needle-core','frost-core','thorn-core','rime-crown','briar-wheel'])delete (tuning.enemies as any)[id];validateTuning(tuning);
 assert.deepEqual([24,25,26,39,40,41,49,50].map(stage=>bossLoopEncounter(stage,'marujiro',tuning).enemyId),['nigirin','speed-core','hikikizan','nigirin','speed-core','hikikizan','marujiro','mother-core']);
 const setup=prepareTrialSetup({ending:'legacy-endless',character:'blue',firstEnemy:'marujiro',seed:1,stage:51,mode:'manual',fixture:'normal',route:'boss-loop'});assert.equal(setup.options.run!.encounterVersion,undefined);assert.equal(setup.config.combatants.enemy.maxHp,180);
});
test('traits and cycle previews stay pure and never present stale tuned link damage',()=>{
 const s=enemy('twin-core',0);const before=JSON.stringify(s);assert.doesNotMatch(monsterDetailsHtml(s),/3連の基本火力4/);for(const id of ['frost-core','thorn-core','rime-crown','briar-wheel'] as const){const m=enemy(id,2);const snapshot=JSON.stringify(m);enemyIntentView(m);monsterDetailsHtml(m);assert.equal(JSON.stringify(m),snapshot);}assert.equal(JSON.stringify(s),before);
});

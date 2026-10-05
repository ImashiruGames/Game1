import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleController} from '../src/next/app/BattleController.ts';
import type {BattleView} from '../src/next/app/BattleController.ts';
import {prepareTrialSetup} from '../src/next/config.ts';
import {encodeSave,decodeSave,validateCheckpoint,DEEP_SAVE_RULES} from '../src/next/app/saveCheckpoint.ts';
import {LocalSave} from '../src/next/app/localSave.ts';
import {selectEncounter,deepEncounterV1,DEEP_ENCOUNTER_VERSION} from '../src/next/app/encounters.ts';
import {bossLoopEncounter} from '../src/next/app/progression.ts';
import {getEnemyDefinition} from '../src/next/core/monsters.ts';
import {defaultTuning} from '../src/next/core/tuning.ts';
import {createProfile,freezeRunMeta,resultReceipt,canEnterDeep,isDeepRun,META} from '../src/next/meta/profile.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';

const view:BattleView={render(){},async animate(){}};
const deepSetup=(stage:number,fixture:'normal'|'reward'='reward')=>prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:7,mode:'manual',stage,fixture,route:'boss-loop',ending:'deep100'});

test('deep floors 51–100 use deep-v1 with absolute-floor HP and no loop multipliers',()=>{
 for(let stage=51;stage<=100;stage++){
  const e=bossLoopEncounter(stage,'marujiro',defaultTuning,{version:DEEP_ENCOUNTER_VERSION,seed:7}),d=getEnemyDefinition(e.enemyId);
  assert.equal(e.enemyId,selectEncounter(stage,7,DEEP_ENCOUNTER_VERSION));
  assert.equal(e.maxHp,d.maxHp+(stage-1)*defaultTuning.progression.hpPerStage);
  assert.deepEqual(e.attacks,d.attacks);assert.equal(e.hpMultiplier,1);assert.equal(e.fixedDamageBonus,0);
 }
 assert.equal(selectEncounter(75,1,DEEP_ENCOUNTER_VERSION),deepEncounterV1.bosses[75]);
 assert.equal(selectEncounter(100,1,DEEP_ENCOUNTER_VERSION),deepEncounterV1.bosses[100]);
 assert.throws(()=>selectEncounter(50,1,DEEP_ENCOUNTER_VERSION));assert.throws(()=>selectEncounter(101,1,DEEP_ENCOUNTER_VERSION));
 // Biribiriman keeps the user-specified link table and appears in the first deep band.
 assert.deepEqual(getEnemyDefinition('biribiriman').attacks,{3:3,4:15,5:25});
 assert(deepEncounterV1.bands[0]!.pool.some(p=>p.enemyId==='biribiriman'));
});

test('deep setup is pinned to 51–100 and never alters the standard 50-floor run',()=>{
 const s=deepSetup(51,'normal');assert.equal(s.options.run!.finishAtStage,100);assert.equal(s.options.run!.encounterVersion,'deep-v1');assert.equal(s.options.run!.startStage,51);
 assert.throws(()=>deepSetup(50,'normal'));assert.throws(()=>deepSetup(101,'normal'));
 const std=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:7,mode:'manual',stage:1,fixture:'normal',route:'boss-loop'});
 assert.equal(std.options.run!.finishAtStage,50);assert.equal(std.options.run!.encounterVersion,'bands-v2');
});

test('a deep victory advances to the next deep floor and saves under the deep rules',async()=>{
 const s=deepSetup(51);let raw:string|null=null;const store=new LocalSave({getItem:()=>raw,setItem(_k,v){raw=v;}},()=>true);store.read();
 const c=new BattleController(s.config,view,s.options,{beforeAction:()=>store.guard(),write:cp=>{store.write(cp);},failed:e=>{throw e;}});
 await c.start();await c.drop('ceiling:2:0');assert.equal(c.runSnapshot!.status,'reward');
 const offerId=c.runSnapshot!.offer!.id;await c.chooseCategory(offerId,'heal');if(c.runSnapshot!.status==='reward')await c.chooseReward(offerId,'immediate-heal');
 const env=decodeSave(raw!);assert.equal(env.rules,DEEP_SAVE_RULES);validateCheckpoint(env.checkpoint);
 assert.equal(c.runSnapshot!.status,'active');{assert.equal(c.runSnapshot!.stage,52);const e=bossLoopEncounter(52,'marujiro',defaultTuning,{version:DEEP_ENCOUNTER_VERSION,seed:7});assert.equal(c.snapshot.hp.enemy.max,e.maxHp);}
});

test('floor 100 victory clears the deep stage and restores as terminal',async()=>{
 const s=deepSetup(100);const c=new BattleController(s.config,view,s.options);await c.start();await c.drop('ceiling:2:0');
 assert.equal(c.runSnapshot!.status,'cleared');assert.equal(c.runSnapshot!.stage,100);assert.equal(c.runSnapshot!.offer,undefined);
 const cp=c.exportCheckpoint();const env=decodeSave(encodeSave(cp,1,1));assert.equal(env.rules,DEEP_SAVE_RULES);
 const restored=BattleController.restore(env.checkpoint,view);await restored.start();assert.equal(restored.runSnapshot!.status,'cleared');
});

test('deep settlement pays deep rates, unlock needs that character\'s 50-floor clear',()=>{
 const p=createProfile(3);assert.equal(canEnterDeep(p,'blue'),false);p.trophies['clear50:blue']=1;assert.equal(canEnterDeep(p,'blue'),true);assert.equal(canEnterDeep(p,'red'),false);
 const meta=freezeRunMeta(p,'blue',true),dep=prepareDeparture(meta,9,'deep');assert.equal(dep.options.run!.startStage,51);assert.equal(dep.options.run!.finishAtStage,100);
 const c=new BattleController(dep.config,view,dep.options),cp=c.exportCheckpoint();assert(isDeepRun(cp));
 p.launches[cp.runId]={character:'blue',snapshot:JSON.stringify(cp.initialConfig.meta)};
 const cleared={...cp,run:{...cp.run!,status:'cleared' as const,stage:100,defeatedCount:50}},lost={...cp,run:{...cp.run!,status:'lost' as const,stage:60,defeatedCount:9}};
 const rc=resultReceipt(p,cleared)!;assert.equal(rc.clear,true);assert.equal(rc.xp,50*META.deepXpPerEnemy+META.deepClearXp);assert.equal(rc.coins,50*META.deepCoinsPerEnemy+META.deepClearCoins);assert.deepEqual(rc.trophies,[]);
 const rl=resultReceipt(p,lost)!;assert.equal(rl.clear,false);assert.equal(rl.xp,9*META.deepXpPerEnemy);
});

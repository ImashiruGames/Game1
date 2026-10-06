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
import {runResultHtml} from '../src/next/ui/runResult.ts';
import {stageLabel,setDeepStage} from '../src/next/ui/stageLabel.ts';

const view:BattleView={render(){},async animate(){}};
const deepSetup=(stage:number,fixture:'normal'|'reward'='reward')=>prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:7,mode:'manual',stage,fixture,route:'boss-loop',ending:'deep50'});

test('the deep stage restarts at floor 1: HP grows from the base like the standard run, no loop multipliers',()=>{
 for(let stage=1;stage<=50;stage++){
  const e=bossLoopEncounter(stage,'marujiro',defaultTuning,{version:DEEP_ENCOUNTER_VERSION,seed:7}),d=getEnemyDefinition(e.enemyId);
  assert.equal(e.enemyId,selectEncounter(stage,7,DEEP_ENCOUNTER_VERSION));
  assert.equal(e.maxHp,d.maxHp+(stage-1)*defaultTuning.progression.hpPerStage);
  assert.deepEqual(e.attacks,d.attacks);assert.equal(e.hpMultiplier,1);assert.equal(e.fixedDamageBonus,0);
 }
 // Floor 1 starts at the monster's own base HP (e.g. Hinobou 40), not +500.
 const first=bossLoopEncounter(1,'marujiro',defaultTuning,{version:DEEP_ENCOUNTER_VERSION,seed:7});assert.equal(first.maxHp,getEnemyDefinition(first.enemyId).maxHp);
 assert.equal(selectEncounter(25,1,DEEP_ENCOUNTER_VERSION),deepEncounterV1.bosses[25]);
 assert.equal(selectEncounter(50,1,DEEP_ENCOUNTER_VERSION),deepEncounterV1.bosses[50]);
 assert.throws(()=>selectEncounter(0,1,DEEP_ENCOUNTER_VERSION));assert.throws(()=>selectEncounter(51,1,DEEP_ENCOUNTER_VERSION));
 assert.deepEqual(getEnemyDefinition('biribiriman').attacks,{3:3,4:15,5:25});
});

test('deep setup is its own 1–50 stage and never alters the standard 50-floor run',()=>{
 const s=deepSetup(1,'normal');assert.equal(s.options.run!.startStage,1);assert.equal(s.options.run!.finishAtStage,50);assert.equal(s.options.run!.encounterVersion,'deep-v2');
 assert.throws(()=>deepSetup(51,'normal'));
 const std=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:7,mode:'manual',stage:1,fixture:'normal',route:'boss-loop'});
 assert.equal(std.options.run!.finishAtStage,50);assert.equal(std.options.run!.encounterVersion,'bands-v2');
});

test('a deep victory advances to deep floor 2 and saves under the deep rules',async()=>{
 const s=deepSetup(1);let raw:string|null=null;const store=new LocalSave({getItem:()=>raw,setItem(_k,v){raw=v;}},()=>true);store.read();
 const c=new BattleController(s.config,view,s.options,{beforeAction:()=>store.guard(),write:cp=>{store.write(cp);},failed:e=>{throw e;}});
 await c.start();await c.drop('ceiling:2:0');assert.equal(c.runSnapshot!.status,'reward');assert.equal(c.runOrigin.deep,true);
 const offerId=c.runSnapshot!.offer!.id;await c.chooseCategory(offerId,'heal');if(c.runSnapshot!.status==='reward')await c.chooseReward(offerId,'immediate-heal');
 const env=decodeSave(raw!);assert.equal(env.rules,DEEP_SAVE_RULES);validateCheckpoint(env.checkpoint);
 assert.equal(c.runSnapshot!.status,'active');assert.equal(c.runSnapshot!.stage,2);
 const e=bossLoopEncounter(2,'marujiro',s.config.tuning!,{version:DEEP_ENCOUNTER_VERSION,seed:7});assert.equal(c.snapshot.hp.enemy.max,e.maxHp);
});

test('deep floor 50 clears the deep stage, says so, and restores as terminal',async()=>{
 const s=deepSetup(50);const c=new BattleController(s.config,view,s.options);await c.start();await c.drop('ceiling:2:0');
 assert.equal(c.runSnapshot!.status,'cleared');assert.equal(c.runSnapshot!.stage,50);assert.equal(c.runSnapshot!.offer,undefined);
 const cp=c.exportCheckpoint();const env=decodeSave(encodeSave(cp,1,1));assert.equal(env.rules,DEEP_SAVE_RULES);
 const restored=BattleController.restore(env.checkpoint,view);await restored.start();assert.equal(restored.runSnapshot!.status,'cleared');
 assert.match(runResultHtml(restored.snapshot,restored.runSnapshot,{...restored.runOrigin,startStage:1}),/深層クリア/);
});

test('stage labels read 深層 nF only in the deep stage',()=>{
 setDeepStage(false);assert.equal(stageLabel(3),'STAGE 3');setDeepStage(true);assert.equal(stageLabel(3),'深層 3F');assert.equal(stageLabel(3,true),'深層 03F');setDeepStage(false);
});

test('deep settlement pays deep rates, never grants 50-floor trophies; unlock needs that character\'s 50-floor clear',()=>{
 const p=createProfile(3);assert.equal(canEnterDeep(p,'blue'),false);p.trophies['clear50:blue']=1;assert.equal(canEnterDeep(p,'blue'),true);assert.equal(canEnterDeep(p,'red'),false);
 const meta=freezeRunMeta(p,'blue',true),dep=prepareDeparture(meta,9,'deep');assert.equal(dep.options.run!.startStage,1);assert.equal(dep.options.run!.finishAtStage,50);
 const c=new BattleController(dep.config,view,dep.options),cp=c.exportCheckpoint();assert(isDeepRun(cp));
 p.launches[cp.runId]={character:'blue',snapshot:JSON.stringify(cp.initialConfig.meta)};
 const cleared={...cp,run:{...cp.run!,status:'cleared' as const,stage:50,defeatedCount:50}},lost={...cp,run:{...cp.run!,status:'lost' as const,stage:10,defeatedCount:9}};
 const rc=resultReceipt(p,cleared)!;assert.equal(rc.clear,true);assert.equal(rc.xp,50*META.deepXpPerEnemy+META.deepClearXp);assert.equal(rc.coins,50*META.deepCoinsPerEnemy+META.deepClearCoins);assert.deepEqual(rc.trophies,[]);
 const rl=resultReceipt(p,lost)!;assert.equal(rl.clear,false);assert.equal(rl.xp,9*META.deepXpPerEnemy);
 // A standard departure is not mistaken for deep.
 const std=prepareDeparture(meta,9);assert(!isDeepRun(new BattleController(std.config,view,std.options).exportCheckpoint()));
});

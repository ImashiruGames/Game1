import test from 'node:test';import assert from 'node:assert/strict';
import {prepareTrialSetup,trialTuning} from '../src/next/config.ts';
import {bossLoopEncounter} from '../src/next/app/progression.ts';
import {getEnemyDefinition} from '../src/next/core/monsters.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import type {BattleView} from '../src/next/app/BattleController.ts';
import {encodeSave,decodeSave} from '../src/next/app/saveCheckpoint.ts';
import {createTuning} from '../src/next/core/tuning.ts';
const setup=(stage=1,deep=false)=>prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:7,mode:'manual',stage,fixture:'normal',route:'boss-loop',ending:deep?'deep50':'clear50'});
const quiet:BattleView={render(){},async animate(){}};
test('all50 new deep floors including bosses use base+(floor-1)*15; standard, attacks and shared tuning remain unchanged',()=>{
 for(let stage=1;stage<=50;stage++){
  const deep=setup(stage,true),normal=setup(stage),d=getEnemyDefinition(deep.config.enemyId!,trialTuning),n=getEnemyDefinition(normal.config.enemyId!,trialTuning);
  assert.equal(deep.config.combatants.enemy.maxHp,d.maxHp+(stage-1)*15);assert.deepEqual(deep.config.combatants.enemy.attacks,d.attacks);
  assert.equal(normal.config.combatants.enemy.maxHp,n.maxHp+(stage-1)*10);assert.deepEqual(normal.config.combatants.enemy.attacks,n.attacks);
 }
 assert.equal(trialTuning.progression.hpPerStage,10);
});
test('legacy deep checkpoint roundtrips unchanged and future floor growth still uses its saved10',async()=>{
 const x=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:7,mode:'manual',stage:1,fixture:'reward',route:'boss-loop',ending:'deep50'}),oldConfig={...x.config,tuning:createTuning({...x.config.tuning,progression:{...x.config.tuning!.progression,hpPerStage:10}})},c=new BattleController(oldConfig,quiet,x.options),raw=encodeSave(c.exportCheckpoint(),1,1),restored=BattleController.restore(decodeSave(raw).checkpoint,quiet);
 assert.equal(encodeSave(restored.exportCheckpoint(),1,1),raw);
 for(const stage of [2,25,50]){const e=bossLoopEncounter(stage,'marujiro',restored.snapshot.config.tuning!,{version:'deep-v2',seed:7});assert.equal(e.maxHp,getEnemyDefinition(e.enemyId).maxHp+(stage-1)*10);}
 await restored.start();await restored.drop('ceiling:2:0');const offer=restored.runSnapshot!.offer!;await restored.chooseCategory(offer.id,'heal');if(restored.runSnapshot!.status==='reward')await restored.chooseReward(offer.id,'immediate-heal');assert.equal(restored.runSnapshot!.stage,2);assert.equal(restored.snapshot.hp.enemy.max,getEnemyDefinition(restored.snapshot.config.enemyId!).maxHp+10);
});
test('new stage1 awaits one locked presentation, ignores double start and restores without presenting again',async()=>{
 const x=setup();let release!:()=>void,calls=0;const view:BattleView={...quiet,async animateStageTransition(before,after,run){calls++;assert.equal(run.stage,1);assert.equal(before,after);await new Promise<void>(r=>release=r);}};
 const c=new BattleController(x.config,view,x.options),before=c.exportCheckpoint();const pending=c.start({showInitialStage:true});assert(c.isResolving);assert.equal(await c.drop('ceiling:2:0'),false);await c.start({showInitialStage:true});assert.equal(calls,1);release();await pending;assert(!c.isResolving);assert.deepEqual(c.exportCheckpoint(),before);await c.start({showInitialStage:true});assert.equal(calls,1);
 const restored=BattleController.restore(before,view);await restored.start({showInitialStage:true});assert.equal(calls,1);
});
test('cancelled departure and failed presentation cannot run actions or strand input',async()=>{
 const x=setup();let release!:()=>void;const c=new BattleController(x.config,{...quiet,async animateStageTransition(){await new Promise<void>(r=>release=r);}},x.options);const pending=c.start({showInitialStage:true});c.destroy();release();await pending;assert.equal(await c.drop('ceiling:2:0'),false);
 const errors:unknown[]=[];const recovered=new BattleController(x.config,{...quiet,async animateStageTransition(){throw Error('display');},reportError:e=>errors.push(e)},x.options);await recovered.start({showInitialStage:true});assert.equal(errors.length,1);assert(!recovered.isResolving);assert(await recovered.drop('ceiling:2:0'));
});

/** Optional real-engine compatibility checks; override GAME1_SOURCE for another checkout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTransformationCinematic} from '../src/next/ui/transformationCinematic.ts';
import {setup} from './helpers/transformation-dom.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {prepareTrialSetup} from '../src/next/config.ts';
const trial=(character:'blue'|'red')=>prepareTrialSetup({character,firstEnemy:'marujiro',seed:481,mode:'manual',stage:1,fixture:'charged',route:'boss-loop'});
test('real blue/red controllers retain identical gameplay state after full, short and skipped visuals',async t=>{
 for(const character of ['blue','red'] as const){
  const initial=trial(character),baseline=new BattleController(initial.config,{render(){},async animate(){}},initial.options);
  await baseline.start();await baseline.transform();
  for(const mode of ['full','short','skip'] as const){
   const h=setup();t.after(h.restore);const c=createTransformationCinematic();let transformations=0;
   const controller=new BattleController(initial.config,{render(){},async animate(resolution,_before,_after,signal){
    for(const event of resolution.events){if(event.type==='transformation'){transformations++;await c.play({eventId:event,event:{type:'transformation',character:event.character},beforeSrc:'/base.png',afterSrc:'/after.png',signal,motion:{short:mode==='short',lowMotion:false}});}}
   },reset(){c.cancel('restart');}},initial.options);
   await controller.start();const pending=controller.transform();assert.equal(controller.isResolving,true);assert.equal(c.active,true);assert.equal(await controller.transform(),false);assert.equal(await controller.drop('ceiling:2:0'),false);
   if(mode==='skip'){h.win.tick(150);h.doc.dispatchEvent(new Event('click',{cancelable:true}));}else h.win.tick(mode==='short'?250:2100);
   assert.equal(await pending,true);assert.equal(controller.isResolving,false);assert.equal(c.active,false);assert.equal(transformations,1);assert.deepEqual(controller.snapshot,baseline.snapshot);assert.deepEqual(controller.runSnapshot,baseline.runSnapshot);assert.equal(h.doc.body.children.length,0);assert.equal(h.win.timers.size,0);
   await controller.start();assert.equal(await controller.transform(),false);assert.equal(transformations,1);
   const restored=BattleController.restore(controller.exportCheckpoint(),{render(){},async animate(resolution){for(const event of resolution.events)assert.notEqual(event.type,'transformation');}});
   await restored.start();assert.deepEqual(restored.snapshot,controller.snapshot);assert.equal(c.active,false);
   h.restore();
  }
 }
});
test('real controller restart during cinematic cancels old flow and preserves fresh gameplay',async t=>{
 const h=setup();t.after(h.restore);const c=createTransformationCinematic();const initial=trial('blue');
 const controller=new BattleController(initial.config,{render(){},async animate(resolution,_before,_after,signal){
  for(const event of resolution.events)if(event.type==='transformation')await c.play({eventId:event,event:{type:'transformation',character:event.character},beforeSrc:'/base.png',afterSrc:'/after.png',signal});
 },reset(){c.cancel('restart');}},initial.options);
 await controller.start();const pending=controller.transform();assert.equal(c.active,true);
 const fresh=prepareTrialSetup({character:'red',firstEnemy:'nigirin',seed:999,mode:'manual',stage:1,fixture:'normal',route:'boss-loop'});
 await controller.restart(fresh.config,fresh.options);await pending;
 assert.equal(c.active,false);assert.equal(controller.snapshot.config.seed,999);assert.equal(controller.snapshot.config.characterId,'red');assert.equal(controller.snapshot.transformation,null);assert.equal(controller.isResolving,false);assert.equal(h.win.timers.size,0);assert.equal(h.doc.body.children.length,0);
});

test('transformation saves only after presentation resolves; abort restores the previous stable checkpoint',async t=>{
 for(const finish of ['skip','abort'] as const){
  const h=setup();t.after(h.restore);const cinematic=createTransformationCinematic(),initial=trial('blue');
  const saved:import('../src/next/app/saveCheckpoint.ts').RunCheckpoint[]=[];
  const hooks={beforeAction(){},write(cp:import('../src/next/app/saveCheckpoint.ts').RunCheckpoint){saved.push(cp);},failed(error:unknown){throw error;}};
  const controller=new BattleController(initial.config,{render(){},async animate(resolution,_before,_after,signal){
   for(const event of resolution.events)if(event.type==='transformation')await cinematic.play({eventId:event,event,beforeSrc:'/blue.png',afterSrc:'/after.png',signal});
  }},initial.options,hooks);
  await controller.start();const before=saved.at(-1)!;const count=saved.length;const pending=controller.transform();
  assert.equal(cinematic.active,true);assert.equal(saved.length,count);assert.equal(before.state.transformation,null);
  if(finish==='skip'){h.win.tick(150);h.doc.dispatchEvent(new Event('click',{cancelable:true}));}else controller.destroy();
  await pending;assert.equal(cinematic.active,false);assert.equal(saved.length,count+(finish==='skip'?1:0));
  const checkpoint=saved.at(-1)!;let replayed=0;const restored=BattleController.restore(checkpoint,{render(){},async animate(resolution){replayed+=resolution.events.filter(e=>e.type==='transformation').length;}});
  await restored.start();assert.equal(replayed,0);assert.deepEqual(restored.snapshot,checkpoint.state);
  assert.equal(!!restored.snapshot.transformation,finish==='skip');assert.equal(restored.snapshot.gauge,finish==='skip'?before.state.gauge-80:before.state.gauge);
  h.restore();
 }
});

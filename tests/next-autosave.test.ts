import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleController } from '../src/next/app/BattleController.ts';
import type { BattleView } from '../src/next/app/BattleController.ts';
import { decodeSave, encodeSave, validateCheckpoint, isCheckpointBoundary } from '../src/next/app/saveCheckpoint.ts';
import type { RunCheckpoint } from '../src/next/app/saveCheckpoint.ts';
import { LocalSave, SaveOwnership, saveNamespace } from '../src/next/app/localSave.ts';
import { trialFixture, prepareTrialSetup, createTrialConfig } from '../src/next/config.ts';
import { getDropOptions } from '../src/next/core/board.ts';
const plain=<T>(v:T):T=>JSON.parse(JSON.stringify(v)) as T;
const view:BattleView={render(){},async animate(){}};
const opts={run:{mode:'endless' as const,rewards:true,rewardMode:'categories' as const}};
class MemoryStorage {data:string|null=null;failRead=false;failWrite=false;getItem(){if(this.failRead)throw new Error('read');return this.data;}setItem(_key:string,v:string){if(this.failWrite)throw new Error('quota');this.data=v;}}
function persistence(storage=new MemoryStorage()){const store=new LocalSave(storage,()=>true);store.read();const errors:unknown[]=[];const history:RunCheckpoint[]=[];const hooks={beforeAction:()=>store.guard(),write(cp:RunCheckpoint){store.write(cp);history.push(cp);},failed:(e:unknown)=>{errors.push(e);}};return {storage,store,hooks,errors,history};}
async function rewardReady(){const p=persistence();const c=new BattleController(trialFixture('reward','blue','marujiro',1,'manual'),view,opts,p.hooks);await c.start();await c.drop('ceiling:2:0');return {c,...p};}

test('checkpoint replay preserves the next combat/reward RNG, state and exact future offer identities',async()=>{
 const setup=prepareTrialSetup({ending:'legacy-endless',character:'red',firstEnemy:'marujiro',seed:1,mode:'manual',stage:44,fixture:'normal',route:'boss-loop'});
 const base={...setup.config,combatants:{...setup.config.combatants,player:{...setup.config.combatants.player,maxHp:1000,initialHp:1000}}};
 const c=new BattleController(base,view,setup.options);await c.start();
 for(let step=0;step<35&&!c.snapshot.result;step++){
  const cp=decodeSave(encodeSave(c.exportCheckpoint(),step+1,1)).checkpoint;
  const restored=BattleController.restore(cp,view);await restored.start();assert.deepEqual(plain(restored.snapshot),plain(c.snapshot));assert.deepEqual(restored.runSnapshot,c.runSnapshot);
  const legal=getDropOptions(c.snapshot).filter(o=>o.available);const id=legal[step%legal.length]?.id;if(!id)break;
  await c.drop(id);await restored.drop(id);assert.deepEqual(plain(restored.snapshot),plain(c.snapshot));assert.deepEqual(restored.runSnapshot,c.runSnapshot);assert.equal(restored.exportCheckpoint().rewardRng,c.exportCheckpoint().rewardRng);
 }
});
test('category commitment restores exact candidates and locks reroll before revealing them',async()=>{
 const {c,store}=await rewardReady();const id=c.runSnapshot!.offer!.id;await c.chooseCategory(id,'skills');const cp=store.latest!.checkpoint;
 assert.equal(cp.run!.offer!.category,'skills');const restored=BattleController.restore(cp,view);await restored.start();
 assert.deepEqual(restored.runSnapshot!.offer,c.runSnapshot!.offer);assert.equal(await restored.chooseCategory(id,'stats'),false);assert.equal(await restored.chooseReward(id,'health'),true);assert.equal(restored.snapshot.build!.fixed.rank,2);
});
test('checkpoint is not written mid-animation; whole automatic chain produces one stable state',async()=>{
 const p=persistence();let release!:()=>void;let calls=0;
 const c=new BattleController(createTrialConfig('red'),{render(){},animate:()=>++calls===1?new Promise<void>(r=>{release=r;}):Promise.resolve()},opts,p.hooks);
 await c.start();const raw=p.storage.data;const action=c.drop('ceiling:0:0');assert.equal(c.isResolving,true);assert.throws(()=>c.exportCheckpoint());assert.equal(p.storage.data,raw);release();await action;
 assert.equal(c.snapshot.actor,'player');assert.equal(c.snapshot.enemyTurnCount,1);assert.deepEqual(plain(p.store.latest!.checkpoint.state),plain(c.snapshot));assert.ok(isCheckpointBoundary(c.snapshot,c.runSnapshot));
});
test('reward transition interruption resumes the durable pre-effect intent once',async()=>{
 const p=persistence();let release!:()=>void;const c=new BattleController(trialFixture('reward','blue','marujiro',1,'manual'),{...view,animateStageTransition:()=>new Promise<void>(r=>{release=r;})},opts,p.hooks);
 await c.start();await c.drop('ceiling:2:0');const action=c.chooseCategory(c.runSnapshot!.offer!.id,'heal');
 assert.equal(c.snapshot.hp.player.current,28);const cp=p.store.latest!.checkpoint;assert.equal(cp.state.hp.player.current,18);assert.equal(cp.pendingReward!.rewardId,'immediate-heal');
 c.destroy();release();await action;assert.deepEqual(p.store.latest!.checkpoint,cp);
 const resumed=BattleController.restore(cp,view,p.hooks);await resumed.start();assert.equal(resumed.snapshot.hp.player.current,28);assert.equal(resumed.runSnapshot!.stage,2);assert.equal(p.store.latest!.checkpoint.pendingReward,undefined);
 await resumed.start();assert.equal(resumed.snapshot.hp.player.current,28);
});
test('failed final write retries the computed reward outcome without healing twice',async()=>{
 const {c,store,hooks,storage,errors}=await rewardReady();const original=hooks.write;
 hooks.write=(cp)=>{if(cp.run?.stage===2&&!cp.pendingReward)storage.failWrite=true;original(cp);};
 await c.chooseCategory(c.runSnapshot!.offer!.id,'heal');assert.equal(c.persistenceBlocked,true);assert.equal(c.snapshot.hp.player.current,28);assert.equal(store.latest!.checkpoint.state.hp.player.current,18);assert.ok(errors.length);
 storage.failWrite=false;hooks.write=original;assert.equal(c.retrySave(),true);assert.equal(store.latest!.checkpoint.state.hp.player.current,28);assert.equal(store.latest!.checkpoint.pendingReward,undefined);assert.equal(c.snapshot.hp.player.current,28);
});
test('retry after restored intent preflight failure cannot abandon the committed reward',async()=>{
 const {c}=await rewardReady();await c.chooseCategory(c.runSnapshot!.offer!.id,'skills');const offer=c.runSnapshot!.offer!;const cp={...c.exportCheckpoint(),pendingReward:{offerId:offer.id,rewardId:'health' as const}};
 const p=persistence();p.store.write(cp);p.storage.failRead=true;const resumed=BattleController.restore(cp,view,p.hooks);await resumed.start();assert.equal(resumed.persistenceBlocked,true);
 p.storage.failRead=false;assert.equal(resumed.retrySave(),true);assert.equal(p.store.latest!.checkpoint.pendingReward!.rewardId,'health');assert.equal(await resumed.chooseReward(offer.id,null),false);
 await resumed.start();assert.equal(resumed.snapshot.build!.fixed.rank,2);assert.equal(resumed.runSnapshot!.stage,2);assert.equal(p.store.latest!.checkpoint.pendingReward,undefined);
});
test('corrupt, incompatible and inconsistent runtime data fail without deleting the raw save',async()=>{
 const {c}=await rewardReady();const cp=c.exportCheckpoint(),raw=encodeSave(cp,1,123);
 for(const bad of ['{',raw.replace('next-1.2-clear50-intrinsic-health','future-v2'),raw.replace('"checksum":"','"checksum":"x')]){const storage=new MemoryStorage();storage.data=bad;const store=new LocalSave(storage,()=>true);assert.throws(()=>store.read());assert.equal(storage.data,bad);}
 const bad=structuredClone(cp);(bad.state as unknown as {playerTurnStarted:unknown}).playerTurnStarted='yes';assert.throws(()=>validateCheckpoint(bad));
 const mismatch=structuredClone(cp);(mismatch.initialConfig as unknown as {characterId:string}).characterId='red';assert.throws(()=>validateCheckpoint(mismatch));
});
test('external overwrite and missing ownership stop writes before changing saved bytes',async()=>{
 const {c}=await rewardReady();const storage=new MemoryStorage();let owned=true;const save=new LocalSave(storage,()=>owned);save.read();save.write(c.exportCheckpoint());const first=storage.data;
 storage.data='external';assert.throws(()=>save.write(c.exportCheckpoint()));assert.equal(storage.data,'external');storage.data=first;owned=false;assert.throws(()=>save.guard());assert.throws(()=>save.write(c.exportCheckpoint()));assert.equal(storage.data,first);
});
test('ownership refuses simultaneous tabs and handles release before delayed grant',async()=>{
 let callback:((lock:Lock|null)=>Promise<unknown>)|undefined;let requests=0;
 const locks={request(_name:string,_options:unknown,cb:(lock:Lock|null)=>Promise<unknown>){requests++;callback=cb;return new Promise<unknown>(resolve=>{queueMicrotask(()=>{void callback!({name:'x',mode:'exclusive'} as Lock).then(resolve);});});}} as unknown as Pick<LockManager,'request'>;
 const owner=new SaveOwnership();const a=owner.acquire(locks),b=owner.acquire(locks);assert.strictEqual(a,b);owner.release();assert.equal(await a,false);assert.equal(await b,false);assert.equal(owner.owned,false);assert.equal(requests,1);
 const denied={request:async(_n:string,_o:unknown,cb:(lock:Lock|null)=>Promise<unknown>)=>cb(null)} as unknown as Pick<LockManager,'request'>;assert.equal(await owner.acquire(denied),false);assert.equal(owner.owned,false);await assert.rejects(new SaveOwnership().acquire(undefined));
});
test('Red manual form and remaining starts survive checkpoint restore without a retroactive insertion',async()=>{
 const c=new BattleController(trialFixture('charged','red','marujiro',1,'manual'),view,opts);await c.start();await c.transform();const restored=BattleController.restore(decodeSave(encodeSave(c.exportCheckpoint(),1)).checkpoint,view);await restored.start();assert.deepEqual(plain(restored.snapshot),plain(c.snapshot));assert.equal(restored.snapshot.boxes.length,0);
 await c.drop('ceiling:0:0');await restored.drop('ceiling:0:0');assert.deepEqual(plain(restored.snapshot),plain(c.snapshot));assert.equal(restored.snapshot.transformation?.character==='red'&&restored.snapshot.transformation.remainingStarts,1);
});
test('Mother phase and clocks, negative terminal HP and collision-skipping box IDs roundtrip',async()=>{
 const setup=prepareTrialSetup({ending:'legacy-endless',character:'red',firstEnemy:'marujiro',seed:1,mode:'manual',stage:100,fixture:'mother-critical',route:'boss-loop'});const c=new BattleController(setup.config,view,setup.options);await c.start();const cp=c.exportCheckpoint();assert.equal(cp.state.enemyPhase?.phase,'critical');assert.deepEqual(plain(BattleController.restore(decodeSave(encodeSave(cp,1)).checkpoint,view).snapshot),plain(c.snapshot));
 const {c:win}=await rewardReady();assert.ok(win.snapshot.hp.enemy.current<0);assert.deepEqual(decodeSave(encodeSave(win.exportCheckpoint(),1)).checkpoint.state.hp,win.snapshot.hp);
 const carried=structuredClone(cp);(carried.state as unknown as {nextBoxId:number}).nextBoxId=1;validateCheckpoint(carried);
});
test('49→50 and50→51 reward restores keep scaling, HP and counter reset',async()=>{
 for(const stage of [49,50]){const setup=prepareTrialSetup({ending:'legacy-endless',character:'red',firstEnemy:'marujiro',seed:1,mode:'manual',stage,fixture:'reward',route:'boss-loop'});const c=new BattleController(setup.config,view,setup.options);await c.drop('ceiling:2:0');const r=BattleController.restore(c.exportCheckpoint(),view);await r.chooseCategory(r.runSnapshot!.offer!.id,'heal');await c.chooseCategory(c.runSnapshot!.offer!.id,'heal');assert.deepEqual(r.snapshot,c.snapshot);assert.deepEqual(r.runSnapshot,c.runSnapshot);assert.equal(r.runSnapshot!.stage,stage+1);assert.equal(r.snapshot.enemyTurnCount,0);}
});

test('verification-read failure reconciles the exact written category instead of replacing it',async()=>{
 const p=persistence();const c=new BattleController(trialFixture('reward','blue','marujiro',1,'manual'),view,opts,p.hooks);await c.start();await c.drop('ceiling:2:0');
 const ordinarySet=p.storage.setItem.bind(p.storage);let failOnce=true;
 p.storage.setItem=(key,v)=>{ordinarySet(key,v);if(failOnce){failOnce=false;p.storage.failRead=true;}};
 assert.equal(await c.chooseCategory(c.runSnapshot!.offer!.id,'skills'),false);assert.equal(c.persistenceBlocked,true);assert.equal(c.runSnapshot!.offer!.category,'pending');
 const durable=decodeSave(p.storage.data!);assert.equal(durable.checkpoint.run!.offer!.category,'skills');
 p.storage.failRead=false;assert.equal(c.retrySave(),true);assert.equal(c.runSnapshot!.offer!.category,'skills');assert.deepEqual(c.runSnapshot!.offer,durable.checkpoint.run!.offer);assert.equal(await c.chooseCategory(c.runSnapshot!.offer!.id,'stats'),false);
});
test('failure before a carried Red start offers restoration from the retained reward journal',async()=>{
 const p=persistence();const base=trialFixture('reward','red','marujiro',1,'manual');
 const c=new BattleController({...base,initialGauge:100},{...view,async animateStageTransition(){p.storage.failRead=true;}},opts,p.hooks);
 await c.start();await c.transform();await c.drop('ceiling:2:0');await c.chooseCategory(c.runSnapshot!.offer!.id,'heal');
 assert.equal(c.persistenceBlocked,true);assert.equal(isCheckpointBoundary(c.snapshot,c.runSnapshot),false);p.storage.failRead=false;assert.equal(c.retrySave(),false);assert.ok(String(p.errors.at(-1)).includes('保存された状態へ戻る'));
 const journal=p.store.latest!.checkpoint;assert.equal(journal.pendingReward!.rewardId,'immediate-heal');const restored=BattleController.restore(journal,view,p.hooks);await restored.start();assert.equal(restored.snapshot.hp.player.current,28);assert.equal(restored.runSnapshot!.stage,2);assert.equal(restored.snapshot.transformation?.character==='red'&&restored.snapshot.transformation.remainingStarts,1);assert.equal(p.store.latest!.checkpoint.pendingReward,undefined);
});

import {generateCategoryOffer,rewardSeed} from '../src/next/app/rewards.ts';
import {createPlayerBuild,createSkill} from '../src/next/core/playerBuild.ts';
import type {RewardId,RewardCategory} from '../src/next/app/rewards.ts';
test('reward intent replay matches maxHP, all power tiers, fixed upgrade, replacement and skip',async()=>{
 const build={...createPlayerBuild('blue'),slots:[createSkill('charge'),createSkill('first-guard')] as const};
 for(const id of ['max-health','three-polish','four-polish','five-polish','health','magic-bullet',null] as readonly (RewardId|null)[]){const category:RewardCategory=id&&['health','magic-bullet'].includes(id)?'skills':'stats';let seed=0;
 while(id&&!generateCategoryOffer(build,rewardSeed(seed),'x',category).offer.choices.includes(id))seed++;
 const c=new BattleController({...trialFixture('reward','blue','marujiro',seed,'manual'),initialBuild:build},view,opts);await c.drop('ceiling:2:0');const offerId=c.runSnapshot!.offer!.id;await c.chooseCategory(offerId,category);const replacement=id==='magic-bullet'?1:undefined;
 const checkpoint={...c.exportCheckpoint(),pendingReward:{offerId,rewardId:id,...(replacement===undefined?{}:{replacement})}};const restored=BattleController.restore(decodeSave(encodeSave(checkpoint,1)).checkpoint,view);
 await c.chooseReward(offerId,id,replacement);await restored.start();assert.deepEqual(plain(restored.snapshot),plain(c.snapshot));assert.deepEqual(restored.runSnapshot,c.runSnapshot);assert.equal(restored.exportCheckpoint().rewardRng,c.exportCheckpoint().rewardRng);
 }
});


test('prototype member names cannot masquerade as saved skill IDs',async()=>{
 const {c}=await rewardReady();
 for(const id of ['constructor','__proto__','toString']){const cp=structuredClone(c.exportCheckpoint());(cp.state.build!.slots as unknown as unknown[])[0]={id,rank:1,uses:null};assert.throws(()=>encodeSave(cp,1));assert.throws(()=>BattleController.restore(cp,view));}
});


test('an oversized checkpoint is rejected before replacing the previous readable save',async()=>{
 const {c}=await rewardReady();const p=persistence();p.store.write(c.exportCheckpoint());const before=p.storage.data;
 const cp=structuredClone(c.exportCheckpoint());(cp.initialConfig as unknown as {description:string}).description='x'.repeat(2_000_000);
 assert.throws(()=>p.store.write(cp));assert.equal(p.storage.data,before);assert.deepEqual(p.store.read()!.checkpoint,decodeSave(before!).checkpoint);
});


test('saved box allocator leaves enough safe-integer headroom for collision skipping',async()=>{
 const {c}=await rewardReady();const cp=structuredClone(c.exportCheckpoint());
 (cp.state as unknown as {nextBoxId:number}).nextBoxId=Number.MAX_SAFE_INTEGER;
 assert.throws(()=>encodeSave(cp,1));assert.throws(()=>BattleController.restore(cp,view));
 (cp.state as unknown as {nextBoxId:number}).nextBoxId=1;validateCheckpoint(cp);
});


test('preview storage and ownership keys cannot collide with the next-game namespace',()=>{
 const preview=saveNamespace('/save-preview/'),game=saveNamespace('/next/');assert.notEqual(preview.key,game.key);assert.notEqual(preview.lock,game.lock);assert.equal(preview.preview,true);assert.deepEqual(saveNamespace('/save-preview'),preview);assert.equal(game.preview,false);
});

test('build UI review has its own save key and ownership lock',()=>{
 const review=saveNamespace('/build-ui-preview/'),old=saveNamespace('/save-preview/'),game=saveNamespace('/next/');
 assert.equal(review.preview,true);assert.deepEqual(saveNamespace('/build-ui-preview'),review);assert.equal(new Set([review.key,old.key,game.key]).size,3);assert.equal(new Set([review.lock,old.lock,game.lock]).size,3);assert.deepEqual(saveNamespace('/build-ui-preview-other/'),game);
});


test('sample audio review uses its own save and ownership namespace',()=>{
 const routes=['/next/','/save-preview/','/build-ui-preview/','/audio-asset-preview/'];const n=routes.map(saveNamespace);
 assert.equal(new Set(n.map(x=>x.key)).size,4);assert.equal(new Set(n.map(x=>x.lock)).size,4);
 assert.deepEqual(saveNamespace('/audio-asset-preview'),n[3]);assert.deepEqual(saveNamespace('/audio-asset-preview-other/'),n[0]);
});

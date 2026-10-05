import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleController} from '../src/next/app/BattleController.ts';
import {prepareTrialSetup,createTrialConfig} from '../src/next/config.ts';
import {encodeSave,decodeSave,validateCheckpoint} from '../src/next/app/saveCheckpoint.ts';
import {LocalSave} from '../src/next/app/localSave.ts';
import {createBattle,applyAction} from '../src/next/core/battle.ts';
import {battleFixtures} from '../src/next/core/definitions.ts';
import {feedbackForEvent,feedbackPosition,feedbackTiming} from '../src/next/ui/battleFeedback.ts';
import {runResultHtml} from '../src/next/ui/runResult.ts';
import type {BattleView} from '../src/next/app/BattleController.ts';
const view:BattleView={render(){},async animate(){}};
const setup50=()=>prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:1,mode:'manual',stage:50,fixture:'reward',route:'boss-loop'});

test('standard stage50 victory clears, saves, and resumes without reward or stage51',async()=>{
 const setup=setup50();assert.equal(setup.options.run!.finishAtStage,50);let raw:string|null=null;const store=new LocalSave({getItem:()=>raw,setItem(_key,value){raw=value;}},()=>true);store.read();
 const c=new BattleController(setup.config,view,setup.options,{beforeAction:()=>store.guard(),write:cp=>{store.write(cp);},failed:error=>{throw error;}});
 await c.start();await c.drop('ceiling:2:0');assert.equal(c.runSnapshot!.status,'cleared');assert.equal(c.runSnapshot!.stage,50);assert.equal(c.runSnapshot!.offer,undefined);assert.equal(c.snapshot.hp.player.current,18);
 assert.equal(await c.chooseCategory('anything','heal'),false);assert.equal(await c.drop('ceiling:3:0'),false);
 const saved=decodeSave(raw!);assert.equal(saved.checkpoint.run!.status,'cleared');const restored=BattleController.restore(saved.checkpoint,view);await restored.start();assert.equal(restored.runSnapshot!.stage,50);assert.equal(restored.runSnapshot!.status,'cleared');assert.equal(restored.snapshot.hp.player.current,18);assert.equal(restored.runSnapshot!.offer,undefined);
});
test('stage50 simultaneous enemy/player KO remains a loss and never earns a final reward',async()=>{
 const setup=setup50();const boxes=[{id:'p',row:7,col:0,owner:'player' as const,type:'normal' as const,status:'normal' as const},{id:'e',row:7,col:1,owner:'enemy' as const,type:'normal' as const,status:'normal' as const}];
 const config={...setup.config,initialBoxes:boxes,combatants:{player:{...setup.config.combatants.player,initialHp:2},enemy:{...setup.config.combatants.enemy,initialHp:2}}};const c=new BattleController(config,view,setup.options);await c.boardSkill('pain-shared',7);
 assert.equal(c.snapshot.hp.player.current,0);assert.equal(c.snapshot.hp.enemy.current,0);assert.equal(c.snapshot.result!.winner,'enemy');assert.equal(c.runSnapshot!.status,'lost');assert.equal(c.runSnapshot!.defeatedCount,0);assert.equal(c.runSnapshot!.offer,undefined);validateCheckpoint(c.exportCheckpoint());
});
test('legacy endless remains explicit and preserves the50 reward then51 transition',async()=>{
 const setup=prepareTrialSetup({character:'red',firstEnemy:'marujiro',seed:1,mode:'manual',stage:50,fixture:'reward',route:'boss-loop',ending:'legacy-endless'});assert.equal(setup.options.run!.finishAtStage,undefined);const c=new BattleController(setup.config,view,setup.options);await c.drop('ceiling:2:0');assert.equal(c.runSnapshot!.status,'reward');await c.chooseCategory(c.runSnapshot!.offer!.id,'heal');assert.equal(c.runSnapshot!.stage,51);assert.equal(c.snapshot.hp.enemy.max,180);
});
test('finish bounds and inconsistent final reward checkpoints fail closed',async()=>{
 assert.throws(()=>prepareTrialSetup({character:'red',firstEnemy:'marujiro',seed:1,mode:'manual',stage:51,fixture:'normal',route:'boss-loop'}));const setup=setup50();
 for(const finishAtStage of [0,49,NaN])assert.throws(()=>new BattleController(setup.config,view,{run:{...setup.options.run!,finishAtStage}}));
 const c=new BattleController(setup.config,view,setup.options);await c.drop('ceiling:2:0');const saved=c.exportCheckpoint();const cp={...saved,run:{...saved.run!,status:'reward' as const,offer:{id:'invalid-final',category:'pending' as const,choices:[]}}};assert.throws(()=>validateCheckpoint(cp));
 const over={...saved,run:{...saved.run!,stage:51}};assert.throws(()=>validateCheckpoint(over));
});
test('result screen renders only saved facts and labels a mid-run fixture honestly',async()=>{
 const setup=setup50();const c=new BattleController(setup.config,view,setup.options);await c.drop('ceiling:2:0');const html=runResultHtml(c.snapshot,c.runSnapshot,c.runOrigin);assert.ok(html.includes('検証ラン終了'));assert.ok(html.includes('検証開始階：50'));assert.ok(html.includes('18 / 30'));assert.ok(html.includes('ヘルス'));assert.ok(!html.includes('総ダメージ'));assert.ok(!html.includes('累計手数'));
 const full=runResultHtml(c.snapshot,{...c.runSnapshot!,defeatedCount:50},{seed:77,startStage:1});assert.ok(full.includes('50階クリア！'));assert.ok(full.includes('<dd>50体</dd>'));assert.ok(full.includes('<dd>77</dd>'));assert.ok(!full.includes('検証開始階'));
});
test('old rules saves are rejected without overwriting or converting the record',async()=>{
 const setup=setup50(),c=new BattleController(setup.config,view,{run:{...setup.options.run,encounterVersion:undefined}});await c.start();const raw=encodeSave(c.exportCheckpoint(),1).replace('next-1.2-clear50-intrinsic-health','next-1.1.1-intrinsic-health');let writes=0;const store=new LocalSave({getItem:()=>raw,setItem(){writes++;}},()=>true);assert.throws(()=>store.read(),/この版では読めない/);assert.equal(writes,0);
});
test('feedback highlights only the current primary axis, never all matched directions together',()=>{
 const base=battleFixtures.find(f=>f.id==='grow-fire')!;const state=createBattle(createTrialConfig('red','marujiro',base));const result=applyAction(state,{type:'drop',candidateId:'ceiling:1:0'});const attacks=result.resolution!.events.filter(e=>e.type==='attack');assert.ok(attacks.length>=2);
 for(const event of attacks){const f=feedbackForEvent(event,result.resolution!.links)!;assert.deepEqual(f.boxIds,result.resolution!.links.find(l=>l.axis===event.axis)!.boxIds);assert.equal(f.text,`${event.damage}ダメージ`);assert.equal(f.tone,'damage');}
});
test('actual healing and nominal Blue reflection have separate values and real shape geometry',()=>{
 const f=battleFixtures.find(f=>f.id==='transformed-health')!;const state=createBattle(createTrialConfig('blue','marujiro',f));const r=applyAction(state,{type:'drop',candidateId:'ceiling:0:0'});const h=r.resolution!.events.find(e=>e.type==='heal')!,d=r.resolution!.events.find(e=>e.type==='damage'&&e.source==='blue-transformation')!;
 const heal=feedbackForEvent(h,r.resolution!.links)!,reflect=feedbackForEvent(d,r.resolution!.links)!;assert.equal(heal.text,'0回復');assert.ok(heal.detail.includes('予定15'));assert.equal(heal.tone,'heal');assert.equal(reflect.text,'15ダメージ');assert.ok(reflect.detail.includes('名目回復の反射'));assert.deepEqual(heal.boxIds,reflect.boxIds);assert.equal(heal.boxIds.length,5);
});
test('self-cost and enemy fixed damage identify their source and anchor on the damaged side',()=>{
 const state=createBattle(createTrialConfig('red'));const r=applyAction(state,{type:'board-skill',skillId:'ember'});const cost=feedbackForEvent(r.resolution!.events.find(e=>e.type==='damage')!,[])!;assert.equal(cost.text,'3HP消費');assert.equal(cost.tone,'cost');assert.equal(cost.anchor,'player');assert.ok(cost.detail.includes('自己コスト'));
 const setup=prepareTrialSetup({character:'red',firstEnemy:'marujiro',seed:1,mode:'manual',stage:25,fixture:'speed-pulse',route:'boss-loop'});const boss=applyAction(createBattle(setup.config),{type:'enemy'});const hit=feedbackForEvent(boss.resolution!.events.find(e=>e.type==='damage'&&e.source==='boss-fixed')!,[])!;assert.equal(hit.tone,'damage');assert.equal(hit.anchor,'player');assert.ok(hit.detail.includes('固定攻撃'));
});
test('feedback label fits inside narrow board bounds and reduced motion stays brief',()=>{
 for(const width of [320,390,540])for(const box of [{left:0,right:40,top:0,bottom:40},{left:width-40,right:width,top:360,bottom:400}]){const p=feedbackPosition({width,height:410},[box],{width:280,height:60},'player');assert.ok(p.x-140>=6);assert.ok(p.x+140<=width-6);assert.ok(p.y-60-p.rise>=6);assert.ok(p.y<=404);}
 assert.equal(feedbackTiming(true).lead,0);assert.ok(feedbackTiming(true).hold<feedbackTiming(false).hold);
});
test('Blue can clear the upper arm and actively replace it to heal again without a new limit',()=>{
 const base=battleFixtures.find(f=>f.id==='health-plus')!;const setup=createTrialConfig('blue','marujiro',base);let s=createBattle({...setup,enemyId:undefined,enemyPattern:[{type:'heal',amount:0}],combatants:{...setup.combatants,enemy:{...setup.combatants.enemy,maxHp:500,initialHp:500}}});
 const first=applyAction(s,{type:'drop',candidateId:'ceiling:0:0'});assert.equal(first.resolution!.events.filter(e=>e.type==='heal').length,1);s=applyAction(first.state,{type:'enemy'}).state;
 const clear=applyAction(s,{type:'board-skill',skillId:'pain-shared',row:1});assert.equal(clear.resolution!.events.filter(e=>e.type==='heal').length,0);assert.equal(clear.state.hp.player.current,s.hp.player.current);s=applyAction(clear.state,{type:'enemy'}).state;
 const second=applyAction(s,{type:'drop',candidateId:'ceiling:1:0'});const heal=second.resolution!.events.find(e=>e.type==='heal')!;assert.equal(heal.type==='heal'&&heal.requestedAmount,15);assert.equal(second.state.hp.player.current,30);
});

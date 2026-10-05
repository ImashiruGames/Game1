import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayerBuild, createSkill, acquireSkill, canReceiveSkillReward } from '../src/next/core/playerBuild.ts';
import { skillCatalog, normalSkillIds } from '../src/next/core/skillCatalog.ts';
import { applyAction, createBattle } from '../src/next/core/battle.ts';
import { battleFixtures } from '../src/next/core/definitions.ts';
import { applyRunReward, generateCategoryOffer, generateRewardOffer, rewardSeed, drawRewardChoices, rewardPool } from '../src/next/app/rewards.ts';
import { trialFixture, createTrialConfig } from '../src/next/config.ts';
import { BattleController } from '../src/next/app/BattleController.ts';
import type { PlayerBuild, CharacterId } from '../src/next/core/types.ts';
const options={run:{mode:'endless' as const,rewards:true,rewardMode:'categories' as const}};
async function won(character:CharacterId,seed=1){const c=new BattleController(trialFixture('reward',character,'marujiro',seed,'manual'),{render(){},async animate(){}},options);await c.drop('ceiling:2:0');return c;}

test('Health reward eligibility derives from intrinsic starter metadata, not incidental ownership',()=>{
 const red=createPlayerBuild('red'),blue=createPlayerBuild('blue');
 assert.equal(skillCatalog.health.rewardAccess,'starter-upgrade-only');
 assert.equal(canReceiveSkillReward(red,'health'),false);assert.equal(acquireSkill(red,'health'),null);
 const injected={...red,slots:[createSkill('health'),null] as PlayerBuild['slots']};
 assert.equal(canReceiveSkillReward(injected,'health'),false);assert.equal(acquireSkill(injected,'health'),null);
 const upgraded=acquireSkill(blue,'health')!;assert.equal(upgraded.fixed.rank,2);assert.deepEqual(upgraded.slots,[null,null]);assert.equal(canReceiveSkillReward(upgraded,'health'),false);assert.equal(acquireSkill(upgraded,'health'),null);
 assert.equal(acquireSkill(blue,'grow-fire')?.slots[0]?.id,'grow-fire');
});
test('both reward generators exclude nonstarter Health across1000 seeds and keep eligible Blue upgrades',()=>{
 const red=createPlayerBuild('red'),blue=createPlayerBuild('blue');let blueSeen=0;
 for(let seed=0;seed<1000;seed++){for(const build of [red,blue]){for(const result of [generateCategoryOffer(build,seed,'id','skills'),generateRewardOffer(build,seed,'id')]){
 assert.equal(result.offer.choices.length,3);assert.equal(new Set(result.offer.choices).size,3);
 if(build===red)assert.ok(!result.offer.choices.includes('health'));else if(result.offer.choices.includes('health'))blueSeen++;
 }}assert.deepEqual(generateCategoryOffer(red,seed,'id','skills'),generateCategoryOffer(red,seed,'id','skills'));}
 assert.ok(blueSeen>0);assert.ok(rewardPool(blue).includes('grow-fire'));
});
test('short and empty reward pools commit distinct available choices without unnecessary RNG',()=>{
 assert.deepEqual(drawRewardChoices([],77,3),{choices:[],rngState:77});
 const one=drawRewardChoices(['charge','charge'],77,3);assert.deepEqual(one.choices,['charge']);
 const two=drawRewardChoices(['health','charge'],77,3);assert.equal(two.choices.length,2);assert.equal(new Set(two.choices).size,2);assert.deepEqual(two,drawRewardChoices(['health','charge'],77,3));
});
test('direct run reward and a stale controller offer cannot grant Red Health',async()=>{
 const c=await won('red');const id=c.runSnapshot!.offer!.id;await c.chooseCategory(id,'skills');
 assert.equal(applyRunReward(c.snapshot,'health'),null);const before=c.snapshot;
 // An offer retained from the prior policy is untrusted even if it contains Health.
 const boundary=c as unknown as {run:NonNullable<typeof c.runSnapshot>};boundary.run={...c.runSnapshot!,offer:{id,category:'skills',choices:['health']}};
 assert.equal(await c.chooseReward(id,'health'),false);assert.strictEqual(c.snapshot,before);assert.equal(c.runSnapshot!.stage,1);
 assert.equal(await c.chooseCategory(id,'stats'),false);assert.equal(await c.chooseReward(id,null),true);assert.equal(c.runSnapshot!.stage,2);
});
test('Blue upgrades fixed Health once, retains slots and cannot reuse reward after restart',async()=>{
 let seed=0;while(!generateCategoryOffer(createPlayerBuild('blue'),rewardSeed(seed),'id','skills').offer.choices.includes('health'))seed++;
 const c=await won('blue',seed),id=c.runSnapshot!.offer!.id;await c.chooseCategory(id,'skills');const offer=c.runSnapshot!.offer!;
 await c.start();assert.deepEqual(c.runSnapshot!.offer,offer);assert.equal(await c.chooseCategory(id,'stats'),false);
 assert.equal(await c.chooseReward(id,'health'),true);assert.equal(c.snapshot.build!.fixed.rank,2);assert.deepEqual(c.snapshot.build!.slots,[null,null]);assert.equal(c.runSnapshot!.stage,2);
 assert.equal(generateCategoryOffer(c.snapshot.build!,1,'later','skills').offer.choices.includes('health'),false);
 await c.restart();assert.equal(c.snapshot.build!.fixed.rank,1);assert.equal(await c.chooseReward(id,'health'),false);
});
test('Health15/20, nominal Blue reflection and repeat active insertion effects are unchanged',()=>{
 const f=battleFixtures.find(f=>f.id==='health-plus')!;
 for(const rank of [1,2] as const){const c=createTrialConfig('blue','marujiro',f);const build={...createPlayerBuild('blue'),fixed:createSkill('health',rank)};
 for(const hp of [10,30]){const s=createBattle({...c,initialBuild:build,initialTransformation:{character:'blue',scope:'stage'},combatants:{...c.combatants,player:{...c.combatants.player,initialHp:hp}}});const r=applyAction(s,{type:'drop',candidateId:'ceiling:0:0'});const heal=r.resolution!.events.find(e=>e.type==='heal')!;const reflected=r.resolution!.events.find(e=>e.type==='damage'&&e.source==='blue-transformation')!;assert.equal(heal.type==='heal'&&heal.requestedAmount,rank===1?15:20);assert.equal(heal.type==='heal'&&heal.amount,Math.min(30-hp,rank===1?15:20));assert.equal(reflected.type==='damage'&&reflected.damage,rank===1?15:20);}}
 const base=createTrialConfig('blue','marujiro');
 const boxes=[6,7].flatMap(row=>Array.from({length:6},(_,col)=>({id:`p:${row}:${col}`,row,col,owner:'player' as const,type:'normal' as const,status:'normal' as const})));
 let s=createBattle({...base,enemyId:undefined,initialBoxes:boxes,initialTransformation:{character:'blue',scope:'stage'},enemyPattern:[{type:'heal',amount:0}],combatants:{...base.combatants,enemy:{...base.combatants.enemy,maxHp:1000,initialHp:1000}}});
 for(const col of [1,2,3,4]){const r=applyAction(s,{type:'drop',candidateId:`ceiling:${col}:0`});assert.equal(r.resolution!.events.filter(e=>e.type==='heal'&&e.source==='health').length,1);assert.equal(r.resolution!.events.filter(e=>e.type==='damage'&&e.source==='blue-transformation').length,1);s=applyAction(r.state,{type:'enemy'}).state;}
});
test('next content catalog matches metadata and preserves explicit policy boundaries',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/docs/game1_content_catalog_next.json',import.meta.url),'utf8'));const html=readFileSync(new URL('../public/docs/game1_content_catalog_next.html',import.meta.url),'utf8');
 assert.equal(data.revision,'1.12');assert.equal(data.skills.length,35);assert.ok(html.includes(data.revision));
 for(const id of normalSkillIds){const record=[...data.skills,...data.fixedPassives].find((s:{id:string})=>s.id===id);assert.equal(record.rewardAccess,skillCatalog[id].rewardAccess??'shared');assert.equal(record.initialRewardEligible.red,canReceiveSkillReward(createPlayerBuild('red'),id));assert.equal(record.initialRewardEligible.blue,canReceiveSkillReward(createPlayerBuild('blue'),id));}
 assert.equal(data.recoveryPolicy.reviewAxes.length,6);assert.ok(data.futureOnly.includes('将来案'));assert.ok(data.preserved.some((s:string)=>s.includes('回数上限なし')));
});

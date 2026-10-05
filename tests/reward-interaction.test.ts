import {rewardReviewFixture} from '../src/next/ui/rewardReviewFixture.ts';
import {encodeSave,decodeSave} from '../src/next/app/saveCheckpoint.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRewardSelection,planRewardInteraction,rewardSlotToken} from '../src/next/ui/rewardInteraction.ts';
import type {RewardInput,RewardSelection} from '../src/next/ui/rewardInteraction.ts';
import {rewardPanelHtml} from '../src/next/ui/rewardPresentation.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {trialFixture} from '../src/next/config.ts';
import {createSkill,createPlayerBuild} from '../src/next/core/playerBuild.ts';
import type {RewardOffer,RewardId} from '../src/next/app/rewards.ts';
const view={render(){},async animate(){}};
async function ready(full=false){const config=trialFixture('reward','blue','marujiro',1,'manual');const c=new BattleController(full?{...config,initialBuild:{...createPlayerBuild('blue'),slots:[createSkill('first-guard'),createSkill('charge')]}}:config,view,{run:{mode:'endless',rewards:true,rewardMode:'categories'}});await c.drop('ceiling:2:0');return c;}
function intent(offer:RewardOffer,type:RewardInput['type'],value?:string):RewardInput{return {type,value,offerId:offer.id,category:offer.category??'mixed'};}
test('category buttons are irreversible commands; previews and skip cannot bypass pending category',async()=>{
 const c=await ready(),offer=c.runSnapshot!.offer!,ui=emptyRewardSelection();
 for(const type of ['preview','confirm','slot','cancel','skip'] as const)assert.equal(planRewardInteraction(c.snapshot,offer,ui,intent(offer,type,'health')),null);
 const choose=planRewardInteraction(c.snapshot,offer,ui,intent(offer,'category','stats'))!;assert.deepEqual(choose.command,{kind:'category',category:'stats'});await c.chooseCategory(offer.id,'stats');
 assert.equal(planRewardInteraction(c.snapshot,c.runSnapshot!.offer!,ui,intent(offer,'category','skills')),null);
});
test('read-only card comparison and redraw do not alter checkpoint, HP, build, or RNG',async()=>{
 const c=await ready();await c.chooseCategory(c.runSnapshot!.offer!.id,'stats');const offer=c.runSnapshot!.offer!,before=JSON.stringify(c.exportCheckpoint());let ui=emptyRewardSelection();
 for(const id of [...offer.choices,...offer.choices].reverse()){const out=planRewardInteraction(c.snapshot,offer,ui,intent(offer,'preview',id))!;ui=out.ui;assert.equal(out.command,undefined);rewardPanelHtml(c.snapshot,offer,ui);}
 assert.equal(JSON.stringify(c.exportCheckpoint()),before);assert.equal(c.runSnapshot!.offer,offer);
});
test('stale offer, stale category, busy, mismatched confirm and unlisted candidate are rejected',async()=>{
 const c=await ready();await c.chooseCategory(c.runSnapshot!.offer!.id,'stats');const offer=c.runSnapshot!.offer!,ui:RewardSelection={selected:offer.choices[0]!,replacing:false,replacementSlot:null};
 for(const i of [{...intent(offer,'confirm',ui.selected!),offerId:'old'},{...intent(offer,'confirm',ui.selected!),category:'pending'},intent(offer,'preview','constructor'),intent(offer,'confirm','health')])assert.equal(planRewardInteraction(c.snapshot,offer,ui,i),null);
 assert.equal(planRewardInteraction(c.snapshot,offer,ui,intent(offer,'confirm',ui.selected!),true),null);
});
test('a full loadout fixed Health upgrade commits directly without replacing a free slot',async()=>{
 const c=await ready(true);await c.chooseCategory(c.runSnapshot!.offer!.id,'skills');const offer=c.runSnapshot!.offer!;assert.ok(offer.choices.includes('health'));
 const preview=planRewardInteraction(c.snapshot,offer,emptyRewardSelection(),intent(offer,'preview','health'))!;const confirm=planRewardInteraction(c.snapshot,offer,preview.ui,intent(offer,'confirm','health'))!;assert.deepEqual(confirm.command,{kind:'reward',id:'health'});const slots=c.snapshot.build!.slots;
 const [a,b]=await Promise.all([c.chooseReward(offer.id,'health'),c.chooseReward(offer.id,'health')]);assert.deepEqual([a,b],[true,false]);assert.equal(c.snapshot.build!.fixed.rank,2);assert.deepEqual(c.snapshot.build!.slots,slots);assert.equal(c.runSnapshot!.stage,2);
});
test('replacement preview requires an explicit valid free slot; cancellation preserves candidates and build',async()=>{
 const c=await ready(true);await c.chooseCategory(c.runSnapshot!.offer!.id,'skills');const offer=c.runSnapshot!.offer!,id=offer.choices.find(id=>!['health','first-guard','charge'].includes(id))!;assert.ok(id);const before=JSON.stringify(c.exportCheckpoint());
 let ui=planRewardInteraction(c.snapshot,offer,emptyRewardSelection(),intent(offer,'preview',id))!.ui;assert.equal(ui.replacing,true);
 assert.equal(planRewardInteraction(c.snapshot,offer,ui,intent(offer,'confirm',id)),null);for(const slot of ['-1','2','NaN','0.5',''])assert.equal(planRewardInteraction(c.snapshot,offer,ui,intent(offer,'slot',slot)),null);
 ui=planRewardInteraction(c.snapshot,offer,ui,{...intent(offer,'slot','1'),slotToken:rewardSlotToken(c.snapshot.build!,1)!})!.ui;ui=planRewardInteraction(c.snapshot,offer,ui,intent(offer,'cancel'))!.ui;assert.deepEqual(ui,emptyRewardSelection());assert.equal(JSON.stringify(c.exportCheckpoint()),before);
});
test('switching cards clears a replacement choice; restore keeps fixed offer but no transient selection',async()=>{
 const c=await ready(true);await c.chooseCategory(c.runSnapshot!.offer!.id,'skills');const offer=c.runSnapshot!.offer!;const old:RewardSelection={selected:offer.choices[1] as RewardId,replacing:true,replacementSlot:1};
 const next=planRewardInteraction(c.snapshot,offer,old,intent(offer,'preview','health'))!;assert.deepEqual(next.ui,{selected:'health',replacing:false,replacementSlot:null});
 const saved=c.exportCheckpoint();const restored=BattleController.restore(saved,view);await restored.start();assert.deepEqual(restored.runSnapshot!.offer,offer);assert.equal('rewardSelection' in saved,false);assert.equal('replacementSlot' in saved,false);
});

test('isolated full and long-name review fixtures are valid saveable starts, using real rewards',async()=>{
 for(const kind of ['full','long'] as const){const setup=rewardReviewFixture(kind);const c=new BattleController(setup.config,view,setup.options);await c.start();await c.drop('ceiling:2:0');const id=c.runSnapshot!.offer!.id;await c.chooseCategory(id,kind==='full'?'skills':'stats');assert.equal(c.runSnapshot!.offer!.choices.length,3);assert.ok(c.snapshot.build!.slots.every(Boolean));assert.deepEqual(decodeSave(encodeSave(c.exportCheckpoint(),1)).checkpoint,JSON.parse(JSON.stringify(c.exportCheckpoint())));if(kind==='full')assert.ok(c.runSnapshot!.offer!.choices.includes('health'));}
});

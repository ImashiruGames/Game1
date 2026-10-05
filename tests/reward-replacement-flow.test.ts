import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BattleController} from '../src/next/app/BattleController.ts';
import type {PersistenceHooks} from '../src/next/app/BattleController.ts';
import {decodeSave,encodeSave} from '../src/next/app/saveCheckpoint.ts';
import {trialFixture} from '../src/next/config.ts';
import {createPlayerBuild,createSkill} from '../src/next/core/playerBuild.ts';
import type {BattleState,PlayerBuild,SkillInstance} from '../src/next/core/types.ts';
import type {RewardId,RewardOffer} from '../src/next/app/rewards.ts';
import {emptyRewardSelection,planRewardInteraction,rewardSlotToken} from '../src/next/ui/rewardInteraction.ts';
import type {RewardInput,RewardSelection} from '../src/next/ui/rewardInteraction.ts';
import {rewardPanelHtml} from '../src/next/ui/rewardPresentation.ts';
const view={render(){},async animate(){}};
const fullBuild=():PlayerBuild=>({...createPlayerBuild('blue'),slots:[createSkill('first-guard'),createSkill('charge')]});
async function ready(build=fullBuild(),persistence?:PersistenceHooks){
 const c=new BattleController({...trialFixture('reward','blue','marujiro',1,'manual'),initialBuild:build},view,{run:{mode:'endless',rewards:true,rewardMode:'categories'}},persistence);
 await c.drop('ceiling:2:0');return c;
}
const intent=(offer:RewardOffer,type:RewardInput['type'],value?:string,slotToken?:string):RewardInput=>({type,value,slotToken,offerId:offer.id,category:offer.category??'mixed'});
const preview=(s:BattleState,o:RewardOffer,id:RewardId)=>planRewardInteraction(s,o,emptyRewardSelection(),intent(o,'preview',id))!.ui;
const selectSlot=(s:BattleState,o:RewardOffer,ui:RewardSelection,slot=1)=>planRewardInteraction(s,o,ui,intent(o,'slot',String(slot),rewardSlotToken(s.build!,slot)!))!.ui;
async function fullOffer(){const c=await ready();await c.chooseCategory(c.runSnapshot!.offer!.id,'skills');const offer=c.runSnapshot!.offer!;const id=offer.choices.find(id=>!['health','first-guard','charge'].includes(id))!;assert.ok(id);return {c,offer,id};}

test('full reward is category, card, slot, final confirm: four clicks with one acquisition',async()=>{
 const writes:string[]=[];const c=await ready(fullBuild(),{beforeAction(){},write(cp){writes.push(JSON.stringify(cp));},failed(e){throw e;}});
 const pending=c.runSnapshot!.offer!;const category=planRewardInteraction(c.snapshot,pending,emptyRewardSelection(),intent(pending,'category','skills'))!;
 assert.deepEqual(category.command,{kind:'category',category:'skills'});await c.chooseCategory(pending.id,'skills');
 const offer=c.runSnapshot!.offer!,id=offer.choices.find(id=>!['health','first-guard','charge'].includes(id))!;
 const saved=JSON.stringify(c.exportCheckpoint()),writeCount=writes.length,old=c.snapshot.build!;
 const card=planRewardInteraction(c.snapshot,offer,category.ui,intent(offer,'preview',id))!;
 assert.equal(card.command,undefined);assert.equal(card.ui.replacing,true);assert.equal(card.ui.replacementSlot,null);
 assert.equal(planRewardInteraction(c.snapshot,offer,card.ui,intent(offer,'confirm',id)),null);
 const slot=planRewardInteraction(c.snapshot,offer,card.ui,intent(offer,'slot','1',rewardSlotToken(old,1)!))!;
 assert.equal(slot.command,undefined);rewardPanelHtml(c.snapshot,offer,slot.ui);
 assert.equal(JSON.stringify(c.exportCheckpoint()),saved);assert.equal(writes.length,writeCount);
 const final=planRewardInteraction(c.snapshot,offer,slot.ui,intent(offer,'confirm',id))!;
 assert.deepEqual(final.command,{kind:'reward',id,slot:1});
 const results=await Promise.all([c.chooseReward(offer.id,id,1),c.chooseReward(offer.id,id,1)]);
 assert.deepEqual(results,[true,false]);assert.equal(c.runSnapshot!.stage,2);
 assert.deepEqual(c.snapshot.build!.fixed,old.fixed);assert.deepEqual(c.snapshot.build!.slots[0],old.slots[0]);assert.equal(c.snapshot.build!.slots[1]!.id,id);
 assert.ok(writes.length>writeCount);assert.deepEqual(decodeSave(encodeSave(c.exportCheckpoint(),1)).checkpoint,JSON.parse(JSON.stringify(c.exportCheckpoint())));
});

test('back and changed cards clear slots, while the same replacement card preserves its comparison',async()=>{
 const {c,offer,id}=await fullOffer(),saved=JSON.stringify(c.exportCheckpoint());
 let ui=selectSlot(c.snapshot,offer,preview(c.snapshot,offer,id));
 ui=planRewardInteraction(c.snapshot,offer,ui,intent(offer,'cancel'))!.ui;assert.deepEqual(ui,emptyRewardSelection());
 assert.equal(planRewardInteraction(c.snapshot,offer,ui,intent(offer,'confirm',id)),null);
 for(const next of [id,'health',id] as const){ui=planRewardInteraction(c.snapshot,offer,ui,intent(offer,'preview',next))!.ui;assert.equal(ui.replacementSlot,null);assert.equal(ui.replacementToken,undefined);}
 ui=selectSlot(c.snapshot,offer,ui);ui=planRewardInteraction(c.snapshot,offer,ui,intent(offer,'preview',id))!.ui;assert.equal(ui.replacementSlot,1);
 assert.equal(JSON.stringify(c.exportCheckpoint()),saved);assert.strictEqual(c.runSnapshot!.offer,offer);
 const restored=BattleController.restore(decodeSave(encodeSave(c.exportCheckpoint(),1)).checkpoint,view);await restored.start();
 assert.deepEqual(restored.runSnapshot!.offer,offer);assert.deepEqual(emptyRewardSelection(),{selected:null,replacing:false,replacementSlot:null});
 assert.doesNotMatch(saved,/replacementToken|replacementSlot|rewardSelection/);
});

test('stale rendered slot identity, omitted token, wrong index, offer, category, and busy are rejected',async()=>{
 const {c,offer,id}=await fullOffer(),ui=preview(c.snapshot,offer,id),token=rewardSlotToken(c.snapshot.build!,1)!;
 for(const bad of [undefined,'',`${token}:old`,rewardSlotToken(c.snapshot.build!,0)!])assert.equal(planRewardInteraction(c.snapshot,offer,ui,intent(offer,'slot','1',bad)),null);
 for(const value of ['-1','2','1.0','1e0','NaN',''])assert.equal(planRewardInteraction(c.snapshot,offer,ui,intent(offer,'slot',value,token)),null);
 const valid=intent(offer,'slot','1',token);
 for(const i of [{...valid,offerId:'old'},{...valid,category:'stats'}])assert.equal(planRewardInteraction(c.snapshot,offer,ui,i),null);
 assert.equal(planRewardInteraction(c.snapshot,offer,ui,valid,true),null);
 const picked=selectSlot(c.snapshot,offer,ui);assert.equal(planRewardInteraction(c.snapshot,offer,picked,intent(offer,'confirm',id),true),null);
});

test('final confirmation revalidates slot skill, rank, uses and occupation, not merely its index',async()=>{
 const {c,offer,id}=await fullOffer(),ui=selectSlot(c.snapshot,offer,preview(c.snapshot,offer,id));
 for(const changed of [createSkill('horizontal-slash'),createSkill('charge',2),{...createSkill('charge'),uses:0},null] as (SkillInstance|null)[]){
  const s:BattleState={...c.snapshot,build:{...c.snapshot.build!,slots:[c.snapshot.build!.slots[0],changed]}};
  assert.equal(planRewardInteraction(s,offer,ui,intent(offer,'confirm',id)),null);
  const html=rewardPanelHtml(s,offer,ui);assert.doesNotMatch(html,/data-reward-repeat="true"/);
 }
 const nowOwned:BattleState={...c.snapshot,build:{...c.snapshot.build!,slots:[c.snapshot.build!.slots[0],createSkill(id as SkillInstance['id'])]}};
 assert.equal(planRewardInteraction(nowOwned,offer,ui,intent(offer,'confirm',id)),null);
 assert.doesNotMatch(rewardPanelHtml(nowOwned,offer,ui),/data-reward-repeat="true"/);
});

test('first empty free slot and owned duplicate upgrades keep their existing core behavior',async()=>{
 for(const slots of [[null,null],[createSkill('first-guard'),null],[null,createSkill('first-guard')]] as PlayerBuild['slots'][]){
  const c=await ready({...createPlayerBuild('blue'),slots});await c.chooseCategory(c.runSnapshot!.offer!.id,'skills');const offer=c.runSnapshot!.offer!,id=offer.choices.find(id=>!['health','first-guard'].includes(id))!,empty=slots.indexOf(null);
  const ui=preview(c.snapshot,offer,id);assert.equal(ui.replacing,false);assert.deepEqual(planRewardInteraction(c.snapshot,offer,ui,intent(offer,'confirm',id))!.command,{kind:'reward',id});
  await c.chooseReward(offer.id,id);assert.equal(c.snapshot.build!.slots[empty]!.id,id);
 }
 const {c,offer}=await fullOffer();const fixed=c.snapshot.build!.fixed,slots=c.snapshot.build!.slots;const ui=preview(c.snapshot,offer,'health');
 assert.equal(ui.replacing,false);const html=rewardPanelHtml(c.snapshot,offer,ui);assert.doesNotMatch(html,/data-replace-preview/);assert.match(html,/もう一度で＋強化/);
 await c.chooseReward(offer.id,'health');assert.equal(c.snapshot.build!.fixed.id,fixed.id);assert.equal(c.snapshot.build!.fixed.rank,2);assert.deepEqual(c.snapshot.build!.slots,slots);
 const duplicate=await ready({...createPlayerBuild('blue'),slots:[createSkill('healing-potion'),createSkill('charge')]});
 const fake:RewardOffer={id:'preview-only',category:'skills',choices:['healing-potion']};const upgrade=preview(duplicate.snapshot,fake,'healing-potion');
 assert.equal(upgrade.replacing,false);assert.deepEqual(planRewardInteraction(duplicate.snapshot,fake,upgrade,intent(fake,'confirm','healing-potion'))!.command,{kind:'reward',id:'healing-potion'});
 assert.equal(duplicate.snapshot.build!.slots[0]!.uses,1);assert.match(rewardPanelHtml(duplicate.snapshot,fake,upgrade),/1回限り/);
});

test('stale max-rank or intrinsic Health offers are not actionable and skip remains legal',async()=>{
 const {c,offer,id}=await fullOffer();const ui=selectSlot(c.snapshot,offer,preview(c.snapshot,offer,id));
 assert.deepEqual(planRewardInteraction(c.snapshot,offer,ui,intent(offer,'skip'))!.command,{kind:'reward',id:null});
 const fullMax:BattleState={...c.snapshot,build:{...c.snapshot.build!,fixed:createSkill('health',2)}};
 assert.equal(planRewardInteraction(fullMax,offer,emptyRewardSelection(),intent(offer,'preview','health')),null);
 const red:BattleState={...c.snapshot,build:{...c.snapshot.build!,fixed:createSkill('grow-fire')}};
 assert.equal(planRewardInteraction(red,offer,emptyRewardSelection(),intent(offer,'preview','health')),null);
 await c.chooseReward(offer.id,null);assert.equal(c.runSnapshot!.stage,2);assert.deepEqual(c.snapshot.build,fullBuild());
});

test('same comparison screen retains three cards, reuses only free loadout slots, and carries stale guards',async()=>{
 const {c,offer,id}=await fullOffer();let ui=preview(c.snapshot,offer,id);let html=rewardPanelHtml(c.snapshot,offer,ui);
 assert.equal((html.match(/data-reward-preview=/g)||[]).length,3);assert.equal((html.match(/data-replace-preview=/g)||[]).length,2);
 assert.equal((html.match(/data-replace-token=/g)||[]).length,2);assert.match(html,/カテゴリ確定/);assert.match(html,/比較 → 獲得/);assert.match(html,/外す自由枠を選んで比較/);
 assert.doesNotMatch(html,/data-reward-repeat="true"/);assert.match(html,/class="loadout-slot is-fixed"/);
 ui=selectSlot(c.snapshot,offer,ui);html=rewardPanelHtml(c.snapshot,offer,ui);assert.match(html,/data-replace-preview="1" data-reward-repeat="true"/);
 assert.match(html,/外す 蓄勢/);assert.match(html,/獲得 /);
 const buttons=[...html.matchAll(/<button[^>]+>/g)].map(m=>m[0]);assert.ok(buttons.every(b=>b.includes(`data-offer-id="${offer.id}"`)&&b.includes('data-offer-category="skills"')));
 const css=readFileSync(new URL('../src/next/ui/rewardPresentation.css',import.meta.url),'utf8');assert.doesNotMatch(css,/\.is-replacing\s+\.build-reward-grid\{display:none/);assert.match(css,/\.has-replacement \.loadout-slot\{min-height:44px/);
 const main=readFileSync(new URL('../src/next/ui/rewardDialog.ts',import.meta.url),'utf8');assert.match(main,/slotToken:\s*b\.dataset\.replaceToken/);assert.doesNotMatch(main,/rewardSelection\.replacing\?'\[data-replace-preview="0"\]'/);
});

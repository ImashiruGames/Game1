import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleController} from '../src/next/app/BattleController.ts';
import {trialFixture} from '../src/next/config.ts';
import {createPlayerBuild,createSkill} from '../src/next/core/playerBuild.ts';
import {encodeSave,decodeSave} from '../src/next/app/saveCheckpoint.ts';
import {emptyRewardSelection,planRewardInteraction,isRewardKeyRepeat,rewardSlotToken,rewardSelectionToken} from '../src/next/ui/rewardInteraction.ts';
import type {RewardSelection,RewardInput} from '../src/next/ui/rewardInteraction.ts';
import type {RewardOffer} from '../src/next/app/rewards.ts';
import type {PlayerBuild} from '../src/next/core/types.ts';
import {rewardPanelHtml} from '../src/next/ui/rewardPresentation.ts';
const view={render(){},async animate(){}};
async function ready(category:'stats'|'skills',full=false){
 const cfg=trialFixture('reward','blue','marujiro',1,'manual');
 const c=new BattleController({...cfg,initialBuild:{...createPlayerBuild('blue'),slots:full?[createSkill('first-guard'),createSkill('charge')]:[null,null]}},view,{run:{mode:'endless',rewards:true,rewardMode:'categories'}});
 await c.drop('ceiling:2:0');await c.chooseCategory(c.runSnapshot!.offer!.id,category);return c;
}
const input=(o:RewardOffer,ui:RewardSelection,type:RewardInput['type'],value:string,repeat=false,slotToken?:string):RewardInput=>({offerId:o.id,category:o.category!,selectionToken:rewardSelectionToken(ui),type,value,repeat,slotToken});
test('a card first previews; a second activation of that selected card commits without a timer',async()=>{
 const c=await ready('stats'),o=c.runSnapshot!.offer!,id=o.choices[0]!,empty=emptyRewardSelection(),cp=JSON.stringify(c.exportCheckpoint());
 const a=planRewardInteraction(c.snapshot,o,empty,input(o,empty,'preview',id))!;assert.equal(a.command,undefined);assert.equal(JSON.stringify(c.exportCheckpoint()),cp);
 // No clock enters this planner: reading for any duration preserves the same selection.
 const b=planRewardInteraction(c.snapshot,o,a.ui,input(o,a.ui,'preview',id,true))!;
 assert.deepEqual(b.command,{kind:'reward',id});assert.equal(JSON.stringify(c.exportCheckpoint()),cp);
 const results=await Promise.all([c.chooseReward(o.id,id),c.chooseReward(o.id,id)]);assert.deepEqual(results,[true,false]);assert.equal(c.runSnapshot!.stage,2);
});
test('different cards select only; stale rendered selections cannot become confirmation',async()=>{
 const c=await ready('stats'),o=c.runSnapshot!.offer!,[a,b]=o.choices,empty=emptyRewardSelection();
 const old=input(o,empty,'preview',a!),ui=planRewardInteraction(c.snapshot,o,empty,old)!.ui;
 assert.equal(planRewardInteraction(c.snapshot,o,ui,old),null);
 assert.equal(planRewardInteraction(c.snapshot,o,ui,input(o,ui,'preview',b!,true)),null);
 const switched=planRewardInteraction(c.snapshot,o,ui,input(o,ui,'preview',b!))!;assert.equal(switched.command,undefined);assert.equal(switched.ui.selected,b);
 assert.equal(planRewardInteraction(c.snapshot,o,switched.ui,input(o,ui,'preview',a!,true)),null);
});
test('replacement selects the outgoing slot then confirms at that same slot',async()=>{
 const c=await ready('skills',true),o=c.runSnapshot!.offer!,id=o.choices.find(x=>!['health','first-guard','charge'].includes(x))!,empty=emptyRewardSelection();
 let ui=planRewardInteraction(c.snapshot,o,empty,input(o,empty,'preview',id))!.ui;
 const t=rewardSlotToken(c.snapshot.build!,1)!;
 const first=planRewardInteraction(c.snapshot,o,ui,input(o,ui,'slot','1',false,t))!;assert.equal(first.command,undefined);ui=first.ui;
 const card=planRewardInteraction(c.snapshot,o,ui,input(o,ui,'preview',id,true))!;assert.equal(card.command,undefined);assert.strictEqual(card.ui,ui);
 const final=planRewardInteraction(c.snapshot,o,ui,input(o,ui,'slot','1',true,t))!;assert.deepEqual(final.command,{kind:'reward',id,slot:1});
 const fixed=c.snapshot.build!.fixed,slot0=c.snapshot.build!.slots[0];
 assert.deepEqual(await Promise.all([c.chooseReward(o.id,id,1),c.chooseReward(o.id,id,1)]),[true,false]);
 assert.deepEqual(c.snapshot.build!.fixed,fixed);assert.deepEqual(c.snapshot.build!.slots[0],slot0);assert.equal(c.snapshot.build!.slots[1]!.id,id);
});
test('changed outgoing slot previews only and stale skill/rank/uses tokens reject final taps',async()=>{
 const c=await ready('skills',true),o=c.runSnapshot!.offer!,id=o.choices.find(x=>!['health','first-guard','charge'].includes(x))!,e=emptyRewardSelection();
 let ui=planRewardInteraction(c.snapshot,o,e,input(o,e,'preview',id))!.ui;
 ui=planRewardInteraction(c.snapshot,o,ui,input(o,ui,'slot','0',false,rewardSlotToken(c.snapshot.build!,0)!))!.ui;
 const changed=planRewardInteraction(c.snapshot,o,ui,input(o,ui,'slot','1',false,rewardSlotToken(c.snapshot.build!,1)!))!;assert.equal(changed.command,undefined);ui=changed.ui;
 for(const skill of [createSkill('charge',2),{...createSkill('charge'),uses:0},createSkill('healing-potion')]){
  const s={...c.snapshot,build:{...c.snapshot.build!,slots:[c.snapshot.build!.slots[0],skill] as PlayerBuild['slots']}};
  assert.equal(planRewardInteraction(s,o,ui,input(o,ui,'slot','1',true,ui.replacementToken!)),null);
 }
});
test('full-loadout Health upgrade confirms on its own card and preserves free slots',async()=>{
 const c=await ready('skills',true),o=c.runSnapshot!.offer!,e=emptyRewardSelection(),slots=c.snapshot.build!.slots;
 const ui=planRewardInteraction(c.snapshot,o,e,input(o,e,'preview','health'))!.ui;
 assert.deepEqual(planRewardInteraction(c.snapshot,o,ui,input(o,ui,'preview','health',true))!.command,{kind:'reward',id:'health'});
 await c.chooseReward(o.id,'health');assert.equal(c.snapshot.build!.fixed.rank,2);assert.deepEqual(c.snapshot.build!.slots,slots);
});
test('restore keeps category and exact candidates but requires a fresh first selection',async()=>{
 const c=await ready('stats'),o=c.runSnapshot!.offer!,e=emptyRewardSelection(),id=o.choices[0]!;
 const ui=planRewardInteraction(c.snapshot,o,e,input(o,e,'preview',id))!.ui;
 const restored=BattleController.restore(decodeSave(encodeSave(c.exportCheckpoint(),1)).checkpoint,view);await restored.start();
 assert.deepEqual(restored.runSnapshot!.offer,o);assert.equal(planRewardInteraction(restored.snapshot,o,e,input(o,ui,'preview',id,true)),null);
 assert.equal(planRewardInteraction(restored.snapshot,o,e,input(o,e,'preview',id))!.command,undefined);
});
test('cancel clears armed state and offered choices survive unchanged',async()=>{
 const c=await ready('stats'),o=c.runSnapshot!.offer!,e=emptyRewardSelection(),id=o.choices[0]!,before=JSON.stringify(c.exportCheckpoint());
 const ui=planRewardInteraction(c.snapshot,o,e,input(o,e,'preview',id))!.ui;
 const reset=planRewardInteraction(c.snapshot,o,ui,input(o,ui,'cancel',''))!.ui;assert.deepEqual(reset,e);
 assert.equal(planRewardInteraction(c.snapshot,o,reset,input(o,ui,'preview',id,true)),null);assert.equal(JSON.stringify(c.exportCheckpoint()),before);
});
test('presenter has no separate confirm and identifies the selected activation target',async()=>{
 const c=await ready('stats'),o=c.runSnapshot!.offer!,e=emptyRewardSelection(),id=o.choices[0]!;
 const empty=rewardPanelHtml(c.snapshot,o,e);assert.doesNotMatch(empty,/data-reward-confirm|data-reward-repeat="true"/);
 const ui=planRewardInteraction(c.snapshot,o,e,input(o,e,'preview',id))!.ui,html=rewardPanelHtml(c.snapshot,o,ui);
 assert.match(html,new RegExp(`data-reward-preview="${id}" data-reward-repeat="true"`));assert.match(html,/もう一度で獲得/);assert.doesNotMatch(html,/data-reward-confirm/);
 assert.ok([...html.matchAll(/<button[^>]+>/g)].every(x=>x[0].includes('data-reward-selection=')));
});

test('holding activation keys cannot confirm, but released keys and navigation are untouched',()=>{
 for(const key of ['Enter',' ']){assert.equal(isRewardKeyRepeat({key,repeat:true}),true);assert.equal(isRewardKeyRepeat({key,repeat:false}),false);}
 for(const key of ['Tab','Escape','ArrowRight'])assert.equal(isRewardKeyRepeat({key,repeat:true}),false);
});

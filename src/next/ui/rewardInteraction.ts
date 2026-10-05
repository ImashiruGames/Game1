import {isSkillReward,requiresReplacement} from '../app/rewards.ts';
import type {RewardCategory,RewardId,RewardOffer} from '../app/rewards.ts';
import {canReceiveSkillReward} from '../core/playerBuild.ts';
import type {BattleState,PlayerBuild} from '../core/types.ts';
export interface RewardSelection {readonly selected:RewardId|null;readonly replacing:boolean;readonly replacementSlot:number|null;readonly replacementToken?:string|null}
export const emptyRewardSelection=():RewardSelection=>({selected:null,replacing:false,replacementSlot:null});
export interface RewardInput {readonly type:'category'|'preview'|'confirm'|'slot'|'cancel'|'skip';readonly value?:string;readonly offerId:string;readonly category:string;readonly slotToken?:string;readonly repeat?:boolean;readonly selectionToken?:string}
// 描画時の選択に結び付け、古いDOMの入力を確定へ昇格させない。Bind activation to the rendered selection.
export function rewardSelectionToken(ui:RewardSelection):string{return JSON.stringify([ui.selected,ui.replacing,ui.replacementSlot,ui.replacementToken??null]);}
export function isRewardKeyRepeat(event:{readonly repeat:boolean;readonly key:string}):boolean{return event.repeat&&(event.key==='Enter'||event.key===' ');}
export type RewardCommand={kind:'category';category:RewardCategory}|{kind:'reward';id:RewardId|null;slot?:number};
/** UI-only identity for the exact skill shown in a free slot. It is never persisted. */
export function rewardSlotToken(build:PlayerBuild,slot:number):string|null{
 if(!Number.isSafeInteger(slot)||slot<0||slot>=build.slots.length)return null;
 const skill=build.slots[slot];return skill?`${skill.id}:${skill.rank}:${skill.uses??'-'}`:null;
}
export function currentRewardReplacement(build:PlayerBuild,ui:RewardSelection):boolean{
 return ui.replacing&&ui.replacementSlot!==null&&!!ui.replacementToken&&ui.replacementToken===rewardSlotToken(build,ui.replacementSlot);
}
/** 日本語: 表示だけの選択と確定を分離。No RNG, persistence or build mutations here. */
export function planRewardInteraction(state:BattleState,offer:RewardOffer,ui:RewardSelection,input:RewardInput,busy=false):{ui:RewardSelection;command?:RewardCommand}|null{
 if(busy||!state.build||input.offerId!==offer.id||input.category!==(offer.category??'mixed'))return null;
 if(input.type==='category'){
  if(offer.category!=='pending'||!['heal','stats','skills'].includes(input.value??''))return null;
  return {ui:emptyRewardSelection(),command:{kind:'category',category:input.value as RewardCategory}};
 }
 if(offer.category==='pending')return null;
 if(input.selectionToken!==undefined&&input.selectionToken!==rewardSelectionToken(ui))return null;
 if(input.repeat&&input.selectionToken!==rewardSelectionToken(ui))return null;
 if(input.type==='skip')return {ui:emptyRewardSelection(),command:{kind:'reward',id:null}};
 if(input.type==='preview'){
  const id=input.value as RewardId;
  if(!offer.choices.includes(id)||(isSkillReward(id)&&!canReceiveSkillReward(state.build,id)))return null;
  const replacement=requiresReplacement(state.build,id);
  if(input.repeat){
   if(ui.selected!==id||ui.replacing!==replacement)return null;
   return replacement?{ui}:{ui,command:{kind:'reward',id}};
  }
  // The selected replacement card stays selected; only its outgoing slot can commit.
  if(ui.selected===id&&ui.replacing===replacement)return {ui};
  return {ui:{selected:id,replacing:replacement,replacementSlot:null}};
 }
 if(!ui.selected||!offer.choices.includes(ui.selected))return null;
 if(input.type==='cancel')return {ui:emptyRewardSelection()};
 if(isSkillReward(ui.selected)&&!canReceiveSkillReward(state.build,ui.selected))return null;
 const replacement=requiresReplacement(state.build,ui.selected);
 // A changed loadout cannot silently turn a reviewed replacement into an acquisition or upgrade.
 if(ui.replacing!==replacement)return null;
 if(input.type==='slot'){
  if(!replacement||!/^\d+$/.test(input.value??''))return null;
  const slot=Number(input.value),token=rewardSlotToken(state.build,slot);
  if(!token||input.slotToken!==token)return null;
  if(input.repeat){
   if(ui.replacementSlot!==slot||!currentRewardReplacement(state.build,ui))return null;
   return {ui,command:{kind:'reward',id:ui.selected,slot}};
  }
  return {ui:{...ui,replacementSlot:slot,replacementToken:token}};
 }
 if(input.type==='confirm'){
  if(input.value!==ui.selected)return null;
  if(!replacement)return {ui,command:{kind:'reward',id:ui.selected}};
  if(!currentRewardReplacement(state.build,ui))return null;
  return {ui,command:{kind:'reward',id:ui.selected,slot:ui.replacementSlot!}};
 }
 return null;
}

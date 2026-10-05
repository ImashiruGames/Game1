import {applyAction} from '../core/index.ts';
import type {BattleAction,BattleState} from '../core/types.ts';

export type ForecastAction=Extract<BattleAction,{type:'drop'|'board-skill'|'instant-skill'}>;
export interface ActionForecast {
 readonly conversions?:number; readonly enemyLoss:number; readonly selfLoss:number; readonly healed:number;
 readonly nominalHeal:number; readonly damage:number; readonly reflection:number;
 readonly gaugeSpent?:number; readonly gaugeGained?:number; readonly typesCleansed?:number; readonly overkill:number; readonly result:'win'|'loss'|null;
}
/** 日本語: 選択した自分の1行動だけを純粋な遷移で読む。敵の次手・保存・音は実行しない。
 * English: Sum emitted effects once; reflection is already part of damage, never added twice.
 */
export function forecastAction(state:BattleState,action:ForecastAction):ActionForecast|null{
 if(state.actor!=='player'||!['drop','board-skill','instant-skill'].includes(action.type))return null;
 const applied=applyAction(state,action);if(!applied.accepted||!applied.resolution)return null;
 let enemyLoss=0,selfLoss=0,healed=0,nominalHeal=0,damage=0,reflection=0,gaugeSpent=0;
 for(const event of applied.resolution.events){
  if(event.type==='gauge-spent')gaugeSpent+=event.amount;
  if(event.type==='heal'&&event.target==='player'){healed+=event.amount;nominalHeal+=event.requestedAmount;}
  if(event.type!=='attack'&&event.type!=='damage'&&event.type!=='instant-kill'&&event.type!=='type-damage')continue;
  const actual=Math.max(0,Math.max(0,event.hpBefore)-Math.max(0,event.hpAfter));
  if(event.target==='enemy'){
   enemyLoss+=actual;damage+=event.damage;
   if(event.type==='damage'&&event.source==='blue-transformation')reflection+=event.damage;
  }else selfLoss+=actual;
 }
 // 日本語: 新しい使い切りのゲージ獲得と浄化も、実際の遷移結果で予告する。
 // English: Forecast actual gauge gain and cleansed types for the new consumables too.
 const item=action.type==='instant-skill'?state.build?.slots[action.slot]?.id:null;
 const extra=item==='capacitor'?{gaugeGained:Math.max(0,applied.state.gauge-state.gauge)}:item==='solvent'?{typesCleansed:state.boxes.filter(before=>before.type!=='normal'&&applied.state.boxes.some(after=>after.id===before.id&&after.type==='normal')).length}:{};
 const conversion=action.type==='board-skill'&&action.skillId==='ember'?{conversions:applied.resolution.events.reduce((sum,event)=>sum+(event.type==='boxes-converted'?event.boxIds.length:0),0)}:{};
 return {enemyLoss,selfLoss,healed,nominalHeal,damage,reflection,...conversion,...extra,...(gaugeSpent?{gaugeSpent}:{}),overkill:Math.max(0,damage-enemyLoss),result:applied.state.result?(applied.state.result.winner==='player'?'win':'loss'):null};
}
/** All minus values in the main line mean actual HP removed, even on overkill. */
export function forecastPrimary(view:ActionForecast):string{
 return [...(view.enemyLoss||view.gaugeGained===undefined&&view.typesCleansed===undefined?[`敵HP −${view.enemyLoss}`]:[]),...(view.gaugeGained!==undefined?[`ゲージ ＋${view.gaugeGained}`]:[]),...(view.typesCleansed!==undefined?[`浄化 ${view.typesCleansed}箱`]:[]),...(view.nominalHeal>0?[`回復 ＋${view.healed}`]:[]),...(view.selfLoss>0?[`自HP −${view.selfLoss}`]:[]),...(view.gaugeSpent?[`ゲージ −${view.gaugeSpent}`]:[]),...(view.result==='loss'?['敗北']:[])].join(' / ');
}
export function forecastSecondary(view:ActionForecast,location=''):string{
 return [location,...(view.nominalHeal>0?[`回復予定${view.nominalHeal}`]:[]),...(view.reflection>0?[`反射ダメ${view.reflection}`]:[]),...(view.overkill>0?[`超過${view.overkill}`]:[])].filter(Boolean).join(' · ')||'この行動のみ・敵の次手は含みません';
}
export function forecastDetailsHtml(view:ActionForecast|null):string{
 if(!view)return '';
 return `<section class="skill-card action-forecast"><h3>選択中の1行動の予告</h3><p>${forecastPrimary(view)}</p><p>攻撃の合計 ${view.damage}（うち青の反射 ${view.reflection}） / 敵の残りHPを超える分 ${view.overkill}</p><p>実回復 ${view.healed} / 回復予定 ${view.nominalHeal} / 上限で回復しない分 ${Math.max(0,view.nominalHeal-view.healed)}</p><p>HP減少と回復は別表示です。反射は攻撃合計に含まれます。敵の次の行動は含めていません。</p></section>`;
}

/** 日本語: 空振り・自滅も既存の確定予測に従って明示。技の可否や乱数は変えない。
 * English: Explain zero-target and lethal casts from the existing forecast without changing legality or RNG. */
export function emberForecastText(view:ActionForecast):{primary:string;secondary:string;confirm:string}{
 const count=view.conversions??0;
 return {primary:`自HP −${view.selfLoss} → 敵箱${count}個を自箱へ${view.result==='loss'?' · 敗北':''}`,secondary:view.result==='loss'?(count===0?'この行動で敗北 · 変換なし':'変換後、この行動で敗北します'):count===0?'対象なし · HPと1手を消費します':'ランダム変換 · 1手消費 · リンクは発動しません',confirm:view.result==='loss'?'敗北を承知で使う':count===0?'対象なしで使う':'火種を使う'};
}

import { defaultExperimentTuning } from './tuning.ts';
import type { BattleState, BattleEvent, Link } from './engine/types.ts';
/** 日本語: 条件は画面で見える現在盤面だけを読む。存在検査は全盤面。
 * English: Conditions read the current visible board; existence checks scan the whole board. */
export function bottomOwned(state: BattleState): number { return state.boxes.filter(b=>b.row===state.config.board.height-1&&b.owner==='player').length; }
export function ownsSquare(state: BattleState): boolean {
  const cells=new Set(state.boxes.filter(b=>b.owner==='player').map(b=>`${b.row},${b.col}`));
  return state.boxes.some(b=>b.owner==='player'&&cells.has(`${b.row},${b.col+1}`)&&cells.has(`${b.row+1},${b.col}`)&&cells.has(`${b.row+1},${b.col+1}`));
}
export function modifyLink(state: BattleState, link: Link, eligible: readonly Link[], amount: number, originId: string, unmitigated=amount): {amount:number;events:BattleEvent[]} {
  const id=state.config.experiment;
  if(!id)return {amount,events:[]};
  const first=eligible[0]===link;
  const t=state.config.experimentTuning??defaultExperimentTuning;
  let next=amount,condition=false,detail='';
  if(id==='A061'&&state.actor==='player') {condition=first;next=amount+(condition?Math.min(t.foundationCap,bottomOwned(state)):0);detail=`最下行の自箱${bottomOwned(state)}個 / 最初のリンク${first?'はい':'いいえ'}`;}
  else if(id==='A062'&&state.actor==='enemy'){condition=ownsSquare(state);next=Math.max(0,amount-(condition?t.ironwallReduction:0));detail=`自分の2×2 ${condition?'あり':'なし'}`;}
  else if(id==='A001'&&state.actor==='player'){condition=link.count===3;next=amount+(condition?t.exactThreeBonus:0);detail='実長がちょうど3';}
  else if(id==='A004'&&state.actor==='player'){condition=link===eligible.reduce((best,item)=>item.count>best.count?item:best,eligible[0]!);next=amount+(condition?t.focusBonus:0);detail='最大実長の先頭1軸';}
  else if(id==='A025'&&state.actor==='player'){condition=amount<t.minimumLinkDamage;next=Math.max(amount,t.minimumLinkDamage);detail='最終リンク攻撃の最低値';}
  else if(id==='A026'&&state.actor==='player'){condition=state.hp.enemy.current*4<=state.hp.enemy.max;next=amount+(condition?t.executeBonus:0);detail='攻撃直前の敵HPが最大1/4以下';}
  else if(id==='A028'&&state.actor==='player'){condition=state.hp.player.current*state.hp.enemy.max<state.hp.enemy.current*state.hp.player.max;next=amount+(condition?t.lowerHpBonus:0);detail='自分のHP割合が低い';}
  else if(id==='A030'&&state.actor==='player'){condition=first&&state.hp.player.current===state.hp.player.max;next=amount+(condition?t.fullHpBonus:0);detail='満タンで最初のリンク';}
  else if(id==='A035'&&state.actor==='player'){condition=eligible.length===1;next=condition?Math.floor(amount*t.singleLinkNumerator/t.singleLinkDenominator):amount;detail='リンクが1本だけ';}
  else if(id==='A039'&&state.actor==='enemy'){condition=amount>t.incomingCap;next=Math.min(amount,t.incomingCap);detail='軽減後のリンク損失を上限6に制限';}
  else if(id==='A041'&&state.actor==='enemy'){condition=Math.floor(unmitigated/t.fractionalReductionDivisor)>0;next=Math.max(0,amount-Math.floor(unmitigated/t.fractionalReductionDivisor));detail='軽減前の予定量の1/4切捨てを軽減';}
  else if(id==='A043'&&state.actor==='enemy'){const empty=Math.max(0,(state.build?.slots.filter(slot=>slot===null).length??2)-1);const reduction=Math.min(t.emptySlotCap,empty);condition=reduction>0;next=Math.max(0,amount-reduction);detail=`実験の装備枠を除く空き自由枠${empty}`;}
  else return {amount,events:[]};
  return {amount:next,events:[{type:'experiment',skill:id,phase:'primary-link',eligible:true,triggered:condition&&next!==amount,detail,amount:next-amount,originId}]};
}

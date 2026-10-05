import {boxTypeLabels,frozenRuleDescription,THORN,ownSquareCount} from '../core/boxTypes.ts';
import type {Box,BattleState} from '../core/types.ts';
/** 日本語: タイプは所有者の見た目と分離し、説明は現行ルールから生成。
 * English: Type is independent of ownership; describe current rules, including frozen run bonuses. */
export interface BoxTypeRow { readonly label:'効果'|'解除'|'対象外'; readonly text:string }
/** 日本語: 種類ごとに同じ見出し（効果・解除・対象外）で並べる。フローズンと絶対零度の違いは「解除」の行で比べられる。
 * English: Every type uses the same rows, so frozen vs absolute zero differ in the same "release" row. */
export function boxTypeRows(box:Box,state:BattleState):BoxTypeRow[]{
 const half=state.config.frozenRule==='half-melt-v1',unaffected:BoxTypeRow={label:'対象外',text:'形状スキル・回復・ゲージには影響しません。'};
 switch(box.type){
  case 'normal':return [{label:'効果',text:'追加効果はありません。'}];
  case 'shiny':return [{label:'効果',text:'含まれるリンク攻撃・形状スキルの攻撃と回復・リンクのゲージ量が2倍。複数含んでも2倍です。'},{label:'解除',text:'残り続けます。'}];
  case 'frozen':return half?[{label:'効果',text:'リンクに1個でも含まれると、そのリンクの攻撃力が半減（切り捨て）。複数でも半減は1回。'},{label:'解除',text:'そのリンクの攻撃後、通常タイプへ戻ります。'},unaffected]:[{label:'効果',text:'旧ルール：含まれる1個につきリンク攻撃力−1（最低0）。'},{label:'解除',text:'旧ルールでは溶けません。'},unaffected];
  case 'absolute-zero':return [{label:'効果',text:'リンクに1個でも含まれると、そのリンクの攻撃力が半減（切り捨て）。フローズンと重なっても半減は1回。'},{label:'解除',text:'攻撃しても溶けず、絶対零度のまま残ります。消去や通常化で対処します。'},unaffected];
  case 'poison':return [{label:'効果',text:'所有者の手番の終わりに、所有者へ1ダメージ。'},{label:'解除',text:'残り続けます。中立の箱では発生しません。'}];
  case 'deadly-poison':return [{label:'効果',text:'所有者の手番の終わりに、所有者へ2ダメージ。'},{label:'解除',text:'残り続けます。中立の箱では発生しません。'}];
  case 'rubble':return [{label:'効果',text:'真上に2箱積まれると崩れます。'},{label:'解除',text:'崩れると消えます。その落下では新しいリンクは発動しません。'}];
  case 'thorn':return [{label:'効果',text:`周囲8マスへ能動的に投入すると、投入した側に最大HPの${THORN.percentOfMaxHp}%（最低${THORN.minimumDamage}）ダメージ。リンクより先に発生。`},{label:'解除',text:'残り続けます。落下だけでは発動しません。'}];
 }
}
export function boxTypeInformation(box:Box,state:BattleState):{name:string;effect:string;context:string}{
 const owner=box.owner==='player'?'自分':box.owner==='enemy'?'敵':'中立';
 const effects={normal:'追加効果はありません。通常のリンク・スキルの対象になります。',shiny:'対象のリンク・形状スキルに1個でも含まれると、リンク攻撃・形状スキルの攻撃/回復・リンクゲージ量が2倍になります。複数含んでも倍率は2倍です。',frozen:frozenRuleDescription(state.config),'absolute-zero':'リンクに1個でも含まれると、リンク攻撃力が半減します（小数点以下切り捨て）。フローズンと合わせて半減は1回。攻撃後も溶けず、絶対零度のまま残ります。形状スキル・回復・ゲージには影響しません。',poison:'所有者の手番終了時、所有者に1ダメージ。投入ごとではなく、その手番の行動がすべて終わった後に発生します。','deadly-poison':'所有者の手番終了時、所有者に2ダメージ。投入ごとではなく、その手番の行動がすべて終わった後に発生します。',rubble:'同じ列のすぐ上2マスに箱が積まれると崩れます。その結果の落下では新しいリンクは発動しません。',thorn:`上下左右・斜めの8マスへ能動的に箱を投入すると、投入した側に最大HPの${THORN.percentOfMaxHp}%ダメージ。隣接するトゲ1個ずつ小数点以下切り捨て、最低${THORN.minimumDamage}。投入後、リンクより先に発生し、落下だけでは発動しません。`};
 let context=`${owner}の箱 · ${box.row+1}行${box.col+1}列`;
 if(box.type==='poison'||box.type==='deadly-poison'){
  if(box.owner==='neutral')context+='。中立の箱には所有者の手番がないため、毒ダメージは発生しません';
  const art=state.config.meta?.kitVersion===2&&state.build?.fixed.id==='poison-craft';
  if(art&&box.poisonSource==='player')context+=`。自分が付与した毒：毒盛り術により、自箱の2×2正方形の数だけ追加（現在＋${ownSquareCount(state.boxes,'player')}）`;
 }
 return {name:boxTypeLabels[box.type],effect:effects[box.type],context};
}

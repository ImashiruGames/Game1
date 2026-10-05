import {kitBoardDefinition,kitBoardForBalance} from '../core/kitBoards.ts';
import type {KitBoardDefinition} from '../core/kitBoards.ts';
import {gaugeDefinition} from '../core/gauge.ts';
import {IMASHIRU} from '../core/shiny.ts';
import {defaultTuning,tuningOf} from '../core/tuning.ts';
import type {GameTuning} from '../core/tuning.ts';
import type {BattleConfig,BoardSkillId} from '../core/types.ts';
import {CURRENT_KIT_BALANCE,LEGACY_KIT_BALANCE} from '../meta/kitBalance.ts';
import type {KitBalanceSnapshot} from '../meta/kitBalance.ts';
import {roster} from '../meta/roster.ts';
import type {RosterId} from '../meta/roster.ts';
import {kitBoardCatalog} from '../core/kitBoards.ts';
export function boardSkillName(id:BoardSkillId):string{return kitBoardCatalog[id]?.name??(id==='imashiru-insight'?'いま、知りたい！':id==='ember'?'ほむらの火種':'痛みはお互いに');}
/** 日本語: 戦闘中は保存済みの数値から説明する。English: Describe the frozen run, not today's defaults. */
function boardText(id:BoardSkillId,d:KitBoardDefinition|undefined,rules:GameTuning['board']):string {
 if(d){const description=id==='red-capture'?`自HP${d.hp}を先に支払い生存時だけ敵箱1個を自箱へ。タイプは維持。`:id==='silver-freeze'?'選んだ列の未凍結の敵箱を上から最大2個フローズンへ上書き。':id==='violet-poison'?'どく・げきどく以外の敵箱1個をどくへ上書き。自分を毒の付与者として記録。':id==='blue-freeze'?'未凍結の敵箱1個をフローズンへ上書き。':id==='imashiru-focus'?'輝きではない自箱1個をすぐ輝きへ上書き。次の投入予約は消費しません。':d.description;return `${description} ゲージ${d.gauge}・HP${d.hp}・通常行動1手。変更・消去・その後の落下ではリンクや形は発動しません。`;}
 if(id==='imashiru-insight')return `ゲージ${IMASHIRU.insightCost}・通常行動1手。次に成功する自箱の能動投入1個を輝きに。予約中は再使用不可。予約は投入成功まで保持します。`;
 if(id==='ember')return `自HP${rules.emberCost}を先に支払い生存時だけ敵箱をランダムに最大${rules.emberConversions}個自箱へ。タイプは維持。通常行動1手。変換や落下でリンク・形は発動しません。`;
 return `選んだ横一列を消去。消去前の自箱は敵へ／敵箱は自分へ。1個につき${rules.painPerBox}ダメージ。中立箱はダメージなし。通常行動1手。落下でリンク・形は発動しません。`;
}
export function boardInformation(config:Pick<BattleConfig,'meta'|'tuning'>,id:BoardSkillId):string{return boardText(id,kitBoardDefinition(config,id),tuningOf(config).board);}
export function currentBoardInformation(id:BoardSkillId):string{return boardText(id,kitBoardForBalance(CURRENT_KIT_BALANCE,id),defaultTuning.board);}

function effect(id:RosterId|undefined,newKit:boolean,character:BattleConfig['characterId'],b:KitBalanceSnapshot,t:GameTuning):string {
 if(id==='imashiru')return 'ピコーン閃いた！：自箱全部を即時に輝きへ上書き。発動した今の自手番が終わるまで自箱の能動投入も輝き。箱のタイプは手番後も残ります。輝きが発動するリンク・形に含まれるとダメージ・形の回復量・リンクのゲージ獲得が2倍。複数でも重複しません。';
 if(newKit){
  if(id==='mint')return `全点観測：この戦闘中角打ちのダメージ＋${b.mintShapeBonus}。`;
  if(id==='amber')return b.amber.mode==='link-gauge'?`旧・力の循環：発動した手番を含む${b.amber.ownTurns}自手番はリンクによる変身ゲージ獲得×${b.amber.multiplier}。ダメージは変わりません。戦闘終了で解除。`:`力の解放：発動した手番を含む${b.amber.ownTurns}自手番はリンクダメージ×${b.amber.multiplier}。形・毒・直接攻撃・回復・ゲージ獲得は変わりません。戦闘終了で解除。`;
  if(id==='violet')return `毒の雨：げきどく以外の敵箱を上の行から・同じ行なら左から最大${b.violetPoisonTargets}個げきどくへ上書き。1回だけ付与しタイプは手番後も残ります。対象がない時は使用不可。`;
  if(id==='silver')return `鋼の守り：バリアを${b.silverBarrier}にする（加算ではない）。敵のリンク・固定攻撃だけを軽減。この戦闘中使い切るまで持続。毒・トゲ・自己コスト・投入不能は防ぎません。満タンでは使用不可。`;
  if(id==='rose')return `横一閃：発動した今の自手番が終わるまで横リンクのダメージ＋${b.roseHorizontalBonus}。`;
 }
 return character==='blue'?'青の変化：この戦闘中回復予定量と同じダメージを敵へ。HP満タンで実回復0でも反応します。戦闘外の回復報酬は対象外。':`赤の変化：次の自手番開始から追加投入を${t.transformation.redBonusStarts}回。今の手番には追加しません。投入不能でもその回数は消費。残り回数は次の戦闘へ持ち越します。`;
}
function withCost(text:string,limits:{cost:number;cap:number}|null):string{return text+(limits?` ゲージ${limits.cost}・上限${limits.cap}。手動発動は通常行動を消費しません。`:'');}
export function formInformation(config:Pick<BattleConfig,'meta'|'tuning'|'characterId'>):string {const t=tuningOf(config);return withCost(effect(config.meta?.rosterId,config.meta?.kitVersion===2,config.characterId,config.meta?.kitBalance??LEGACY_KIT_BALANCE,t),gaugeDefinition(config.characterId,t));}
export function currentFormInformation(id:RosterId):string {const entry=roster[id];return withCost(effect(id,true,entry.archetype,CURRENT_KIT_BALANCE,defaultTuning),id==='imashiru'?{cost:IMASHIRU.transformationCost,cap:IMASHIRU.gaugeCap}:gaugeDefinition(entry.archetype));}

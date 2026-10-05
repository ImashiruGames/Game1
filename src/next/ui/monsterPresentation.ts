import {frozenRuleDescription} from '../core/boxTypes.ts';
import { tuningOf } from '../core/tuning.ts';
import { getEnemyDefinition } from '../core/monsters.ts';
import { monsterBehavior } from '../core/monsterBehavior.ts';
import type { BattleState, EnemyId } from '../core/types.ts';
/** 日本語: 表示データを出現抽選/効果判定と分離。English: UI prose never drives encounters or effects. */
export const monsterNotes:Readonly<Record<EnemyId,string>> = {
 devilmon:'ちょうど4連の敵リンクごとにタイプなしの自箱1個をランダムでどくにします。5連以上では発動しません。対象がなければ不発。',
 shashark:'3 / 4 / 5連以上で4 / 12 / 20の基礎火力。通常投入だけを行います。',
 hyokuru:'7回目の自手番は投入せずランダムな自箱1個を絶対零度にします。絶対零度はリンクに含まれると攻撃が半減し攻撃しても溶けません。',
 hanabell:'敵箱で十字形を作るとヘルスと同じく15回復します（輝きを含むと2倍）。敵の十字の中心を先に埋めておくのが対策です。',
 'zeroguard-x':'高いHPを持つ90階以降の守護者。5回目の自手番は投入せずランダムな放出点からガレキの中立箱を2個落とします。ガレキは上に2箱積まれると崩れます。',
 hoshimimi:'4回目の自手番に輝きの敵箱を投入します。その箱を含む敵のリンクはダメージ2倍。輝き箱の周りで敵のリンクを作らせないことが大切です。',
 mokousagi:'HPが高く攻撃は控えめ。5回目の自手番は投入せずランダムな自箱1個を中立箱に変えます（タイプはそのまま）。こちらのリンクを途切れさせてきます。',
 hinobou:'HPが半分以下になると燃え上がりその戦闘中ずっとリンク攻撃が＋3。一気に削り切るか半分の手前で態勢を整えるかを選びます。',
 biribiriman:'3連は弱いが4連15・5連以上25と大きく跳ね上がる深層の拳闘家。敵の4連を作らせないことが最優先です。',
 marujiro:'高いHPと控えめなリンク火力。通常投入だけを行います。',
 hikikizan:'4連から急に高火力になる通常攻撃型。長い敵列に注意。',
 merarun:'3・4・5連で段階的に火力が上がる通常攻撃型。特殊効果はありません。',
 nigirin:'5回目の自手番は投入せず回復します。回復量は今回の調整値を使います。',
 'twin-core':'短い3連が得意な通常攻撃型。現在の火力は上の表で確認できます。特殊効果はありません。',
 'needle-core':'低めのHP・5連以上が得意な通常攻撃型。長い敵列を作らせないことが大切です。',
 'frost-core':'4回目の自手番は投入せず自箱を最大1個フローズンにします。',
 'thorn-core':'4回目の自手番は通常箱の代わりにトゲ箱を1個投入します。',
 'rime-crown':'3回目の自手番は投入せず自箱を最大2個フローズンにします。氷結だけに特化した上位種。',
 'briar-wheel':'3回目の自手番にトゲ箱を1個投入します。トゲを作る間隔が短い上位種。',
 'speed-core':'5回目の自手番に固定攻撃その後に通常投入します。',
 'mother-core':'通常の7手周期とHP20%以下の2手周期を持つ大ボスです。',
};
export function monsterDetailsHtml(state:BattleState):string {
 const id=state.config.enemyId;if(!id)return '';
 const behavior=monsterBehavior(id),tuning=tuningOf(state.config),definition=getEnemyDefinition(id,tuning);
 const note=id==='nigirin'?`${definition.healEveryOwnTurns}回目の自手番は投入せず${definition.healAmount}回復します。`:id==='speed-core'?`${tuning.bosses.speedPulseEvery}回目の自手番に固定${tuning.bosses.speedPulseDamage+(state.config.enemyFixedDamageBonus??0)}ダメージその後に通常投入します。`:id==='mother-core'?`通常の7手周期とHP${tuning.bosses.motherThresholdPercent}%以下の2手周期を持つ大ボスです。`:monsterNotes[id];
 const detail=behavior?.skill==='freeze'?'上の行から同じ行なら左から未凍結の自箱を選び、タイプを上書きします。対象がなければ何もせず手番終了。'+frozenRuleDescription(state.config)+'消去・通常化などで対処できます。':behavior?.skill==='thorn'?'トゲの周囲8マスへ能動投入すると投入した側が最大HPの2%（切り捨て・最低1）をトゲ1個ごとに受けます。敵自身も被害を受けます。近くを避けるか箱を消去・通常化できます。投入不能時は通常と同じ代替攻撃です。':'';
 return `<section class="skill-card"><h3>この敵の特徴</h3><p>${note}</p>${detail?`<p>${detail}</p>`:''}</section>`;
}

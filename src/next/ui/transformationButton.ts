import {canManualTransform} from '../core/transformations.ts';
import {gaugeDefinition} from '../core/gauge.ts';
import {tuningOf} from '../core/tuning.ts';
import type {BattleState} from '../core/types.ts';

// 日本語: 発光は実際の操作可否に従う。満充填だけでは使用可能と表示しない。
// English: Highlight only an actionable transformation, never a full gauge alone.
export function transformationButton(state:BattleState,interactive:boolean):string {
 const cost=gaugeDefinition(state.config.characterId,tuningOf(state.config))?.cost;
 const ready=interactive&&canManualTransform(state);
 const reason=ready?'変化可能！':state.transformation?'変化中':state.result?'戦闘終了':state.actor!=='player'?'相手の手番':!interactive?'操作待ち':state.config.strategy?.transformation!=='manual-charge'?'自動変化':cost!==undefined&&state.gauge<cost?'ゲージ不足':'条件未達';
 // 日本語: 可視文言は依頼された短い状態だけに絞り、説明を独断で追加しない。
 // English: Keep visible copy to requested short states; do not add unsolicited explanations.
 const visible=ready?'変化可能！':state.transformation?'変化中':cost!==undefined&&state.gauge<cost?'ゲージ不足':'';
 return `<button data-transform="true" class="transform-button" data-ready="${ready}" aria-label="変化する · ${reason}" ${ready?'':'disabled'}><span>変化する</span>${visible?`<small>${visible}</small>`:''}</button>`;
}

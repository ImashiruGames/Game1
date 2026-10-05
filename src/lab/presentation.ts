import type { BattleState } from './engine/types.ts';
/** 日本語: 残り開始回数と、すでに始まった現在手番を区別して表示。
 * English: Distinguish future bonus starts from the current already-started turn. */
export function transformationStatus(state:Pick<BattleState,'transformation'|'actor'|'playerTurnStarted'>):{label:string;detail:string;active:boolean} {
 const form=state.transformation;
 if(!form)return{label:'通常形態',detail:'',active:false};
 if(form.character==='blue')return{label:'青の変化中 · この戦闘中',detail:'回復予定量と同じダメージを敵へ与える',active:true};
 if(form.remainingStarts===0)return{label:'赤の変化中 · この手番で終了',detail:'この手番の追加投入は完了。通常行動を終えると戻る',active:true};
 if(state.actor==='player'&&!state.playerTurnStarted)return{label:`赤の変化中 · 追加投入あと${form.remainingStarts}回`,detail:'この手番の追加投入待ち（残り回数に含む）',active:true};
 if(state.actor==='player')return{label:`赤の変化中 · 次回の追加投入あと${form.remainingStarts}回`,detail:'今手番の追加投入は完了。通常行動を選べる',active:true};
 return{label:`赤の変化中 · 追加投入あと${form.remainingStarts}回`,detail:'次の自分の手番開始に追加投入',active:true};
}

import type { ExperimentEvent } from './model.ts';
/** 日本語: 会心ログのamountは加算値ではなく倍率。English: Critical amount is a multiplier, never a flat bonus. */
export function experimentAmountLabel(event:ExperimentEvent):string {
 if(event.skill==='A057'&&event.phase==='origin-roll')return `倍率 ×${event.amount}`;
 return `効果 ${event.amount>0?'+':''}${event.amount}`;
}

/** 日本語: 現在数は次の投入後の加算を予言しない。English: The current floor count is not a post-placement prediction. */
export function foundationStatus(state:Pick<BattleState,'boxes'|'config'>):string {
 const count=state.boxes.filter(box=>box.owner==='player'&&box.row===state.config.board.height-1).length;
 const cap=state.config.experimentTuning?.foundationCap??3;
 return `現在：最下行の自箱${count}個 / 加算は配置後に確定（最大＋${cap}）`;
}

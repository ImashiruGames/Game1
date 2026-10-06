import {boxPowerStatuses} from '../core/boxPowerStatus.ts';
import type {BattleState,Box} from '../core/types.ts';
// 日本語: 共通の小さな矢印を左右に分け、核・タイプ枠を保つ。状態名は箱詳細と読み上げへ。
// English: Shared small arrows occupy opposite sides, preserving the owner core and type frame; details and accessible names identify each status.
export function boxPowerStatusHtml(state:BattleState,box:Box):string{return boxPowerStatuses(state,box).map(status=>`<span class="box-power-up ${status==='火力アップ'?'foundation-up':'defense-up'}" aria-hidden="true">↑</span>`).join('');}
export function boxPowerStatusLabel(state:BattleState,box:Box):string{return boxPowerStatuses(state,box).map(status=>`・状態：${status}`).join('');}

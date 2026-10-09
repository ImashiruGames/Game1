import {EXTRA_BOARDS,UNLOCK_BOARDS,NATIVE_BOARDS} from './kits.ts';
import type {RosterId} from './roster.ts';
export const BOARD_UNLOCK_COSTS=[3,10,25] as const;
/** 日本語: 現行の並び順で一つずつ解放。未実装の3個目を作ったり、空欄の代金を取ったりしない。
 * English: Unlock existing skills in their current order; never invent or charge for a missing third skill. */
export function boardUnlockStages(id:RosterId,revised=true){const skills=[...(EXTRA_BOARDS[id]?[EXTRA_BOARDS[id]!]:[]),...(id==='violet'&&!revised?['violet-venom','violet-sting'] as const:UNLOCK_BOARDS[id])];return BOARD_UNLOCK_COSTS.map((cost,index)=>({rank:index+1,cost,skill:skills[index]??null}));}
export function sequentialBoardChoices(id:RosterId,rank:number,revised=true){return [NATIVE_BOARDS[id],...boardUnlockStages(id,revised).filter(s=>s.rank<=rank&&s.skill!==null).map(s=>s.skill!)];}
export function boardUnlockCost(rank:number){if(!Number.isInteger(rank)||rank<0||rank>=3)throw new Error('盤面スキルの解放上限です');return BOARD_UNLOCK_COSTS[rank]!;}

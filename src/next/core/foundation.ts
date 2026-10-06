import {activeSkillValue} from './playerBuild.ts';
import type {BattleState,Box} from './types.ts';
// 日本語: タイプ・保存済みstatusとは別の派生状態。所有者・最下段・現装備から毎回求め、残留させない。
// English: Derive this status separately from type and saved status; ownership, bottom row and current equipment determine it afresh.
export function foundationBox(state:BattleState,box:Box):boolean{return activeSkillValue(state,'foundation')>0&&box.owner==='player'&&box.row===state.config.board.height-1&&state.boxes.some(b=>b.id===box.id&&b.owner===box.owner&&b.row===box.row&&b.col===box.col);}
export function foundationBonus(state:BattleState):number{return state.boxes.filter(b=>b.owner==='player'&&b.row===state.config.board.height-1).length*activeSkillValue(state,'foundation');}

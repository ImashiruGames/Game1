import {sampleUniformIndex} from './random.ts';
import {assignBoxType} from './boxTypes.ts';
import { freeze } from './immutable.ts';
import type { BattleState, EnemyId, EnemyIntent } from './types.ts';
/** 日本語: 一体一テーマ。上位種は対象数/周期だけを変え、能力を積み重ねない。
 * English: One readable theme per monster; elites change count/cadence, not stacked mechanics. */
export const monsterBehaviors = freeze({
  'frost-core': { every:4, skill:'freeze', count:1 },
  'thorn-core': { every:4, skill:'thorn', count:1 },
  'rime-crown': { every:3, skill:'freeze', count:2 },
  'briar-wheel': { every:3, skill:'thorn', count:1 },
} as const);
export function monsterBehavior(id:EnemyId|undefined) { return id && id in monsterBehaviors ? monsterBehaviors[id as keyof typeof monsterBehaviors] : undefined; }
export function freezeTargets(state:BattleState,count:number) {
  return state.boxes.filter(b=>b.owner==='player'&&b.type!=='frozen').sort((a,b)=>a.row-b.row||a.col-b.col).slice(0,count);
}
/** Pure schedule: inspection never spends RNG or writes the board. Freeze replaces the normal drop. */
export function monsterIntent(state:BattleState):EnemyIntent|null {
 const behavior=monsterBehavior(state.config.enemyId);if(!behavior)return null;
 if((state.enemyTurnCount+1)%behavior.every!==0)return freeze({type:'drop'});
 return freeze({type:'sequence',steps:behavior.skill==='freeze'?[{type:'freeze',count:behavior.count}]:[{type:'drop',boxType:'thorn'}]});
}

/** 日本語: 能動投入の正確な4連・各軸で1回。タイプなしのみ、付与者は敵。
 * English: Exact-four active links only, once per axis; never overwrite types or consume RNG without a target. */
export function devilmonFourLink(state:BattleState):import('./types.ts').BattleTransition {
 if(state.config.enemyId!=='devilmon')return {state,events:[]};
 const targets=state.boxes.filter(b=>b.owner==='player'&&b.type==='normal').sort((a,b)=>a.row-b.row||a.col-b.col);
 if(!targets.length)return {state,events:[]};
 const draw=sampleUniformIndex(state.rngState,targets.length),id=targets[draw.index]!.id;
 return {state:{...state,rngState:draw.rngState,boxes:state.boxes.map(b=>b.id===id?assignBoxType(b,'poison','enemy'):b)},events:[{type:'enemy-box-changed',boxIds:[id],boxType:'poison'}]};
}

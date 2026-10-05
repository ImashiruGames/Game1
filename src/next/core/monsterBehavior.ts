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
  // 日本語: 深層。特別な手番は通常投入の代わり（ホシミミだけは投入そのものが輝き）。
  // English: Deep floors. Special turns replace the drop, except Hoshimimi whose drop itself is shiny.
  hyokuru: { every:7, skill:'absolute-zero', count:1 },
  hoshimimi: { every:4, skill:'shiny', count:1 },
  mokousagi: { every:5, skill:'neutralize', count:1 },
  'zeroguard-x': { every:5, skill:'rubble-rain', count:2 },
} as const);
/** 日本語: 反応・常時型（周期なし）。English: Reactive/passive deep traits without a schedule. */
export const deepTraits = freeze({ hanabellCrossHeal: 15, hinobouRageBonus: 3 } as const);
export function hinobouRage(state:BattleState):boolean { return state.config.enemyId==='hinobou'&&state.hp.enemy.current*2<=state.hp.enemy.max; }
export function monsterBehavior(id:EnemyId|undefined) { return id && id in monsterBehaviors ? monsterBehaviors[id as keyof typeof monsterBehaviors] : undefined; }
export function freezeTargets(state:BattleState,count:number) {
  return state.boxes.filter(b=>b.owner==='player'&&b.type!=='frozen').sort((a,b)=>a.row-b.row||a.col-b.col).slice(0,count);
}
/** Pure schedule: inspection never spends RNG or writes the board. Freeze replaces the normal drop. */
export function monsterIntent(state:BattleState):EnemyIntent|null {
 const behavior=monsterBehavior(state.config.enemyId);if(!behavior)return null;
 if((state.enemyTurnCount+1)%behavior.every!==0)return freeze({type:'drop'});
 const steps:import('./types.ts').EnemyStep[]=behavior.skill==='freeze'?[{type:'freeze',count:behavior.count}]:behavior.skill==='thorn'?[{type:'drop',boxType:'thorn'}]:behavior.skill==='shiny'?[{type:'drop',boxType:'shiny'}]:behavior.skill==='absolute-zero'?[{type:'absolute-zero',count:behavior.count}]:behavior.skill==='neutralize'?[{type:'neutralize',count:behavior.count}]:Array.from({length:behavior.count},()=>({type:'rubble-drop'} as const));
 return freeze({type:'sequence',steps});
}

/** 日本語: ランダムに自箱を選ぶ（RNG消費は対象があるときだけ）。English: Pick distinct random player boxes; RNG is used only when targets exist. */
export function randomPlayerBoxes(state:BattleState,count:number,eligible:(b:import('./types.ts').Box)=>boolean):{ids:string[];rngState:number} {
 const pool=state.boxes.filter(b=>b.owner==='player'&&eligible(b)).sort((a,b)=>a.row-b.row||a.col-b.col).map(b=>b.id),ids:string[]=[];let rng=state.rngState;
 while(ids.length<count&&pool.length){const draw=sampleUniformIndex(rng,pool.length);rng=draw.rngState;ids.push(pool.splice(draw.index,1)[0]!);}
 return {ids,rngState:rng};
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

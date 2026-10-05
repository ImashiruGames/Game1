import type {BattleState} from './types.ts';
export const IMASHIRU={insightCost:30,transformationCost:200,gaugeCap:300,multiplier:2,rounding:'floor-once',duration:'activation-own-turn'} as const;
/** 日本語: その発動に含まれる輝き箱の有無だけを見る。1個以上なら2倍、複数でも重複しない。
 * English: Double once if a participating box is shiny. Multiple shiny boxes never stack.
 * Neither passive conversion nor unrelated boxes produce an effect or consume RNG. */
export function shinyAmount(state:Pick<BattleState,'boxes'>,ids:readonly string[],base:number):number {const members=new Set(ids),count=state.boxes.filter(b=>b.type==='shiny'&&members.has(b.id)).length;if(!count)return base;return Math.min(Math.floor(Number.MAX_SAFE_INTEGER/8),Math.floor(base*IMASHIRU.multiplier));}

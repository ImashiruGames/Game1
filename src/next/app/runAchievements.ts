import type { BattleState, Resolution } from '../core/types.ts';
/** 日本語: 実際に失った敵HPだけを同じ自手番内で合算。敵手番の毒・過剰ダメージは対象外。
 * English: Count actual enemy HP lost during one player turn, including bonus drops and direct effects.
 * Only new versioned departures create this ledger; old checkpoint bytes and historical achievements stay untouched. */
export interface RunAchievements { readonly version:1; readonly turnKey:string|null; readonly turnDamage:number; readonly bestTurnDamage:number; readonly highestMaxHp:number }
export function newRunAchievements():RunAchievements{return {version:1,turnKey:null,turnDamage:0,bestTurnDamage:0,highestMaxHp:0};}
export function trackRunAction(previous:RunAchievements,before:BattleState,after:BattleState,resolution:Resolution,stage:number):RunAchievements {
 let next={...previous,highestMaxHp:Math.max(previous.highestMaxHp,after.hp.player.max)};
 if(resolution.actor!=='player')return next;
 const key=`${stage}:${before.turn}`;
 const damage=resolution.events.reduce((sum,event)=>sum+('target' in event&&event.target==='enemy'&&'hpBefore' in event&&'hpAfter' in event?Math.max(0,Math.max(0,event.hpBefore)-Math.max(0,event.hpAfter)):0),0);
 const turnDamage=(previous.turnKey===key?previous.turnDamage:0)+damage;
 return {...next,turnKey:key,turnDamage,bestTurnDamage:after.actor==='enemy'||after.result?Math.max(previous.bestTurnDamage,turnDamage):previous.bestTurnDamage};
}

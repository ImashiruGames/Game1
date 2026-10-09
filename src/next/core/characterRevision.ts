import type {BattleConfig,BattleState,BattleTransition} from './types.ts';
import {assignBoxType} from './boxTypes.ts';
import {sampleUniformIndex} from './random.ts';
export const CHARACTER_REVISION=1 as const;
export const revisedCharacters=(config:Pick<BattleConfig,'meta'>):boolean=>config.meta?.characterRevision===CHARACTER_REVISION;
export const violetProtected=(state:BattleState):boolean=>revisedCharacters(state.config)&&state.transformation?.character==='violet';
export const protectedDamage=(state:BattleState,target:'player'|'enemy',amount:number):number=>target==='player'&&violetProtected(state)?0:amount;
export function poisonRandomEnemy(state:BattleState,type:'poison'|'deadly-poison'):BattleTransition {
 const targets=state.boxes.filter(b=>b.owner==='enemy'&&b.type!=='poison'&&b.type!=='deadly-poison');
 if(!targets.length)return {state,events:[]};
 const roll=sampleUniformIndex(state.rngState,targets.length),id=targets[roll.index]!.id;
 return {state:{...state,rngState:roll.rngState,boxes:state.boxes.map(b=>b.id===id?assignBoxType(b,type,'player'):b)},events:[{type:'kit-board-changed',boxIds:[id]}]};
}
export function completeComboTurn(state:BattleState):BattleTransition {
 if(!revisedCharacters(state.config)||state.build?.fixed.id!=='combo-unit')return {state,events:[]};
 const streak=state.comboActivated?(state.comboStreak??0)+1:0,award=streak>0&&streak%3===0;
 return {state:{...state,comboStreak:streak,comboActivated:false,...(award?{build:{...state.build,power:{...state.build.power,4:state.build.power[4]+1}}}:{})},events:award?[{type:'power-boost',tier:4,amount:1,boxIds:[],source:'combo-unit'}]:[]};
}

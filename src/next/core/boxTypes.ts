import {settleBoxes} from './board.ts';
import {damageHp} from './combatEffects.ts';
import {gainGauge} from './gauge.ts';
import {tuningOf} from './tuning.ts';
import type {Actor,BattleState,BattleTransition,BoardDefinition,Box} from './types.ts';
/** 日本語: 所有者とは独立した単一タイプ。付与は上書き。English: Exactly one type; assignment replaces it. */
export const boxTypeIds=['normal','shiny','frozen','absolute-zero','poison','deadly-poison','rubble','thorn'] as const;
export const THORN={percentOfMaxHp:2,minimumDamage:1,rounding:'floor-per-thorn',timing:'after-insertion-before-shape-link'} as const;
/** 日本語: 新トゲ（owner-safe-v2）。投入した側と同じ所有者のトゲは無害。上下左右は5%、斜めは1%。各トゲごとに切り捨て・最低1。中立のトゲは誰にでも反応。
 * English: owner-safe-v2 thorns. Same-owner thorns are harmless; orthogonal 5%, diagonal 1%; floor per thorn, minimum 1. Neutral thorns affect anyone. */
export const THORN_V2={orthogonalPercent:5,diagonalPercent:1,minimumDamage:1} as const;
export function thornDamage(config:BattleState['config'],maxHp:number,thorn:Box,inserted:Box,actor:'player'|'enemy'):number{
 if(config.thornRule!=='owner-safe-v2')return Math.max(THORN.minimumDamage,Math.floor(maxHp*THORN.percentOfMaxHp/100));
 if(thorn.owner===actor)return 0;
 const diagonal=thorn.row!==inserted.row&&thorn.col!==inserted.col;
 return Math.max(THORN_V2.minimumDamage,Math.floor(maxHp*(diagonal?THORN_V2.diagonalPercent:THORN_V2.orthogonalPercent)/100));
}
export type BoxType=typeof boxTypeIds[number];
export const boxTypeLabels:Record<BoxType,string>={normal:'通常',shiny:'輝き',frozen:'フローズン','absolute-zero':'絶対零度',poison:'どく','deadly-poison':'げきどく',rubble:'ガレキ',thorn:'トゲ'};
export function assignBoxType(box:Box,type:BoxType,source?:Actor):Box{const {poisonSource:_source,...rest}=box;return {...rest,type,...((type==='poison'||type==='deadly-poison')&&source?{poisonSource:source}:{})};}
export function ownSquareCount(boxes:readonly Box[],owner:Actor):number{const cells=new Set(boxes.filter(b=>b.owner===owner).map(b=>`${b.row}:${b.col}`));let count=0;for(const b of boxes)if(b.owner===owner&&cells.has(`${b.row}:${b.col+1}`)&&cells.has(`${b.row+1}:${b.col}`)&&cells.has(`${b.row+1}:${b.col+1}`))count++;return count;}
export function poisonDamageSummary(state:BattleState,actor:Actor):{boxes:number;base:number;bonus:number;squares:number;damage:number}{const targets=state.boxes.filter(b=>b.owner===actor&&(b.type==='poison'||b.type==='deadly-poison')),squares=state.config.meta?.kitVersion===2&&state.build?.fixed.id==='poison-craft'?ownSquareCount(state.boxes,'player'):0,base=targets.reduce((n,b)=>n+(b.type==='poison'?1:2),0),bonus=targets.filter(b=>b.poisonSource==='player').length*squares;return {boxes:targets.length,base,bonus,squares,damage:base+bonus};}
export function frozenPenalty(boxes:readonly Box[],ids:readonly string[]):number{const members=new Set(ids);return boxes.filter(b=>b.type==='frozen'&&members.has(b.id)).length;}
/** Poison is one own-turn-end settlement after the entire action, never per insertion. */
export function resolvePoisonTurnEnd(state:BattleState,actor:Actor):BattleTransition {const amount=poisonDamageSummary(state,actor).damage;if(!amount||state.hp[actor].current<=0)return {state,events:[]};const change=damageHp(state.hp[actor],amount),changed={...state,hp:{...state.hp,[actor]:change.hp}};const charged=actor==='player'?gainGauge(changed,change.actual*tuningOf(state.config).gauge.damagePerHp,'damage'):{state:changed,events:[]};return {state:charged.state,events:[{type:'type-damage',actor,target:actor,source:'poison',damage:amount,hpBefore:change.before,hpAfter:change.after},...charged.events]};}
/** Rubble crushes under two directly stacked boxes; all resulting falls are passive. */
export function settleBoxTypes(board:BoardDefinition,initial:readonly Box[]):{boxes:readonly Box[];crushed:readonly string[]}{let boxes=settleBoxes(board,initial);const crushed:string[]=[];for(let pass=0;pass<initial.length;pass++){const at=new Set(boxes.map(b=>`${b.row}:${b.col}`));const removes=boxes.filter(b=>b.type==='rubble'&&at.has(`${b.row-1}:${b.col}`)&&at.has(`${b.row-2}:${b.col}`)).map(b=>b.id);if(!removes.length)break;crushed.push(...removes);const removed=new Set(removes);boxes=settleBoxes(board,boxes.filter(b=>!removed.has(b.id)));}return {boxes,crushed};}

/** Eight-neighbor thorns react only to a committed active insertion, before its skills/links. */
export function resolveThornInsertion(initial:BattleState,inserted:Box):BattleTransition {
 const adjacent=initial.boxes.filter(b=>b.id!==inserted.id&&b.type==='thorn'&&Math.abs(b.row-inserted.row)<=1&&Math.abs(b.col-inserted.col)<=1);
 if(!adjacent.length)return {state:initial,events:[]};let state=initial;const events:BattleTransition['events'][number][]=[];
 const actor=initial.actor;
 for(const thorn of adjacent){if(state.hp[actor].current<=0)break;const amount=thornDamage(initial.config,initial.hp[actor].max,thorn,inserted,actor);if(amount<=0)continue;const change=damageHp(state.hp[actor],amount);state={...state,hp:{...state.hp,[actor]:change.hp}};
  events.push({type:'type-damage',actor,target:actor,source:'thorn',sourceBoxIds:[thorn.id],damage:amount,hpBefore:change.before,hpAfter:change.after});
  if(actor==='player'){const charged=gainGauge(state,change.actual*tuningOf(state.config).gauge.damagePerHp,'damage');state=charged.state;events.push(...charged.events);}
 }
 return {state,events};
}

/** 日本語: 新規ランだけ半減。古い保存の未指定は1個につき−1を維持。
 * English: Freeze the balance rule in each run; legacy saves retain subtraction. Shapes and gauge are unaffected. */
export function frozenLinkAmount(state:BattleState,ids:readonly string[],amount:number):number {
 const count=frozenPenalty(state.boxes,ids);
 const members=new Set(ids),absolute=state.boxes.some(b=>b.type==='absolute-zero'&&members.has(b.id));
 return Math.max(0,state.config.frozenRule==='half-melt-v1'?((count||absolute)?Math.floor(amount/2):amount):(absolute?Math.floor(amount/2):amount)-count);
}

export function frozenRuleDescription(config:BattleState['config']):string{return config.frozenRule==='half-melt-v1'?'リンクに1個でも含まれるとそのリンクの攻撃力が半減します（小数点以下切り捨て）。複数でも半減は1回。このリンクの攻撃後含まれるフローズンは通常タイプへ戻ります。後のリンクでは通常通りです。輝き・リンク補正の後防御の前に計算し形状スキル・回復・ゲージには影響しません。':'このランは旧ルールです。リンクに含まれるフローズン1個につきリンク攻撃力が1減ります（輝きの計算後最低0）。形状スキル・回復・ゲージには影響しません。';}

/** 日本語: 各有効リンクの攻撃後に解凍。絶対零度と旧ランは溶けない。
 * English: Thaw only participating frozen boxes after a qualifying link, preserving ownership and IDs. */
export function thawFrozenLink(state:BattleState,ids:readonly string[]):BattleTransition {
 if(state.config.frozenRule!=='half-melt-v1')return {state,events:[]};
 const members=new Set(ids),melted=state.boxes.filter(b=>b.type==='frozen'&&members.has(b.id)).map(b=>b.id);
 if(!melted.length)return {state,events:[]};const targets=new Set(melted);
 return {state:{...state,boxes:state.boxes.map(b=>targets.has(b.id)?assignBoxType(b,'normal'):b)},events:[{type:'boxes-thawed',boxIds:melted}]};
}

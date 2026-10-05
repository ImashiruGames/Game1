import {freeze} from '../core/immutable.ts';
import type {BattleConfig} from '../core/types.ts';
/** 日本語: 調整対象だけを出発時に固定。確定済みの青・赤・イマシル固有仕様は含めない。
 * English: Freeze provisional kit knobs at departure, not the three confirmed signature rules. */
export const balancedBoardIds=['mint-observe','rose-slice','amber-convert','violet-poison','silver-freeze','blue-freeze','red-capture','imashiru-focus'] as const;
export type BalancedBoardId=typeof balancedBoardIds[number];
export interface KitBalanceSnapshot {
 readonly version:1;
 readonly mintShapeBonus:number;readonly roseHorizontalBonus:number;readonly silverBarrier:number;readonly violetPoisonTargets:number;
 readonly amber:{readonly mode:'link-gauge'|'link-power';readonly multiplier:number;readonly ownTurns:number};
 readonly boards:Readonly<Record<BalancedBoardId,{readonly gauge:number;readonly hp:number}>>;
}
/** Exact1.4.2 fallback. Never edit these numbers to tune a new departure. */
export const LEGACY_KIT_BALANCE:KitBalanceSnapshot=freeze({version:1,mintShapeBonus:3,roseHorizontalBonus:12,silverBarrier:12,violetPoisonTargets:2,amber:{mode:'link-gauge',multiplier:2,ownTurns:1},boards:{
 'mint-observe':{gauge:10,hp:0},'rose-slice':{gauge:10,hp:0},'amber-convert':{gauge:20,hp:0},'violet-poison':{gauge:20,hp:0},'silver-freeze':{gauge:15,hp:0},'blue-freeze':{gauge:10,hp:0},'red-capture':{gauge:0,hp:2},'imashiru-focus':{gauge:40,hp:0},
}});
/** v1.5 new departures: conservative one-turn power form, selected after paired validation. */
export const CURRENT_KIT_BALANCE=amberPowerCandidate(1);
export function kitBalanceOf(config:Pick<BattleConfig,'meta'>):KitBalanceSnapshot{return config.meta?.kitBalance??LEGACY_KIT_BALANCE;}
export function validateKitBalance(value:unknown):asserts value is KitBalanceSnapshot{
 const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
 const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
 if(!record(value)||value.version!==1||!integer(value.mintShapeBonus,0,10)||!integer(value.roseHorizontalBonus,0,30)||!integer(value.silverBarrier,1,30)||!integer(value.violetPoisonTargets,1,3)||!record(value.amber)||(value.amber.mode!=='link-gauge'&&value.amber.mode!=='link-power')||!integer(value.amber.multiplier,1,3)||!integer(value.amber.ownTurns,1,3)||!record(value.boards))throw new Error('出発時のキット調整データを確認できません');
 for(const id of balancedBoardIds){const board=value.boards[id];if(!record(board)||!integer(board.gauge,0,300)||!integer(board.hp,0,10))throw new Error('出発時の盤面スキル費用が不正です');}
 if(Object.keys(value.boards).some(id=>!balancedBoardIds.includes(id as BalancedBoardId)))throw new Error('未対応の盤面スキル調整です');
}
export function amberPowerCandidate(ownTurns:1|2):KitBalanceSnapshot{return freeze({...LEGACY_KIT_BALANCE,amber:{mode:'link-power',multiplier:2,ownTurns}});}
export function amberFormDescription(config:Pick<BattleConfig,'meta'>):string{const a=kitBalanceOf(config).amber;return a.mode==='link-gauge'?`リンクによる変身ゲージ獲得×${a.multiplier}（${a.ownTurns}自手番・この戦闘中）`:`リンクダメージ×${a.multiplier}（発動した手番を含む${a.ownTurns}自手番・この戦闘中）。形・毒・直接攻撃は対象外`;}

/** 日本語: 新しい盤面技の費用は旧キット数値と分離し、出発時に丸ごと固定する。
 * English: New board costs have their own frozen snapshot, preserving all legacy kit balances. */
export const expandedBoardIds=['blue-crosscut','blue-plumb','red-frontline','red-brand','mint-diagonal','mint-frame','amber-squarepress','amber-rubble','violet-venom','violet-sting','silver-frostbind','silver-thornwall','rose-longcut','rose-twincut','imashiru-polish','imashiru-reset'] as const;
export type ExpandedBoardId=typeof expandedBoardIds[number];
export interface BoardBalanceSnapshot {readonly version:1;readonly boards:Readonly<Record<ExpandedBoardId,{readonly gauge:number;readonly hp:number}>>}
export const CURRENT_BOARD_BALANCE:BoardBalanceSnapshot=freeze({version:1,boards:{
 'blue-crosscut':{gauge:35,hp:0},'blue-plumb':{gauge:15,hp:0},
 'red-frontline':{gauge:15,hp:3},'red-brand':{gauge:20,hp:2},
 'mint-diagonal':{gauge:15,hp:0},'mint-frame':{gauge:25,hp:0},
 'amber-squarepress':{gauge:65,hp:0},'amber-rubble':{gauge:10,hp:0},
 'violet-venom':{gauge:20,hp:0},'violet-sting':{gauge:35,hp:0},
 'silver-frostbind':{gauge:20,hp:0},'silver-thornwall':{gauge:25,hp:0},
 'rose-longcut':{gauge:25,hp:0},'rose-twincut':{gauge:10,hp:0},
 'imashiru-polish':{gauge:65,hp:0},'imashiru-reset':{gauge:15,hp:0},
}});
export function validateBoardBalance(value:unknown):asserts value is BoardBalanceSnapshot{
 const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
 const integer=(v:unknown,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
 if(!record(value)||value.version!==1||!record(value.boards)||Object.keys(value.boards).length!==expandedBoardIds.length)throw new Error('盤面カタログの調整データが不正です');
 for(const id of expandedBoardIds){const b=value.boards[id];if(!record(b)||!integer(b.gauge,300)||!integer(b.hp,10))throw new Error('盤面カタログの費用が不正です');}
}

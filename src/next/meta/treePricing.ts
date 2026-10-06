import {BOARD_UNLOCK_COSTS} from './boardUnlockStages.ts';
export const scalingTreeIds=['three','four','five','rewardHeal'] as const;
export type ScalingTreeId=typeof scalingTreeIds[number];
export interface PricedTree {three:number;four:number;five:number;slots:number;board:number;rewardHeal?:number}
/** 日本語: 返還は同じ価格表の累計差分。残高を加算保存せず、二重返還を防ぐ。
 * English: Refund using the same cumulative schedule; never persist additive point credits. */
export function nextTreeCost(id:keyof PricedTree,rank:number):number{return scalingTreeIds.includes(id as ScalingTreeId)?1+Math.floor(rank/2):id==='board'?(BOARD_UNLOCK_COSTS[rank]??0):3;}
const cumulative=(rank:number)=>Math.floor((rank+1)*(rank+1)/4);
export function paidTreePoints(tree:PricedTree,version?:2):number{
 return scalingTreeIds.reduce((sum,id)=>sum+(version===2?cumulative(tree[id]??0):(tree[id]??0)),0)+3*tree.slots+(version===2?BOARD_UNLOCK_COSTS.slice(0,tree.board).reduce<number>((sum,cost)=>sum+cost,0):3*tree.board);
}

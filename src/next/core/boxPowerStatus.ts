import {foundationBox} from './foundation.ts';
import {activeSkillValue} from './playerBuild.ts';
import type {BattleState,Box} from './types.ts';
// 日本語: 鉄壁の成立判定と表示は同じ2×2構成箱を参照。複数の正方形でも効果量は増やさない。
// English: Iron Wall and its visual status share square membership; multiple squares never multiply the guard.
export function ownSquareMembers(state:Pick<BattleState,'boxes'>):Set<string>{
 const own=new Map(state.boxes.filter(b=>b.owner==='player').map(b=>[`${b.row}:${b.col}`,b]));const ids=new Set<string>();
 for(const b of own.values()){const square=[b,own.get(`${b.row+1}:${b.col}`),own.get(`${b.row}:${b.col+1}`),own.get(`${b.row+1}:${b.col+1}`)];if(square.every(Boolean))for(const member of square)ids.add(member!.id);}
 return ids;
}
export function boxPowerStatuses(state:BattleState,box:Box):('火力アップ'|'防御アップ')[]{
 const result:('火力アップ'|'防御アップ')[]=[];
 if(foundationBox(state,box))result.push('火力アップ');
 const current=state.boxes.find(b=>b.id===box.id);
 if(current&&current.owner===box.owner&&current.row===box.row&&current.col===box.col&&activeSkillValue(state,'iron-wall')>0&&ownSquareMembers(state).has(box.id))result.push('防御アップ');
 return result;
}

import { defaultExperimentTuning } from './tuning.ts';
import { applyHealingEffect } from './engine/effectDispatcher.ts';
import { cellKey, isPlayable } from './engine/board.ts';
import type { BattleState, Box, Cell, BattleTransition } from './engine/types.ts';
import type { ProposalId } from './model.ts';
export interface ExperimentAction { readonly type:'experiment-action'; readonly skillId:ProposalId; readonly targetIds?:readonly string[]; readonly start?:Cell; readonly end?:Cell }
export interface ActionPreview { readonly valid:boolean; readonly reason:string; readonly affected:readonly string[]; readonly boxes:readonly Box[] }
const reject=(state:BattleState,reason:string):ActionPreview=>({valid:false,reason,affected:[],boxes:state.boxes});
export function hasExperimentAction(state:BattleState):boolean {
 if(state.actor!=='player'||state.result)return false;
 const id=state.config.experiment;
 if(id==='B011')return state.boxes.some(box=>{for(let row=0;row<state.config.board.height;row++)for(let col=0;col<state.config.board.width;col++){const dr=row-box.row,dc=col-box.col;if((dr||dc)&&(dr===0||dc===0||Math.abs(dr)===Math.abs(dc))&&isPlayable(state.config.board,{row,col}))return true;}return false;});
 return id==='B001'?state.boxes.some(b=>b.owner==='enemy'):(id==='B009'||id==='B010')?state.boxes.length>0:id==='B019'?state.boxes.length>=2:id==='D001'?state.experiment!.normalActions>=state.experiment!.meditationReadyAt:false;
}
/** 日本語: 選択中は不変。対象を全て検証してから一括変更し、受動整理は呼出元で1回。
 * English: Target previews are pure; validate the entire transaction before one passive settling pass. */
export function previewExperimentAction(state:BattleState,action:ExperimentAction):ActionPreview {
 if(action.skillId!==state.config.experiment||state.actor!=='player'||state.result)return reject(state,'装備中の自分のスキルだけ使用可能');
 const ids=action.targetIds??[],targets=ids.map(id=>state.boxes.find(b=>b.id===id));
 const id=action.skillId;
 if(id==='B001'||id==='B009'){
  if(ids.length!==1||!targets[0])return reject(state,'箱を1個選んでください');
  const target=targets[0];
  if(id==='B001'&&target.owner!=='enemy')return reject(state,'敵の箱を選んでください');
  return{valid:true,reason:'',affected:[target.id],boxes:id==='B001'?state.boxes.map(b=>b.id===target.id?{...b,owner:'player'}:b):state.boxes.filter(b=>b.id!==target.id)};
 }
 if(id==='B010'){
  if(ids.length!==1||!targets[0])return reject(state,'箱を1個選んでください');
  const seed=targets[0],found=new Set<string>([seed.id]),queue=[seed];
  while(queue.length){const next=queue.shift()!;for(const b of state.boxes)if(b.owner===seed.owner&&!found.has(b.id)&&Math.abs(b.row-next.row)+Math.abs(b.col-next.col)===1){found.add(b.id);queue.push(b);}}
  return{valid:true,reason:'',affected:[...found],boxes:state.boxes.filter(b=>!found.has(b.id))};
 }
 if(id==='B011'){
  const a=action.start,b=action.end,board=state.config.board;
  if(!a||!b||!isPlayable(board,a)||!isPlayable(board,b)||cellKey(a)===cellKey(b))return reject(state,'盤面の異なる始点・終点を選んでください');
  const dr=b.row-a.row,dc=b.col-a.col;if(dr!==0&&dc!==0&&Math.abs(dr)!==Math.abs(dc))return reject(state,'縦・横・45度の直線を選んでください');
  const cells=new Set<string>();for(let step=0;step<=Math.max(Math.abs(dr),Math.abs(dc));step++){const cell={row:a.row+Math.sign(dr)*step,col:a.col+Math.sign(dc)*step};if(!isPlayable(board,cell))break;cells.add(cellKey(cell));}
  const affected=state.boxes.filter(box=>cells.has(cellKey(box))).map(box=>box.id);if(!affected.length)return reject(state,'地形より手前に箱がありません');
  return{valid:true,reason:'',affected,boxes:state.boxes.filter(box=>!affected.includes(box.id))};
 }
 if(id==='B019'){
  if(ids.length!==2||ids[0]===ids[1]||!targets[0]||!targets[1])return reject(state,'異なる箱を2個選んでください');
  const [a,b]=targets as [Box,Box];return{valid:true,reason:'',affected:[a.id,b.id],boxes:state.boxes.map(box=>box.id===a.id?{...box,row:b.row,col:b.col}:box.id===b.id?{...box,row:a.row,col:a.col}:box)};
 }
 if(id==='D001')return state.experiment!.normalActions>=state.experiment!.meditationReadyAt?{valid:true,reason:'',affected:[],boxes:state.boxes}:reject(state,'再使用待ちです');
 return reject(state,'この案には手動操作がありません');
}
export function resolveExperimentAction(state:BattleState,action:ExperimentAction):BattleTransition {
 const preview=previewExperimentAction(state,action);if(!preview.valid)throw new Error(preview.reason);
 if(action.skillId==='D001'){const t=state.config.experimentTuning??defaultExperimentTuning;const heal=applyHealingEffect(state,'player',t.meditationHeal,'D001');return{state:{...heal.state,experiment:{...state.experiment!,meditationReadyAt:state.experiment!.normalActions+1+t.meditationCooldown}},events:[{type:'experiment',skill:'D001',phase:'manual-heal',eligible:true,triggered:true,detail:`回復後、通常手番${t.meditationCooldown}回待つ`,amount:t.meditationHeal},...heal.events]};}
 return {state:{...state,boxes:preview.boxes},events:[{type:'experiment',skill:action.skillId,phase:'board-action',eligible:true,triggered:true,detail:`対象${preview.affected.length}箱 / ${preview.affected.join(', ')} / 受動整理では攻撃しない`,amount:preview.affected.length}]};
}

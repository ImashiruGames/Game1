import {getDropOptions,isPlayable} from './board.ts';
import {sampleUniformIndex} from './random.ts';
import {revisedCharacters} from './characterRevision.ts';
import type {BattleState,BattleTransition,BoardSkillId,Box,Cell} from './types.ts';
import type {KitBoardDefinition} from './kitBoards.ts';
export const revisedBoardCatalog:Partial<Record<BoardSkillId,KitBoardDefinition>>={
 'mint-observe':{id:'mint-observe',name:'空からの恵み',description:'ランダムな放出点3か所から自箱1個ずつ投入（空きが少なければ可能な数）。リンク・形・トゲのダメージ処理は発生しません。',gauge:55,hp:0,kind:'random-drop',effect:{action:'remove'}},
 'mint-diagonal':{id:'mint-diagonal',name:'流れ星',description:'ランダムな放出点2か所から輝きの自箱1個ずつ投入（空きが少なければ可能な数）。リンク・形・トゲのダメージ処理は発生しません。',gauge:77,hp:0,kind:'random-drop',effect:{action:'remove'},expanded:true},
 'mint-frame':{id:'mint-frame',name:'彗星の導き',description:'ランダムなマスを中心にマンハッタン距離2以下の全箱を消去（中心込み最大13マス）。',gauge:100,hp:0,kind:'random-area',effect:{action:'remove'},expanded:true},
 'violet-sting':{id:'violet-sting',name:'毒の侵食',description:'発動時のどく・げきどく全箱を対象固定。各箱の毒発動2回目の処理後にVanish状態になり、計算後に消滅します。後から毒になった箱は含みません。',gauge:40,hp:0,kind:'poison-mark',effect:{action:'remove'},expanded:true},
};
export const isGlobalBoard=(d:KitBoardDefinition|undefined):boolean=>!!d&&['random-drop','random-area','poison-mark'].includes(d.kind);
export function revisedBoardAvailable(state:BattleState,id:BoardSkillId):boolean {
 const d=revisedBoardCatalog[id],m=state.config.meta;
 if(!d||!revisedCharacters(state.config)||m?.board!==id||m.kitVersion!==2||state.gauge<d.gauge)return false;
 return d.kind==='random-drop'?getDropOptions(state).some(o=>o.available):d.kind==='poison-mark'?state.boxes.some(b=>b.type==='poison'||b.type==='deadly-poison'):state.boxes.length>0;
}
export function resolveRevisedBoard(initial:BattleState,id:BoardSkillId):BattleTransition {
 if(!revisedBoardAvailable(initial,id))return {state:initial,events:[]};
 const d=revisedBoardCatalog[id]!;
 let state:BattleState={...initial,gauge:initial.gauge-d.gauge};
 const events:BattleTransition['events'][number][]=[{type:'board-skill',actor:'player',skillId:id},{type:'gauge-spent',before:initial.gauge,after:state.gauge,amount:d.gauge}];
 if(d.kind==='random-drop'){
  const used=new Set<string>(),count=id==='mint-observe'?3:2;
  for(let i=0;i<count;i++){
   const options=getDropOptions(state).filter(o=>o.available&&o.landing&&!used.has(o.id));if(!options.length)break;
   const draw=sampleUniformIndex(state.rngState,options.length),option=options[draw.index]!;used.add(option.id);
   let next=state.nextBoxId;while(state.boxes.some(b=>b.id==='drop:'+next))next++;
   const box:Box={id:'drop:'+next,...option.landing!,owner:'player',type:id==='mint-diagonal'||state.transformation?.character==='mint'?'shiny':'normal',status:'normal'};
   state={...state,rngState:draw.rngState,nextBoxId:next+1,boxes:[...state.boxes,box]};
   events.push({type:'drop',actor:'player',box,candidateId:option.id,spawn:option.spawn,landing:option.landing!,path:option.path});
  }
 }else if(d.kind==='random-area'){
  const cells:Cell[]=[];for(let row=0;row<state.config.board.height;row++)for(let col=0;col<state.config.board.width;col++)if(isPlayable(state.config.board,{row,col}))cells.push({row,col});
  const draw=sampleUniformIndex(state.rngState,cells.length),center=cells[draw.index]!;
  const ids=state.boxes.filter(b=>Math.abs(b.row-center.row)+Math.abs(b.col-center.col)<=2).map(b=>b.id);
  state={...state,rngState:draw.rngState,boxes:state.boxes.filter(b=>!ids.includes(b.id))};
  events.push({type:'kit-board-changed',boxIds:ids,skillId:id});
 }else{
  const ids=state.boxes.filter(b=>b.type==='poison'||b.type==='deadly-poison').map(b=>b.id);
  state={...state,boxes:state.boxes.map(b=>ids.includes(b.id)?{...b,poisonCountdown:2}:b)};
  events.push({type:'kit-board-changed',boxIds:ids,skillId:id});
 }
 return {state,events};
}

import {kitBalanceOf,LEGACY_KIT_BALANCE,CURRENT_BOARD_BALANCE} from '../meta/kitBalance.ts';
import type {KitBalanceSnapshot,BoardBalanceSnapshot,BalancedBoardId,ExpandedBoardId} from '../meta/kitBalance.ts';
import {hasNewKit,characterBoardChoices,BOARD_CATALOG_VERSION} from '../meta/kits.ts';
import {assignBoxType} from './boxTypes.ts';
import type {BoxType} from './boxTypes.ts';
import {applyDamageEffect} from './effectDispatcher.ts';
import type {BattleState,BoardSkillId,BattleTransition,Box,Cell,BattleConfig,Owner} from './types.ts';
export interface BoardTarget extends Cell {readonly orientation?:number}
export type KitBoardKind='single-enemy'|'single-own'|'single-any'|'column'|'l'|'line'|'plus'|'vertical-line'|'diagonal'|'square'|'horizontal-pair'|'diagonal-pair'|'long-line'|'vertical-pair';
type BoardEffect={readonly action:'remove'}|{readonly action:'convert';readonly type?:BoxType}|{readonly action:'type';readonly type:BoxType;readonly from?:readonly BoxType[]};
export interface KitBoardDefinition {id:BoardSkillId;name:string;description:string;gauge:number;hp:number;kind:KitBoardKind;owner?:Owner;effect:BoardEffect;expanded?:true}
/** 日本語: 幾何・対象・効果を宣言的に分離。消去も変更も受動で、投入スキルを発火しない。
 * English: Geometry, ownership and effects are data, not per-character branches; mutations remain passive. */
export const kitBoardCatalog:Partial<Record<BoardSkillId,KitBoardDefinition>>={
 'mint-observe':{id:'mint-observe',name:'一点観測',description:'L形の3箱を消す。所有者は問わず落下は受動。',...LEGACY_KIT_BALANCE.boards['mint-observe'],kind:'l',effect:{action:'remove'}},
 'rose-slice':{id:'rose-slice',name:'払いの構え',description:'選んだ横3箱を消す。所有者は問わず落下は受動。',...LEGACY_KIT_BALANCE.boards['rose-slice'],kind:'line',effect:{action:'remove'}},
 'amber-convert':{id:'amber-convert',name:'力で塗り替える',description:'敵箱1個を自箱へ変更。タイプは維持。',...LEGACY_KIT_BALANCE.boards['amber-convert'],kind:'single-enemy',owner:'enemy',effect:{action:'convert'}},
 'violet-poison':{id:'violet-poison',name:'毒矢',description:'敵箱1個をどくへ上書き。毒盛り術の適用元を記録。',...LEGACY_KIT_BALANCE.boards['violet-poison'],kind:'single-enemy',owner:'enemy',effect:{action:'type',type:'poison',from:['normal','shiny','frozen','absolute-zero','rubble','thorn']}},
 'silver-freeze':{id:'silver-freeze',name:'氷結の守り',description:'選んだ列の上から最大2個の敵箱をフローズンへ。',...LEGACY_KIT_BALANCE.boards['silver-freeze'],kind:'column',owner:'enemy',effect:{action:'type',type:'frozen'}},
 'blue-freeze':{id:'blue-freeze',name:'凍てつく光',description:'敵箱1個をフローズンへ上書き。',...LEGACY_KIT_BALANCE.boards['blue-freeze'],kind:'single-enemy',owner:'enemy',effect:{action:'type',type:'frozen'}},
 'red-capture':{id:'red-capture',name:'炎の占領',description:'自HP2を先に支払い敵箱1個を自箱へ。タイプは維持。',...LEGACY_KIT_BALANCE.boards['red-capture'],kind:'single-enemy',owner:'enemy',effect:{action:'convert'}},
 'imashiru-focus':{id:'imashiru-focus',name:'ここが気になる！',description:'選んだ自箱1個をすぐ輝きへ上書き。次の投入予約とは別。',...LEGACY_KIT_BALANCE.boards['imashiru-focus'],kind:'single-own',owner:'player',effect:{action:'type',type:'shiny'}},
 'blue-crosscut':{id:'blue-crosscut',name:'十字の透視',description:'上端を選び十字形の5箱を消す。所有者は問わず5箱すべて必要。',...CURRENT_BOARD_BALANCE.boards['blue-crosscut'],kind:'plus',effect:{action:'remove'},expanded:true},
 'blue-plumb':{id:'blue-plumb',name:'水脈をひらく',description:'選択位置から縦3箱を消す。所有者は問わず3箱すべて必要。',...CURRENT_BOARD_BALANCE.boards['blue-plumb'],kind:'vertical-line',effect:{action:'remove'},expanded:true},
 'red-frontline':{id:'red-frontline',name:'紅蓮の前線',description:'横に隣接する敵箱2個を自箱へ変える。タイプは維持。HP費用を先に支払い生存時だけ変換。',...CURRENT_BOARD_BALANCE.boards['red-frontline'],kind:'horizontal-pair',owner:'enemy',effect:{action:'convert'},expanded:true},
 'red-brand':{id:'red-brand',name:'焼き印の占領',description:'敵箱1個を自箱にしてタイプをトゲへ上書き。HP費用を先に支払い生存時だけ変更。トゲは相手が隣に投入したときに反応（自分の投入には反応しない）。',...CURRENT_BOARD_BALANCE.boards['red-brand'],kind:'single-enemy',owner:'enemy',effect:{action:'convert',type:'thorn'},expanded:true},
 'mint-diagonal':{id:'mint-diagonal',name:'斜線の観測',description:'斜めに並ぶ3箱を消す。右下・左下の2方向を選択。所有者は問わず3箱すべて必要。',...CURRENT_BOARD_BALANCE.boards['mint-diagonal'],kind:'diagonal',effect:{action:'remove'},expanded:true},
 'mint-frame':{id:'mint-frame',name:'観測窓を抜く',description:'左上を選び2×2の4箱を消す。所有者は問わず4箱すべて必要。',...CURRENT_BOARD_BALANCE.boards['mint-frame'],kind:'square',effect:{action:'remove'},expanded:true},
 'amber-squarepress':{id:'amber-squarepress',name:'方陣の制圧',description:'左上を選び2×2に並ぶ敵箱4個をすべて自箱へ変える。タイプは維持。4箱すべて敵箱が必要。',...CURRENT_BOARD_BALANCE.boards['amber-squarepress'],kind:'square',owner:'enemy',effect:{action:'convert'},expanded:true},
 'amber-rubble':{id:'amber-rubble',name:'砕石の槌',description:'ガレキではない敵箱1個をガレキへ上書き。所有者は維持。直上に2箱積まれると崩れる。',...CURRENT_BOARD_BALANCE.boards['amber-rubble'],kind:'single-enemy',owner:'enemy',effect:{action:'type',type:'rubble'},expanded:true},
 'violet-venom':{id:'violet-venom',name:'毒の凝縮',description:'どく状態の敵箱1個をげきどくへ。自分を付与者として記録し毒盛り術は毒精算時の自箱2×2を参照。',...CURRENT_BOARD_BALANCE.boards['violet-venom'],kind:'single-enemy',owner:'enemy',effect:{action:'type',type:'deadly-poison',from:['poison']},expanded:true},
 'violet-sting':{id:'violet-sting',name:'双毒針',description:'横に隣接する敵箱2個をどくへ。2個ともどく・げきどく以外が必要。自分を付与者として記録。',...CURRENT_BOARD_BALANCE.boards['violet-sting'],kind:'horizontal-pair',owner:'enemy',effect:{action:'type',type:'poison',from:['normal','shiny','frozen','absolute-zero','rubble','thorn']},expanded:true},
 'silver-frostbind':{id:'silver-frostbind',name:'斜氷の鎖',description:'斜めに隣接する敵箱2個をフローズンへ。右下・左下の2方向。2個とも未凍結が必要。',...CURRENT_BOARD_BALANCE.boards['silver-frostbind'],kind:'diagonal-pair',owner:'enemy',effect:{action:'type',type:'frozen'},expanded:true},
 'silver-thornwall':{id:'silver-thornwall',name:'荊の防壁',description:'横に隣接する自箱2個をトゲへ。2個ともトゲ以外が必要。トゲは相手が隣に投入したときに反応（自分の投入には反応しない）。',...CURRENT_BOARD_BALANCE.boards['silver-thornwall'],kind:'horizontal-pair',owner:'player',effect:{action:'type',type:'thorn'},expanded:true},
 'rose-longcut':{id:'rose-longcut',name:'長薙ぎ',description:'選択位置から横4箱を消す。所有者は問わず4箱すべて必要。',...CURRENT_BOARD_BALANCE.boards['rose-longcut'],kind:'long-line',effect:{action:'remove'},expanded:true},
 'rose-twincut':{id:'rose-twincut',name:'返しの二段斬り',description:'選択位置から縦2箱を消す。横列を整えるための短い縦斬り。所有者は問わず2箱すべて必要。',...CURRENT_BOARD_BALANCE.boards['rose-twincut'],kind:'vertical-pair',effect:{action:'remove'},expanded:true},
 'imashiru-polish':{id:'imashiru-polish',name:'ふたりでピカーン！',description:'横に隣接する自箱2個をすぐ輝きへ。2個とも輝き以外が必要。次の投入予約は消費しない。',...CURRENT_BOARD_BALANCE.boards['imashiru-polish'],kind:'horizontal-pair',owner:'player',effect:{action:'type',type:'shiny'},expanded:true},
 'imashiru-reset':{id:'imashiru-reset',name:'まっさらにしよう！',description:'通常以外の箱1個を通常へ戻す。所有者は問わず維持。毒の付与者情報も消す。',...CURRENT_BOARD_BALANCE.boards['imashiru-reset'],kind:'single-any',effect:{action:'type',type:'normal'},expanded:true},
};
type Pattern=readonly (readonly [number,number])[];
/** 日本語: 原点は選択セル。左下向きも負の列差で表し、盤外・欠けを拒否する。
 * English: Every pattern is relative to the selected anchor; clipped or incomplete shapes fail closed. */
const patterns:Partial<Record<KitBoardKind,readonly Pattern[]>>={
 l:[[[0,0],[1,0],[1,1]],[[0,0],[0,1],[1,0]],[[0,0],[0,1],[1,1]],[[0,1],[1,0],[1,1]]],
 line:[[[0,0],[0,1],[0,2]]],plus:[[[0,0],[1,-1],[1,0],[1,1],[2,0]]],
 'vertical-line':[[[0,0],[1,0],[2,0]]],diagonal:[[[0,0],[1,1],[2,2]],[[0,0],[1,-1],[2,-2]]],
 square:[[[0,0],[0,1],[1,0],[1,1]]],'horizontal-pair':[[[0,0],[0,1]]],
 'diagonal-pair':[[[0,0],[1,1]],[[0,0],[1,-1]]],'long-line':[[[0,0],[0,1],[0,2],[0,3]]],'vertical-pair':[[[0,0],[1,0]]],
};
export const isKitBoard=(id:BoardSkillId):boolean=>!!kitBoardCatalog[id];
export function kitBoardOrientations(id:BoardSkillId):number {const d=kitBoardCatalog[id];return d?patterns[d.kind]?.length??1:1;}
export function kitBoardForBalance(balance:KitBalanceSnapshot,id:BoardSkillId,boardBalance:BoardBalanceSnapshot=CURRENT_BOARD_BALANCE):KitBoardDefinition|undefined {const d=kitBoardCatalog[id];return d?{...d,...(d.expanded?boardBalance.boards[id as ExpandedBoardId]:balance.boards[id as BalancedBoardId])}:undefined;}
export function kitBoardDefinition(config:Pick<BattleConfig,'meta'>,id:BoardSkillId):KitBoardDefinition|undefined{return kitBoardForBalance(kitBalanceOf(config),id,config.meta?.boardBalance);}
function eligibleTarget(d:KitBoardDefinition,b:Box):boolean {return (!d.owner||b.owner===d.owner)&&(d.effect.action!=='type'||b.type!==d.effect.type&&(!d.effect.from||d.effect.from.includes(b.type)));}
export function kitBoardTargets(state:BattleState,id:BoardSkillId,target:BoardTarget):readonly Box[]{
 const d=kitBoardDefinition(state.config,id),orientation=target.orientation??0;if(!d||!hasNewKit(state.config)||state.config.meta?.board!==id||d.expanded&&(state.config.meta.boardCatalogVersion!==BOARD_CATALOG_VERSION||!state.config.meta.boardBalance)||!Number.isSafeInteger(orientation)||orientation<0||orientation>=kitBoardOrientations(id)||!Number.isSafeInteger(target.row)||!Number.isSafeInteger(target.col)||target.row<0||target.col<0||target.row>=state.config.board.height||target.col>=state.config.board.width)return [];
 const at=(r:number,c:number)=>state.boxes.find(b=>b.row===r&&b.col===c);
 if(d.kind==='column')return state.boxes.filter(b=>b.col===target.col&&eligibleTarget(d,b)).sort((a,b)=>a.row-b.row).slice(0,2);
 const pattern=patterns[d.kind]?.[orientation];if(pattern){const boxes=pattern.map(([r,c])=>at(target.row+r,target.col+c));return boxes.every((b):b is Box=>!!b&&eligibleTarget(d,b))?boxes:[];}
 const b=at(target.row,target.col);return b&&eligibleTarget(d,b)?[b]:[];
}
export function canUseKitBoard(state:BattleState,id:BoardSkillId,target?:BoardTarget):boolean{const d=kitBoardDefinition(state.config,id);if(!d||!hasNewKit(state.config)||state.gauge<d.gauge)return false;if(target)return kitBoardTargets(state,id,target).length>0;for(let row=0;row<state.config.board.height;row++)for(let col=0;col<state.config.board.width;col++)for(let orientation=0;orientation<kitBoardOrientations(id);orientation++)if(kitBoardTargets(state,id,{row,col,orientation}).length)return true;return false;}
export function resolveKitBoard(initial:BattleState,id:BoardSkillId,target:BoardTarget):BattleTransition {
 // 日本語: 公開ヘルパーを直接呼んでも不正対象・不足費用で副作用を起こさない。
 // English: The public resolver is safe even when called outside the action boundary.
 if(!canUseKitBoard(initial,id,target))return {state:initial,events:[]};
 const d=kitBoardDefinition(initial.config,id)!,targets=kitBoardTargets(initial,id,target),ids=new Set(targets.map(b=>b.id));let state:BattleState={...initial,gauge:initial.gauge-d.gauge};const events:BattleTransition['events'][number][]=[{type:'board-skill',actor:'player',skillId:id},{type:'gauge-spent',before:initial.gauge,after:state.gauge,amount:d.gauge}];
 if(d.hp){const paid=applyDamageEffect(state,'player',d.hp,id);state=paid.state;events.push(...paid.events);if(state.hp.player.current<=0)return {state,events};}
 const effect=d.effect;
 if(effect.action==='remove')state={...state,boxes:state.boxes.filter(b=>!ids.has(b.id))};
 else state={...state,boxes:state.boxes.map(b=>{if(!ids.has(b.id))return b;const owned=effect.action==='convert'?{...b,owner:'player' as const}:b;return effect.type?assignBoxType(owned,effect.type,effect.type==='poison'||effect.type==='deadly-poison'?'player':undefined):owned;})};
 events.push({type:'kit-board-changed',boxIds:[...ids],skillId:id});return {state,events};
}
export function isCharacterBoard(id:BoardSkillId,rosterId:NonNullable<BattleState['config']['meta']>['rosterId']):boolean{return characterBoardChoices(rosterId,true).includes(id);}
export function absorbBarrier(state:BattleState,amount:number):{state:BattleState;amount:number;absorbed:number}{const absorbed=Math.min(state.barrier??0,amount);return {state:absorbed?{...state,barrier:(state.barrier??0)-absorbed}:state,amount:amount-absorbed,absorbed};}
export function newKitTransformationAvailable(state:BattleState):boolean {if(!hasNewKit(state.config))return true;const id=state.config.meta!.rosterId;if(id==='violet')return state.boxes.some(b=>b.owner==='enemy'&&b.type!=='deadly-poison');if(id==='silver')return (state.barrier??0)<kitBalanceOf(state.config).silverBarrier;return true;}

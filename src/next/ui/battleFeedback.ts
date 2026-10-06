import {animationTimeline} from './animationTimeline.ts';
import { skillCatalog } from '../core/skillCatalog.ts';
import type { BattleEvent, Link, Actor } from '../core/types.ts';
export interface BattleFeedback {
 readonly text:string;readonly detail:string;readonly tone:'damage'|'heal'|'cost';readonly boxIds:readonly string[];readonly anchor:Actor;
}
const axes={vertical:'縦',horizontal:'横','diagonal-down':'右下斜め','diagonal-up':'右上斜め'};
function sourceName(source:string):string {
 if(source==='blue-transformation')return '青の変化・名目回復の反射';
 if(source==='red-capture')return '炎の占領・自己コスト';
 if(source==='ember')return 'ほむらの火種・自己コスト';
 if(source==='pain-shared')return '列消去・双方同時の被害';
 if(source==='boss-fixed')return 'ボスの固定攻撃';
 if(source==='nigirin'||source==='enemy-pattern')return '敵の回復';
 return Object.hasOwn(skillCatalog,source)?skillCatalog[source as keyof typeof skillCatalog].name:source;
}
/** 日本語: 確定イベントだけから作る表示。形やダメージを再判定しない。
 * English: Read committed effects only; never rerun geometry, RNG, damage or healing. */
export function feedbackForEvent(event:BattleEvent,links:readonly Link[]):BattleFeedback|null {
 if(event.type==='enemy-box-changed'&&event.boxType==='poison')return {text:`どく ${event.boxIds.length}個`,detail:'デビルモンの4リンク・タイプなしの自箱をどくへ',tone:'cost',boxIds:event.boxIds,anchor:'player'};
 if(event.type==='enemy-box-changed'&&event.boxType==='absolute-zero')return {text:event.boxIds.length?`絶対零度 ${event.boxIds.length}個`:'絶対零度 対象なし',detail:'ヒョクルの冷気・自箱を絶対零度へ',tone:'cost',boxIds:event.boxIds,anchor:'player'};
 if(event.type==='enemy-box-changed'&&event.boxType==='neutral')return {text:event.boxIds.length?`中立化 ${event.boxIds.length}個`:'もこもこ 対象なし',detail:'モコウサギが自箱を中立箱に変えた',tone:'cost',boxIds:event.boxIds,anchor:'player'};
 if(event.type==='enemy-box-changed')return {text:event.boxIds.length?`凍結 ${event.boxIds.length}個`:'凍結 対象なし',detail:'敵の氷結・今回は投入なし',tone:'cost',boxIds:event.boxIds,anchor:'player'};
 if(event.type==='power-boost')return {text:`${event.tier===5?'5+':event.tier}リンク ＋${event.amount}`,detail:'Xエナジー',tone:'heal',boxIds:event.boxIds,anchor:'player'};
 if(event.type==='attack')return {text:`${event.damage}ダメージ`,detail:`${event.actor==='player'?'自分':'敵'}の${axes[event.axis]}${event.linkCount}リンク${event.skillId?`・${sourceName(event.skillId)}`:''}`,tone:'damage',boxIds:links.find(link=>link.axis===event.axis)?.boxIds??[],anchor:event.actor};
 if(event.type==='heal')return {text:`${event.amount}回復`,detail:`${event.target==='player'?'自分':'敵'}・${sourceName(event.source)}${event.amount!==event.requestedAmount?`（予定${event.requestedAmount}）`:''}`,tone:'heal',boxIds:event.shapeBoxIds??[],anchor:event.target};
 if(event.type==='type-damage')return {text:`${event.damage}ダメージ`,detail:`${event.target==='player'?'自分':'敵'}・${event.source==='poison'?'所有箱のどく・手番終了':'隣接トゲ・能動投入'}`,tone:'damage',boxIds:event.sourceBoxIds??[],anchor:event.target};
 if(event.type==='damage')return {text:(event.source==='ember'||event.source==='red-capture')?`${event.damage}HP消費`:`${event.damage}ダメージ`,detail:`${event.target==='player'?'自分へ':'敵へ'}・${sourceName(event.source)}`,tone:(event.source==='ember'||event.source==='red-capture')?'cost':'damage',boxIds:event.shapeBoxIds??[],anchor:event.target};
 if(event.type==='instant-kill')return {text:`${event.damage}ダメージ`,detail:'自分へ・敵の投入不能による代替攻撃',tone:'damage',boxIds:[],anchor:'player'};
 return null;
}
export interface FeedbackRect {readonly left:number;readonly right:number;readonly top:number;readonly bottom:number}
/** Label coordinates are local to the board area, including the complete text dimensions. */
export function feedbackPosition(area:{width:number;height:number},boxes:readonly FeedbackRect[],label:{width:number;height:number},anchor:Actor,reservedTop=0):{x:number;y:number;rise:number} {
 const x=boxes.length?(Math.min(...boxes.map(b=>b.left))+Math.max(...boxes.map(b=>b.right)))/2:area.width*(anchor==='player'?.25:.75);
 const y=boxes.length?Math.min(...boxes.map(b=>b.top))-8:label.height+6;
 const half=Math.min(label.width/2,Math.max(0,area.width/2-6));
 // 技名の帯がある時だけ数値を下へ避ける。Reserve visible cue space without changing the board layout.
 const inset=Math.max(0,Math.min(Number.isFinite(reservedTop)?reservedTop:0,Math.max(0,area.height-label.height-12)));
 const point={x:Math.max(half+6,Math.min(area.width-half-6,x)),y:Math.max(label.height+6+inset,Math.min(area.height-6,y))};
 // 日本語: 数値も近くに留め、視線移動を従来の1/3に。English: Keep numbers nearby with one-third of the prior rise.
 return {...point,rise:Math.min(10,Math.max(0,point.y-label.height-6-inset))/3};
}
export function feedbackTiming(reduced:boolean):{lead:number;hold:number}{return animationTimeline({short:reduced,lowMotion:false}).feedback;}

/** One axis keeps its 600 ms budget: link buildup, converging flight, then readable impact. */
export function eventFeedbackTiming(event:BattleEvent,reduced:boolean):{lead:number;hold:number}{
 const profile=animationTimeline({short:reduced,lowMotion:false});return event.type==='attack'?profile.attack:profile.feedback;
}
export const LINK_PARTICLE_LAUNCH_MS=100;
export const LINK_PARTICLE_STAGGER_MS=30;

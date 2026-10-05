import { applyAction, createBattle } from './engine/battle.ts';
import { getDropOptions } from './engine/board.ts';
import type { BattleAction, BattleConfig, BattleState, BattleEvent } from './engine/types.ts';
export interface MoveRecord { readonly index:number; readonly action:BattleAction; readonly accepted:boolean; readonly reason?:string; readonly before:BattleState; readonly after:BattleState; readonly choices:readonly Choice[]; readonly events:readonly BattleEvent[] }
export interface Choice { readonly id:string; readonly col:number; readonly damage:number; readonly healing:number; readonly triggers:number; readonly signature:string }
export function choices(state:BattleState):Choice[]{
 if(state.actor!=='player'||state.result)return[];
 return getDropOptions(state).filter(o=>o.available).map(o=>{
  // 日本語: 会心のプレビューでは抽選しない。English: Critical previews never draw RNG.
  const previewState=state.config.experiment==='A057'?{...state,config:{...state.config,experiment:undefined}}:state;
  const result=applyAction(previewState,{type:'drop',candidateId:o.id}); const events=result.resolution?.events??[];
  const damage=events.reduce((n,e)=>n+(('target'in e&&e.target==='enemy'&&'hpBefore'in e&&'hpAfter'in e&&e.type!=='heal')?Math.max(0,Math.min(Math.max(0,e.hpBefore),e.hpBefore-e.hpAfter)):0),0);
  const healing=events.reduce((n,e)=>n+(e.type==='heal'&&e.target==='player'?e.amount:0),0);
  const triggers=events.filter(e=>e.type==='experiment'&&e.triggered).length;
  return{id:o.id,col:o.spawn.col,damage,healing,triggers,signature:`${damage}/${healing}/${triggers}`};
 });
}
export class LabSession {
 state:BattleState; readonly initial:BattleConfig; records:MoveRecord[]=[];
 constructor(config:BattleConfig){this.initial=config;this.state=createBattle(config);}
 act(action:BattleAction){const before=this.state;const available=choices(before);const result=applyAction(before,action);this.state=result.state;this.records.push({index:this.records.length+1,action,accepted:result.accepted,...(result.reason?{reason:result.reason}:{}),before,after:this.state,choices:available,events:result.resolution?.events??[]});return result;}
 export(){return{schemaVersion:1,labVersion:'0.2.3',baselineVersion:'1.0.0',kind:'reproducible-playtest-trace',disclaimer:'Choice and power telemetry do not prove subjective fun.',initial:this.initial,records:this.records};}
}

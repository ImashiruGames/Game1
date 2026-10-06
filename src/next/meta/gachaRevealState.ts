import type {DrawResult} from './profile.ts';

export const CAPSULE_DURATION=1800;
export const FLIP_DURATION=400;
export const TAP_GUARD_DURATION=250;
export type RevealPhase='capsules'|'back'|'flipping'|'front'|'summary'|'closed';
export interface GachaRevealState {phase:RevealPhase;index:number;seen:number[];skipping:boolean;waitingForPortrait:boolean}
export interface RevealClock {now():number;set(callback:()=>void,delay:number):unknown;clear(handle:unknown):void}
const browserClock:RevealClock={now:()=>performance.now(),set:(fn,delay)=>setTimeout(fn,delay),clear:handle=>clearTimeout(handle as ReturnType<typeof setTimeout>)};
export const isNewCharacter=(result:DrawResult)=>result.kind==='character'&&!result.duplicate;
export function gachaTotals(results:readonly DrawResult[]){return results.reduce((sum,r)=>({energy:sum.energy+r.energy,coins:sum.coins+r.coins}),{energy:0,coins:0});}

/** 日本語: 保存済みの結果だけを表示する。抽選や保存は行わない。
 * English: Present committed results only. Never sample RNG or write a save. */
export function createGachaRevealState(results:readonly DrawResult[],reduced:boolean,onChange:(state:GachaRevealState)=>void,clock:RevealClock=browserClock,portraitReady:(result:DrawResult)=>boolean=()=>true){
 let state:GachaRevealState={phase:results.length?(reduced?'back':'capsules'):'summary',index:0,seen:[],skipping:false,waitingForPortrait:false};
 let timer:unknown=null,version=0,guardUntil=0,skipGuardUntil=0;
 const publish=()=>onChange({...state,seen:[...state.seen]});
 function cancel(){version++;if(timer!==null)clock.clear(timer);timer=null;}
 function later(delay:number,fn:()=>void){cancel();const ticket=version;timer=clock.set(()=>{if(ticket!==version||state.phase==='closed')return;timer=null;fn();},delay);}
 function front(){const waitingForPortrait=isNewCharacter(results[state.index]!)&&!portraitReady(results[state.index]!);state={...state,phase:'front',waitingForPortrait,seen:waitingForPortrait?state.seen:[...new Set([...state.seen,state.index])]};guardUntil=clock.now()+TAP_GUARD_DURATION;publish();}
 function nextNew(){const index=results.findIndex((r,i)=>isNewCharacter(r)&&!state.seen.includes(i));if(index<0){state={...state,phase:'summary'};publish();}else{state={...state,index,skipping:true};front();}}
 if(state.phase==='capsules')later(CAPSULE_DURATION,()=>{state={...state,phase:'back'};publish();});
 return {
  get current(){return {...state,seen:[...state.seen]};},
  tap(onCard=false){
   if(clock.now()<guardUntil)return;
   if(state.phase==='back'&&onCard){guardUntil=clock.now()+TAP_GUARD_DURATION;if(reduced)front();else{state={...state,phase:'flipping'};publish();later(FLIP_DURATION,front);}return;}
   if(state.phase!=='front'||state.waitingForPortrait)return;
   guardUntil=clock.now()+TAP_GUARD_DURATION;
   if(state.skipping){nextNew();return;}
   state={...state,index:state.index+1,phase:state.index+1<results.length?'back':'summary'};publish();
  },
  skip(){if(state.phase==='closed'||state.phase==='summary'||clock.now()<skipGuardUntil)return;cancel();skipGuardUntil=clock.now()+TAP_GUARD_DURATION;guardUntil=skipGuardUntil;state={...state,skipping:true};if(state.waitingForPortrait){publish();return;}nextNew();},
  portraitSettled(){if(state.phase!=='front'||!state.waitingForPortrait||!portraitReady(results[state.index]!))return;front();},
  destroy(){cancel();state={...state,phase:'closed'};},
 };
}

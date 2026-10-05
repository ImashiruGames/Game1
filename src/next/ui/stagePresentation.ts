import type {BattleState} from '../core/types.ts';
import {stageLabel} from './stageLabel.ts';
import type {BattleRunState} from '../app/BattleRun.ts';
import {carryTopPlayerRow} from '../app/BattleRun.ts';

export interface StageCue {readonly key:string;readonly kind:'reward'|'clear'|'test-clear';readonly title:string;readonly detail:string}
export function stageCue(state:BattleState,run:BattleRunState|null,origin:{seed:number;startStage:number}):StageCue|null {
 if(state.result?.winner!=='player'||!run)return null;
 const key=`${origin.seed}/${origin.startStage}/${run.stage}/${run.defeatedCount}/${run.status}`;
 if(run.status==='reward'){
  const count=carryTopPlayerRow(state).length;
  return {key,kind:'reward',title:`${stageLabel(run.stage)} 突破`,detail:`報酬を選んで次の階へ · ${count?`自箱${count}個を引継ぎ`:'自箱の引継ぎなし'}`};
 }
 if(run.status!=='cleared')return null;
 if(origin.startStage>1)return {key,kind:'test-clear',title:`${stageLabel(run.stage)} 検証完了`,detail:`${origin.startStage}階から開始した検証ラン`};
 return {key,kind:'clear',title:run.stage===50?'50階 踏破':`${run.stage}階 完了`,detail:'最後の敵を撃破 · このランの終着点'};
}
const icon='<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M8 15 24 7l16 8-16 8Z M8 15v19l16 8 16-8V15 M24 23v19"/><path class="seal-check" d="m16 26 6 6 13-14"/></svg>';
const sparks='<span class="seal-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function stageSealHtml(cue:StageCue):string {
 return `<span class="seal-art">${icon}${sparks}</span><div><strong>${escape(cue.title)}</strong><small>${escape(cue.detail)}</small></div>`;
}
/** The seal lives inside existing dialogs; no extra modal, wait, action, RNG or save. */
export function createStagePresentation(root:HTMLElement) {
 const reward=root.querySelector<HTMLDialogElement>('#reward')!;
 const end=root.querySelector<HTMLDialogElement>('#end')!;
 let initialized=false,revealedKey='';
 return {
  update(state:BattleState,run:BattleRunState|null,origin:{seed:number;startStage:number},motion:{readonly short:boolean;readonly lowMotion:boolean}):void {
   const cue=stageCue(state,run,origin);
   // Restored reward/result checkpoints show their static seal without replaying victory.
   if(!initialized){initialized=true;if(cue)revealedKey=cue.key;}
   if(!cue){reward.querySelector('.stage-seal')?.remove();end.querySelector('.stage-seal')?.remove();return;}
   const target=cue.kind==='reward'?reward:end;
   (target===reward?end:reward).querySelector('.stage-seal')?.remove();
   let seal=target.querySelector<HTMLElement>('.stage-seal');
   if(!seal){seal=document.createElement('section');seal.setAttribute('aria-label','撃破の記録');const host=target===reward?target.querySelector<HTMLElement>('.reward-stage-cue')??target:target;host.prepend(seal);}
   const newlyVisible=target.open&&revealedKey!==cue.key;
   if(seal.dataset.stageKey!==cue.key){seal.dataset.stageKey=cue.key;seal.className=`stage-seal stage-seal-${cue.kind}`;seal.innerHTML=stageSealHtml(cue);}
   if(newlyVisible){revealedKey=cue.key;if(!motion.short&&!motion.lowMotion)seal.classList.add('stage-seal-enter');}
   if(motion.short||motion.lowMotion)seal.classList.remove('stage-seal-enter');
  },
  reset():void {initialized=false;revealedKey='';reward.querySelector('.stage-seal')?.remove();end.querySelector('.stage-seal')?.remove();},
 };
}

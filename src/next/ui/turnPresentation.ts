import type { BattleState } from '../core/types.ts';
import type { BattleRunState } from '../app/BattleRun.ts';
import { needsTurnStart } from '../core/turnLifecycle.ts';

export interface TurnCue {
 readonly owner:'player'|'enemy'|'none';
 readonly phase:'ready'|'resolving'|'transition'|'ended';
 readonly badge:string;
 readonly description:string;
 readonly inputLocked:boolean;
}
/** Presentation reads the same availability boundary as the existing controls. */
export function turnCue(state:BattleState,resolving:boolean,run:BattleRunState|null):TurnCue {
 if(run?.status==='retired')return {owner:'none',phase:'ended',badge:'帰還',description:'帰還してランを終了しました',inputLocked:true};
 if(state.result)return {owner:'none',phase:'ended',badge:`${state.turn}手目`,description:run?.status==='reward'?'撃破報酬を選択':'戦闘終了',inputLocked:true};
 if(run?.status==='transitioning')return {owner:'none',phase:'transition',badge:'次の階へ',description:'次の戦闘を準備中 · 入力待機',inputLocked:true};
 const enemy=state.actor==='enemy',busy=resolving||enemy||needsTurnStart(state);
 return {owner:state.actor,phase:busy?'resolving':'ready',badge:`${enemy?'相手':'自分'} ${state.turn}手`,description:busy?`${enemy?'相手':'自分'}の行動を解決中 · 入力待機`:'自分の手番 · 行動を選べます',inputLocked:busy};
}
export interface TurnMotion {readonly short:boolean;readonly lowMotion:boolean}
/** No timers, action calls or RNG. The 160ms local accent never delays input. */
export function createTurnPresentation(root:HTMLElement) {
 const game=root.querySelector<HTMLElement>('.game')!;
 const badge=root.querySelector<HTMLElement>('#turn')!;
 const hint=root.querySelector<HTMLElement>('#hint')!;
 const board=root.querySelector<HTMLElement>('#board')!;
 const actions=root.querySelector<HTMLElement>('#actions')!;
 const player=root.querySelector<HTMLElement>('.player-hud')!;
 const enemy=root.querySelector<HTMLElement>('.enemy-hud')!;
 let previous:TurnCue['owner']|undefined;
 badge.classList.add('turn-indicator');
 return {
  update(state:BattleState,resolving:boolean,run:BattleRunState|null,motion:TurnMotion):void {
   const cue=turnCue(state,resolving,run),staticMotion=motion.short||motion.lowMotion;
   game.dataset.turnOwner=cue.owner;game.dataset.turnPhase=cue.phase;
   game.dataset.turnMotion=staticMotion?'static':'full';
   badge.textContent=cue.badge;badge.title=`${state.turn}手目 · ${cue.description}`;
   badge.setAttribute('aria-label',`${state.turn}手目 · ${cue.description}`);
   hint.classList.toggle('turn-locked',cue.inputLocked&&!state.result);
   if(cue.inputLocked&&!state.result)hint.textContent=cue.description;
   board.setAttribute('aria-busy',String(resolving));actions.setAttribute('aria-busy',String(resolving));
   if(cue.owner!==previous){
    player.classList.remove('turn-enter');enemy.classList.remove('turn-enter');
    if(previous!==undefined&&cue.owner!=='none'&&!staticMotion)(cue.owner==='player'?player:enemy).classList.add('turn-enter');
    previous=cue.owner;
   }
   if(staticMotion){player.classList.remove('turn-enter');enemy.classList.remove('turn-enter');}
  },
  reset():void {
   previous=undefined;delete game.dataset.turnOwner;delete game.dataset.turnPhase;delete game.dataset.turnMotion;
   player.classList.remove('turn-enter');enemy.classList.remove('turn-enter');hint.classList.remove('turn-locked');
   board.removeAttribute('aria-busy');actions.removeAttribute('aria-busy');
  },
 };
}

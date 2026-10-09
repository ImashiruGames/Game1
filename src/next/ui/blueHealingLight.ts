import {createBlueTransformation,bluePreviewApplies} from './blueTransformationLight.ts';
import {healingHudTargets} from './healingSkillTargets.ts';
import type {BattleState} from '../core/types.ts';
import type {AnimationMotion} from './animationTimeline.ts';
export const blueTransformationApplies=bluePreviewApplies;
/** Adopted A-revised renderer. Event identity suppresses duplicates; all gameplay is already committed. */
export function createBlueHealingLight(board:HTMLElement,hud:HTMLElement,state:()=>Pick<BattleState,'build'>){
 const seen=new WeakSet<object>(),light=createBlueTransformation(board,board,()=>[...board.querySelectorAll<HTMLElement>('.cell.player')],()=>healingHudTargets(hud,state()));
 return {clear:light.clear,get active(){return light.active;},play(eventId:object,signal:AbortSignal,motion:AnimationMotion,short=false):Promise<void>{
  if(signal.aborted||seen.has(eventId))return Promise.resolve();seen.add(eventId);
  return light.play('skills',signal,motion,{short});
 }};
}

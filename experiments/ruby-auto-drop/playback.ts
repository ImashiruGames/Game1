import {DEFAULT_BATTLE_ANIMATION_TIMING} from '../../src/next/ui/battleAnimator.ts';
import {DROP_MOTION_TIMING} from '../../src/next/ui/dropMotion.ts';
/** Preview-only wall-clock scale; the animator and moving box receive the same budget. */
export function previewTiming(rate:number){
 const valid=rate===1||rate===.25||rate===.1?rate:.25;
 return {dropHoldMs:DEFAULT_BATTLE_ANIMATION_TIMING.dropHoldMs/valid,shortDropHoldMs:DEFAULT_BATTLE_ANIMATION_TIMING.shortDropHoldMs};
}
export const INSPECTION_DURATION=60000;
export function inspectionTime(flightPercent:number,duration=INSPECTION_DURATION){return Math.max(0,Math.min(100,Number.isFinite(flightPercent)?flightPercent:0))/100*duration*DROP_MOTION_TIMING.fall/DROP_MOTION_TIMING.total;}
/** Seek the production WAAPI objects, not a separately drawn approximation. */
export function seekDropFrame(animations:readonly Pick<Animation,'pause'|'currentTime'>[],flightPercent:number,duration=INSPECTION_DURATION){const time=inspectionTime(flightPercent,duration);for(const a of animations){a.pause();a.currentTime=time;}return time;}

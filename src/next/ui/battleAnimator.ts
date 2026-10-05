import {settleBoxes} from '../core/board.ts';
import type { BattleView } from '../app/BattleController.ts';
import type { BattleEvent, BattleState, Resolution, Link } from '../core/types.ts';
import {captureAnimationMotion} from './animationTimeline.ts';
import type {AnimationMotion} from './animationTimeline.ts';
export type {AnimationMotion} from './animationTimeline.ts';
import { feedbackForEvent } from './battleFeedback.ts';
import type { BattleFeedback } from './battleFeedback.ts';
import { shapeFeedbackForEvent } from './shapeFeedback.ts';
import type { ShapeFeedback } from './shapeFeedback.ts';
export interface BattleAnimationTiming {
    readonly dropHoldMs: number;
    readonly shortDropHoldMs: number;
}
export const DEFAULT_BATTLE_ANIMATION_TIMING: BattleAnimationTiming = Object.freeze({ dropHoldMs: 180, shortDropHoldMs: 15 });
export interface BattleAnimationHooks {
    motion(): AnimationMotion;
    begin?(motion:AnimationMotion):void;
    end?():void;
    playSound(event: BattleEvent, resolution: Resolution, index: number, signal: AbortSignal, before: BattleState): void;
    describe(event: BattleEvent, before: BattleState): void;
    observe(event: BattleEvent): void;
    highlight(ids: readonly string[], tone?: BattleFeedback['tone']): void;
    render(state: BattleState, enemyAction?: BattleState | null): void;
    drop(event: Extract<BattleEvent, {
        type: 'drop';
    }>, signal: AbortSignal, motion: AnimationMotion): void;
    react(event: BattleEvent, signal: AbortSignal, motion: AnimationMotion): void;
    /** Cosmetic skill cues run after the committed event is drawn, never in a forecast. */
    boardSkill?(event: BattleEvent, resolution: Resolution, before: BattleState, signal: AbortSignal, motion: AnimationMotion): number|void;
    /** One committed axis cue, within the shared event lead/hold budget. */
    energy?(event:BattleEvent, links:readonly Link[], state:BattleState, signal:AbortSignal, motion:AnimationMotion):void;
    /** Complete the current visual flight immediately before changing the displayed HP. */
    impact?(event:BattleEvent):void;
    feedback(effect: BattleFeedback, state: BattleState, short: boolean, shape: ShapeFeedback | null, holdMs:number): {
        remove(): void;
    };
    transform(event: Extract<BattleEvent, {
        type: 'transformation';
    }>, resolution: Resolution, index: number, signal: AbortSignal, motion: AnimationMotion, before: BattleState): Promise<unknown>;
    complete(resolution: Resolution, turn: number): void;
    pause?(milliseconds: number, signal: AbortSignal): Promise<void>;
}
/** 日本語: 中断は待ち時間だけを終える。計算や保存を再実行しない。
 * English: Aborting releases presentation waits; it never recomputes or saves a battle. */
export function pauseAnimation(milliseconds: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted)
        return Promise.resolve();
    return new Promise(resolve => {
        const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
        const timer = setTimeout(finish, milliseconds);
        signal.addEventListener('abort', finish, { once: true });
    });
}
/** 日本語: 確定済みイベントを順番通りに表示する。描画途中のstateは表示専用。
 * English: Replay committed events in order; intermediate snapshots belong only to the view.
 * Audio precedes labels, feedback leads precede HP updates, and completion is skipped on abort. */
export function createBattleAnimator(hooks: BattleAnimationHooks, timing: BattleAnimationTiming = DEFAULT_BATTLE_ANIMATION_TIMING): BattleView['animate'] {
    const pause = hooks.pause ?? pauseAnimation;
    return async (resolution, before, after, signal) => {
        let shown = { ...before };
        let activeLinks = resolution.links;
        const motion = captureAnimationMotion(hooks.motion(),timing.dropHoldMs,timing.shortDropHoldMs);
        const profile=motion.timeline!,short=profile.short;
        let elapsed=0,skillEnd=0;
        const wait=async(ms:number)=>{await pause(ms,signal);elapsed+=ms;};
        hooks.begin?.(motion);
        try {
        for (const [eventIndex, event] of resolution.events.entries()) {
            if (signal.aborted)
                return;
            if (event.type !== 'transformation')
                hooks.playSound(event, resolution, eventIndex, signal, before);
            if (event.type !== 'attack')
                hooks.describe(event, before);
            if (event.type === 'drop') {
                shown = { ...shown, boxes: [...shown.boxes, event.box] };
                activeLinks = resolution.activeOrigins?.find(origin => origin.originBoxId === event.box.id)?.links ?? resolution.links;
            }
            hooks.observe(event);
            const feedback = feedbackForEvent(event, activeLinks), feedbackTime = (event.type==='attack'?profile.attack:profile.feedback);
            hooks.highlight(feedback?.boxIds ?? [], feedback?.tone ?? 'damage');
            if (feedback) {
                hooks.render(shown, resolution.actor === 'enemy' ? before : null);
                hooks.energy?.(event, activeLinks, shown, signal, motion);
                await wait(feedbackTime.lead);
                if (signal.aborted)
                    return;
            }
            if (feedback) hooks.impact?.(event);
            if (event.type === 'attack') hooks.describe(event, before);
            if (event.type === 'attack' || event.type === 'damage' || event.type === 'heal' || event.type === 'instant-kill'||event.type==='type-damage')
                shown = { ...shown, hp: { ...shown.hp, [event.target]: { ...shown.hp[event.target], current: event.hpAfter } } };
            if (event.type === 'enemy-phase')
                shown = { ...shown, enemyPhase: after.enemyPhase };
            if(event.type==='barrier')shown={...shown,barrier:event.after};
            if (event.type === 'gauge'||event.type==='gauge-spent')
                shown = { ...shown, gauge: event.after };
            if (event.type === 'link-growth')
                shown = { ...shown, link3Growth: event.after };
            if (event.type === 'instant-skill')
                shown = { ...shown, build: after.build };
            if (event.type === 'transformation')
                shown = { ...shown, gauge: event.after, transformation: after.transformation, playerTurnStarted: after.playerTurnStarted };
            if (event.type === 'transformation-ended')
                shown = { ...shown, transformation: null };
            if (event.type === 'turn-start')
                shown = { ...shown, transformation: after.transformation, playerTurnStarted: true };
            if(event.type==='shiny-prepared')shown={...shown,gauge:before.gauge-30,shinyNextDrop:true};
            if(event.type==='boxes-thawed'){const ids=new Set(event.boxIds);shown={...shown,boxes:shown.boxes.map(box=>ids.has(box.id)?{...box,type:'normal'}:box)};}
            if(event.type==='rubble-crushed'){const removed=new Set(event.boxIds);shown={...shown,boxes:settleBoxes(shown.config.board,shown.boxes.filter(box=>!removed.has(box.id)))};}
            if (event.type === 'row-cleared' || event.type === 'boxes-converted'||event.type==='boxes-shining'||event.type==='kit-board-changed'||event.type==='enemy-box-changed')
                shown = { ...shown, boxes: after.boxes };
            hooks.render(shown, resolution.actor === 'enemy' ? before : null);
            const skillDuration=hooks.boardSkill?.(event, resolution, before, signal, motion);
            // A replacing skill cue owns its own tail; never unlock input with a cue still running.
            if(typeof skillDuration==='number')skillEnd=elapsed+skillDuration;
            if (event.type === 'drop')
                hooks.drop(event, signal, motion);
            if (feedback)
                hooks.react(event, signal, motion);
            if (feedback) {
                const bubble = hooks.feedback(feedback, shown, short||motion.lowMotion, shapeFeedbackForEvent(event, shown.boxes), feedbackTime.hold);
                await wait(feedbackTime.hold);
                bubble.remove();
                if (signal.aborted)
                    return;
                hooks.highlight([]);
            }
            else if (event.type === 'transformation')
                await hooks.transform(event, resolution, eventIndex, signal, motion, before);
            else if (event.type === 'drop' || event.type === 'turn-start')
                await wait(profile.drop);
        }
        if(skillEnd>elapsed)await wait(skillEnd-elapsed);
        if (signal.aborted)
            return;
        hooks.complete(resolution, before.turn);
        hooks.highlight([]);
        hooks.render(after);
        } finally { hooks.end?.(); }
    };
}

import {rubyAutoDrop} from './rubyDropFlame.ts';
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
    }>, signal: AbortSignal, motion: AnimationMotion, context?:{readonly rubyAutoDrop:boolean}): void;
    react(event: BattleEvent, signal: AbortSignal, motion: AnimationMotion): void;
    /** Cosmetic skill cues run after the committed event is drawn, never in a forecast. */
    boardSkill?(event: BattleEvent, resolution: Resolution, before: BattleState, signal: AbortSignal, motion: AnimationMotion): number|void;
    /** One committed axis cue, within the shared event lead/hold budget. */
    energy?(event:BattleEvent, links:readonly Link[], state:BattleState, signal:AbortSignal, motion:AnimationMotion):void;
    /** Cosmetic activation metadata, within existing feedback time; never adds waits. */
    skillActivation?(event:BattleEvent,links:readonly Link[],state:BattleState,signal:AbortSignal,motion:AnimationMotion):void;
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
    /** 日本語: 箱が消える前の「Vanish状態」の表示。ids=空で解除。English: Show boxes in the Vanish state; empty ids clears it. */
    vanish?(ids: readonly string[], phase: 'marked' | 'fading', milliseconds: number): void;
}
/** 日本語: 消える箱を描画の最後まで残してよい解決か（あとから箱を足す・書き換える出来事がないとき）。 */
const VANISH_BLOCKERS = new Set(['drop', 'boxes-converted', 'boxes-shining', 'enemy-box-changed', 'kit-board-changed', 'row-cleared', 'rubble-crushed', 'poison-vanished', 'transformation', 'turn-start']);
export const VANISH_MS = Object.freeze({ full: 900, short: 160 });
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
        // Final snapshots may be used by earlier row/board events. Do not reveal
        // Imashiru's future shiny types before the awaited transformation sequence.
        const shiningIndex=resolution.events.findIndex(e=>e.type==='boxes-shining');
        const pendingShine=new Set(resolution.events.some((e,i)=>i<shiningIndex&&e.type==='transformation'&&e.character==='imashiru')?resolution.events.flatMap(e=>e.type==='boxes-shining'?e.boxIds:[]):[]);
        const replayBoxes=()=>after.boxes.map(box=>{
            const prior=shown.boxes.find(b=>b.id===box.id);
            if(!pendingShine.has(box.id)||box.type!=='shiny'||!prior)return box;
            const {poisonSource:_source,poisonCountdown:_count,...rest}=box;
            return {...rest,type:prior.type,...(prior.poisonSource?{poisonSource:prior.poisonSource}:{}),...(prior.poisonCountdown?{poisonCountdown:prior.poisonCountdown}:{})};
        });
        const motion = captureAnimationMotion(hooks.motion(),timing.dropHoldMs,timing.shortDropHoldMs);
        const profile=motion.timeline!,short=profile.short;
        let elapsed=0,skillEnd=0;
        const vanishing:string[]=[];
        const canDefer=(index:number)=>!resolution.events.slice(index+1).some(item=>VANISH_BLOCKERS.has(item.type));
        const wait=async(ms:number)=>{await pause(ms,signal);elapsed+=ms;};
        hooks.begin?.(motion);
        try {
        for (const [eventIndex, event] of resolution.events.entries()) {
            if (signal.aborted)
                return;
            if(event.type==='boxes-shining')for(const id of event.boxIds)pendingShine.delete(id);
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
                try{hooks.skillActivation?.(event,activeLinks,shown,signal,motion);}catch{/* Cosmetic failures must not block a committed action. */}
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
            // 日本語: 消える箱はVanish状態にして残し、計算がすべて終わってからゆっくり消す。
            // English: Boxes to be removed enter the Vanish state and leave only after every calculation, slowly.
            const gone=event.type==='poison-vanished'?event.boxIds:event.type==='kit-board-changed'?event.boxIds.filter(id=>!after.boxes.some(box=>box.id===id)):[];
            if((event.type==='row-cleared'||event.type==='rubble-crushed'||gone.length>0)&&hooks.vanish&&canDefer(eventIndex)){
                const removing=event.type==='row-cleared'||event.type==='rubble-crushed'?event.boxIds:gone;
                for(const id of removing)if(!vanishing.includes(id)&&shown.boxes.some(box=>box.id===id))vanishing.push(id);
                hooks.vanish(vanishing,'marked',0);
            }
            else{
                if(event.type==='rubble-crushed'){const removed=new Set(event.boxIds);shown={...shown,boxes:settleBoxes(shown.config.board,shown.boxes.filter(box=>!removed.has(box.id)))};}
                if(event.type==='kit-board-changed'&&resolution.events.slice(eventIndex+1).some(e=>e.type==='poison-vanished')){const ids=new Set(event.boxIds);shown={...shown,boxes:shown.boxes.map(b=>ids.has(b.id)?replayBoxes().find(a=>a.id===b.id)??b:b)};}
                else if (event.type === 'poison-vanished'||event.type === 'row-cleared' || event.type === 'boxes-converted'||event.type==='boxes-shining'||event.type==='kit-board-changed'||event.type==='enemy-box-changed')
                    shown = { ...shown, boxes: replayBoxes() };
            }
            if(event.type==='power-boost'&&shown.build)shown={...shown,build:{...shown.build,power:{...shown.build.power,[event.tier]:shown.build.power[event.tier]+event.amount}}};
            hooks.render(shown, resolution.actor === 'enemy' ? before : null);
            if(!feedback)try{hooks.skillActivation?.(event,activeLinks,shown,signal,motion);}catch{/* Optional local passive cue. */}
            const skillDuration=hooks.boardSkill?.(event, resolution, before, signal, motion);
            // A replacing skill cue owns its own tail; never unlock input with a cue still running.
            if(typeof skillDuration==='number'){
                // 日本語: 盤面スキルは発動の演出が終わってから効果を出す（消去・落下・ダメージを待たせる）。
                if(event.type==='board-skill')await wait(skillDuration);
                else skillEnd=elapsed+skillDuration;
                if (signal.aborted) return;
            }
            if (event.type === 'drop')
                hooks.drop(event, signal, motion, {rubyAutoDrop:rubyAutoDrop(event,resolution,before)});
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
            else if (event.type === 'transformation') {
                // The portrait and its character-specific follow-up complete before the next committed event.
                await hooks.transform(event, resolution, eventIndex, signal, motion, before);
                if (signal.aborted) return;
            }
            else if (event.type === 'drop' || event.type === 'turn-start')
                await wait(profile.drop);
        }
        if(skillEnd>elapsed)await wait(skillEnd-elapsed);
        if (signal.aborted)
            return;
        if(vanishing.length){
            // 日本語: ここで計算は全て終了。Vanish状態の箱をゆっくり消してから、落下後の盤面へ。
            const ms=short||motion.lowMotion?VANISH_MS.short:VANISH_MS.full;
            hooks.vanish?.(vanishing,'fading',ms);
            await wait(ms);
            if (signal.aborted)
                return;
            hooks.vanish?.([],'marked',0);
        }
        hooks.complete(resolution, before.turn);
        hooks.highlight([]);
        hooks.render(after);
        } finally { hooks.end?.(); }
    };
}

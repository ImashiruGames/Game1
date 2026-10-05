import {paceScale,resolveBattlePace,type AnimationMotion} from './animationTimeline.ts';
import {stageLabel} from './stageLabel.ts';
/** 日本語: 報酬確定後のステージ移行だけに表示。render やセーブ復帰から再生しない。 */
/** Presentation only. Await from the committed stage-transition callback while input is locked. */
export interface StageNumberEvent {
 readonly type:'stage-transition';
 readonly fromStage:number;
 readonly toStage:number;
}
export interface StageNumberRequest {
 /** Use the committed transition's immutable run object, never a freshly-created render object. */
 readonly eventId:object|string|number;
 readonly event:StageNumberEvent;
 /** True only for a transition recovered from an already committed reward journal. */
 readonly restored?:boolean;
 readonly signal?:AbortSignal;
 readonly motion?:AnimationMotion;
}
export type StageNumberPhase='before'|'rolling'|'arrived'|'exit';
export type StageNumberResult={readonly status:'completed'|'skipped'|'cancelled'|'duplicate'|'invalid'|'suppressed';readonly reason?:string};
export interface StageNumberOptions {
 readonly host?:HTMLElement;
 /** Connect an existing sound sample if desired. The default is completely silent. */
 readonly onSound?:(cue:'roll'|'arrive',event:StageNumberEvent)=>void;
 /** Reuse the board's same-location tap guard after an accepted pointer skip. */
 readonly onSkipPointer?:(point:{readonly clientX:number;readonly clientY:number;readonly detail:number})=>void;
}
export const STAGE_NUMBER_TIMING=Object.freeze({roll:160,arrive:700,exit:960,total:1100,short:250,skipGuard:150,releaseGuard:120});
/** 日本語: 低減時も選んだ速度の表示時間を保つ。静止絵で安全に待つ。
 * English: Reduced motion keeps the chosen pacing, using a still image. */
export function stageNumberTiming(motion:AnimationMotion={short:false,lowMotion:false}){
 const scale=paceScale(motion),fast=resolveBattlePace(motion)==='fast';
 return {...STAGE_NUMBER_TIMING,roll:Math.round(STAGE_NUMBER_TIMING.roll*scale),arrive:Math.round(STAGE_NUMBER_TIMING.arrive*scale),exit:Math.round(STAGE_NUMBER_TIMING.exit*scale),total:fast?STAGE_NUMBER_TIMING.short:Math.round(STAGE_NUMBER_TIMING.total*scale)};
}
export function stageNumberIsShort(request:StageNumberRequest,systemReduced=false,uiReduced=false):boolean {
 return !!((request.motion&&resolveBattlePace(request.motion)==='fast')||request.motion?.lowMotion||systemReduced||uiReduced);
}
export function validStageNumberEvent(event:StageNumberEvent):boolean {
 return !!event&&event.type==='stage-transition'&&Number.isSafeInteger(event.fromStage)
  &&Number.isSafeInteger(event.toStage)&&event.fromStage>=1&&event.toStage===event.fromStage+1&&event.toStage<=50;
}
function makeDialog(doc:Document,request:StageNumberRequest,short:boolean):HTMLDialogElement {
 const dialog=doc.createElement('dialog');
 dialog.className='stage-number-cinematic';
 dialog.dataset.motion=short?'short':'full';
 dialog.dataset.phase=short?'arrived':'before';
 dialog.setAttribute('aria-label',`${stageLabel(request.event.fromStage)} から ${stageLabel(request.event.toStage)}、次の戦闘`);
 dialog.setAttribute('aria-modal','true');
 dialog.innerHTML='<div class="snc-world" aria-hidden="true"><div class="snc-grid"></div><div class="snc-glow"></div><div class="snc-line snc-line-a"></div><div class="snc-line snc-line-b"></div></div>'
  +'<div class="snc-heading"><span class="snc-eyebrow">NEXT ENCOUNTER</span><span class="snc-route"></span></div>'
  +'<div class="snc-center" aria-hidden="true"><span class="snc-label">STAGE</span><div class="snc-number-frame"><span class="snc-bracket snc-bracket-left"></span><div class="snc-number-window"><strong class="snc-number snc-before"></strong><strong class="snc-number snc-after"></strong></div><span class="snc-bracket snc-bracket-right"></span></div><span class="snc-caption">次の戦闘へ</span></div>'
  +'<div class="snc-bottom"><span class="snc-progress" aria-hidden="true"></span><button class="snc-skip" type="button" aria-label="ステージ移行の演出を省略">タップで省略 <span aria-hidden="true">↵</span></button></div>';
 dialog.querySelector('.snc-before')!.textContent=String(request.event.fromStage);
 dialog.querySelector('.snc-after')!.textContent=String(request.event.toStage);
 dialog.querySelector('.snc-route')!.textContent=`${stageLabel(request.event.fromStage)} → ${stageLabel(request.event.toStage)}`;
 return dialog;
}

/** A bounded visual effect; owns no battle, reward, RNG, persistence or progression state. */
export function createStageNumberCinematic(options:StageNumberOptions={}) {
 const doc=options.host?.ownerDocument??document;
 const win=doc.defaultView??window;
 const seenObjects=new WeakSet<object>(),seenValues=new Set<string|number>();
 let destroyed=false;
 let running:{finish:(status:StageNumberResult['status'],reason?:string)=>void}|undefined;
 const seen=(id:StageNumberRequest['eventId'])=>typeof id==='object'?seenObjects.has(id):seenValues.has(id);
 const remember=(id:StageNumberRequest['eventId'])=>{if(typeof id==='object')seenObjects.add(id);else seenValues.add(id);};
 const cancel=(reason='cancelled')=>running?.finish('cancelled',reason);
 return {
  get active():boolean{return !!running;},
  cancel,
  /** A reset cancels work but never makes the same event replayable. New runs use new event IDs. */
  reset():void {cancel('reset');},
  destroy():void {destroyed=true;cancel('destroyed');seenValues.clear();},
  play(request:StageNumberRequest):Promise<StageNumberResult> {
   if(destroyed)return Promise.resolve({status:'cancelled',reason:'destroyed'});
   if(!validStageNumberEvent(request.event)||request.eventId==null)return Promise.resolve({status:'invalid'});
   if(seen(request.eventId))return Promise.resolve({status:'duplicate'});
   if(request.signal?.aborted)return Promise.resolve({status:'cancelled',reason:'aborted'});
   if(request.restored){remember(request.eventId);return Promise.resolve({status:'suppressed',reason:'restored'});}
   cancel('superseded');remember(request.eventId);
   const timing=stageNumberTiming(request.motion);
   const short=stageNumberIsShort(request,win.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,doc.body.dataset.reducedMotion==='true');
   return new Promise<StageNumberResult>(resolve=>{
    let done=false,skipping=false;
    let dialog:HTMLDialogElement|undefined;
    let skipKey='';
    const timers:number[]=[];
    const removers:(()=>void)[]=[];
    const started=win.performance.now();
    const previousFocus=doc.activeElement;
    const listen=(target:EventTarget,type:string,listener:EventListener,opts?:AddEventListenerOptions|boolean)=>{
     target.addEventListener(type,listener,opts);removers.push(()=>target.removeEventListener(type,listener,opts));
    };
    const finish=(status:StageNumberResult['status'],reason?:string)=>{
     if(done)return;done=true;
     timers.forEach(timer=>win.clearTimeout(timer));removers.forEach(remove=>remove());
     if(dialog){try{if(dialog.open&&typeof dialog.close==='function')dialog.close();}catch{/* A detached host may already be closed. */}dialog.remove();}
     if(running?.finish===finish)running=undefined;
     try{if(status!=='cancelled'&&previousFocus instanceof win.HTMLElement&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});}catch{/* Focus can never block a battle. */}
     resolve(reason?{status,reason}:{status});
    };
    running={finish};
    const schedule=(at:number,fn:()=>void)=>{if(!done)timers.push(win.setTimeout(fn,at));};
    const phase=(value:StageNumberPhase)=>{
     if(done||skipping||!dialog)return;
     dialog.dataset.phase=value;
     try{if(value==='rolling')options.onSound?.('roll',request.event);else if(value==='arrived')options.onSound?.('arrive',request.event);}catch{/* An optional sound hook must never delay play. */}
    };
    const stopEvent=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
    const canSkip=()=>win.performance.now()-started>=STAGE_NUMBER_TIMING.skipGuard;
    const skip=(pointer?:MouseEvent)=>{
     if(done||skipping||!canSkip())return;
     skipping=true;
     if(pointer&&pointer.detail>0){try{options.onSkipPointer?.({clientX:pointer.clientX,clientY:pointer.clientY,detail:pointer.detail});}catch{/* Input guard hooks cannot strand the modal. */}}
     // Keep the modal and input lock for the trailing click/release of this gesture.
     if(dialog)dialog.dataset.phase='exit';
     timers.forEach(timer=>win.clearTimeout(timer));
     schedule(STAGE_NUMBER_TIMING.releaseGuard,()=>finish('skipped'));
    };
    const keydown=(event:Event)=>{
     const key=event as KeyboardEvent;
     if(key.key==='Tab')return; // Native modal focus containment remains available.
     stopEvent(key);
     if(!key.repeat&&canSkip()&&['Enter',' ','Escape'].includes(key.key))skipKey=key.key;
    };
    const keyup=(event:Event)=>{
     const key=event as KeyboardEvent;if(key.key==='Tab')return;stopEvent(key);
     if(key.key===skipKey){skipKey='';skip();} // Never unlock beneath a held Space or Enter.
    };
    try{
     dialog=makeDialog(doc,request,short);
     dialog.style.setProperty('--pace-scale',String(paceScale(request.motion??{short:false})));
     (options.host??doc.body).append(dialog);
     if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
     listen(doc,'click',event=>{stopEvent(event);skip(event as MouseEvent);},true);
     listen(doc,'dblclick',stopEvent,true);
     listen(doc,'pointerdown',stopEvent,true);listen(doc,'pointerup',stopEvent,true);
     listen(doc,'contextmenu',stopEvent,true);
     listen(doc,'keydown',keydown,true);listen(doc,'keyup',keyup,true);
     listen(dialog,'cancel',event=>{stopEvent(event);skip();});
     listen(dialog,'close',()=>finish('cancelled','closed'));
     listen(win,'pagehide',()=>finish('cancelled','pagehide'));
     if(request.signal)listen(request.signal,'abort',()=>finish('cancelled','aborted'),{once:true});
     dialog.querySelector<HTMLButtonElement>('.snc-skip')?.focus({preventScroll:true});
     // Clock-based completion also works with missing CSS or disabled animations.
     if(short){phase('arrived');schedule(timing.total,()=>finish('completed'));}
     else{
      schedule(timing.roll,()=>phase('rolling'));
      schedule(timing.arrive,()=>phase('arrived'));
      schedule(timing.exit,()=>phase('exit'));
      schedule(timing.total,()=>finish('completed'));
     }
     if(request.signal?.aborted)finish('cancelled','aborted');
    }catch{finish('cancelled','presentation-unavailable');}
   });
  },
 };
}

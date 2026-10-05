import {paceScale,resolveBattlePace,type AnimationMotion} from './animationTimeline.ts';
import {roster} from '../meta/roster.ts';
/** 日本語: 確定した変化イベントを一度だけ表示する。再描画やセーブ復帰からは呼ばない。 */
/** Presentation only: call once per committed transformation event, never from render(). */
export type TransformationCharacter = 'blue' | 'red' | 'imashiru'|'mint'|'amber'|'violet'|'silver'|'rose';
export type TransformationPhase = 'before' | 'energy' | 'after' | 'exit';
export type TransformationResult = {readonly status:'completed'|'skipped'|'cancelled'|'duplicate'|'invalid';readonly reason?:string};
export interface TransformationRequest {
 readonly eventId:object|string|number;
 readonly event:{readonly type:'transformation';readonly character:TransformationCharacter};
 readonly portraitCharacter?:TransformationCharacter;
 readonly beforeSrc:string;
 readonly afterSrc:string;
 readonly formName?:string;
 readonly signal?:AbortSignal;
 readonly motion?:AnimationMotion;
}
export interface TransformationOptions {
 readonly host?:HTMLElement;
 /** Optional existing sample-audio hook. No oscillator, audio engine or game event is created. */
 readonly onSound?:(cue:'charge'|'reveal',character:TransformationCharacter)=>void;
 /** Consume the second pointer tap after the modal closes, without blocking keyboard input. */
 readonly onSkipPointer?:(point:{readonly clientX:number;readonly clientY:number;readonly detail:number})=>void;
}
export const TRANSFORMATION_TIMING = Object.freeze({energy:560,reveal:1180,exit:1890,total:2100,short:250,skipGuard:150});
/** 日本語: 低減時も選んだ速度の表示時間を保つ。静止絵で安全に待つ。
 * English: Reduced motion keeps the chosen pacing, using a still image. */
export function transformationTiming(motion:AnimationMotion={short:false,lowMotion:false}){
 const scale=paceScale(motion),fast=resolveBattlePace(motion)==='fast';
 return {...TRANSFORMATION_TIMING,energy:Math.round(TRANSFORMATION_TIMING.energy*scale),reveal:Math.round(TRANSFORMATION_TIMING.reveal*scale),exit:Math.round(TRANSFORMATION_TIMING.exit*scale),total:fast?TRANSFORMATION_TIMING.short:Math.round(TRANSFORMATION_TIMING.total*scale)};
}
export function transformationIsShort(request:TransformationRequest,systemReduced=false,uiReduced=false):boolean {
 return !!((request.motion&&resolveBattlePace(request.motion)==='fast')||request.motion?.lowMotion||systemReduced||uiReduced);
}
const orbitalArt=`<svg class="tc-orbits" viewBox="0 0 800 800" aria-hidden="true" focusable="false">
 <defs><linearGradient id="tc-orbit-gradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="currentColor"/><stop offset=".6" stop-color="currentColor" stop-opacity=".2"/><stop offset="1" stop-color="currentColor"/></linearGradient></defs>
 <g class="tc-orbit-far"><circle cx="400" cy="400" r="346"/><circle cx="400" cy="400" r="328" stroke-dasharray="70 20 6 20"/><path d="M400 24 726 212v376L400 776 74 588V212Z"/><path d="M400 64 691 232v336L400 736 109 568V232Z"/></g>
 <g class="tc-orbit-near"><ellipse cx="400" cy="400" rx="310" ry="121" transform="rotate(-24 400 400)"/><ellipse cx="400" cy="400" rx="298" ry="110" transform="rotate(47 400 400)"/><circle cx="400" cy="400" r="278" stroke-dasharray="280 102 28 44"/></g>
 <g class="tc-stars"><path d="M104 136v22m-11-11h22M670 608v22m-11-11h22M644 146v14m-7-7h14M119 590v14m-7-7h14M704 364v18m-9-9h18M340 72v14m-7-7h14"/><circle cx="226" cy="190" r="3"/><circle cx="631" cy="480" r="3"/><circle cx="211" cy="626" r="3"/></g>
 </svg>`;
const foregroundArt=`<svg class="tc-energy-art" viewBox="0 0 800 800" aria-hidden="true" focusable="false"><g><path d="M73 444C154 699 650 705 730 380"/><path d="M117 311C207 66 635 80 700 335"/><path d="m103 438 36 16-8 38m562-161-36-19 11-38"/><path class="tc-energy-dash" d="M110 401a290 290 0 0 1 580 0 290 290 0 0 1-580 0"/></g></svg>`;
function makeDialog(doc:Document,request:TransformationRequest,short:boolean):HTMLDialogElement {
 const identity=request.portraitCharacter??request.event.character;
 const dialog=doc.createElement('dialog');
 dialog.className='transformation-cinematic';
 dialog.dataset.character=identity;
 dialog.dataset.motion=short?'short':'full';
 dialog.dataset.phase=short?'after':'before';
 dialog.setAttribute('aria-label',`${roster[identity].name}、変化！`);
 dialog.setAttribute('aria-modal','true');
 dialog.innerHTML=`<div class="tc-world" aria-hidden="true"><div class="tc-grid"></div><div class="tc-halo"></div>${orbitalArt}</div>
  <div class="tc-heading"><span class="tc-eyebrow">FORM SHIFT <span aria-hidden="true">/</span> <span class="tc-signal"></span></span><strong class="tc-title">変化！</strong></div>
  <div class="tc-stage"><div class="tc-before"><img class="tc-before-image" alt=""></div><div class="tc-silhouette" aria-hidden="true"><img class="tc-silhouette-image" alt=""></div><div class="tc-after"><div class="tc-portrait-frame"><img class="tc-after-image" alt=""><span class="tc-card-corner" aria-hidden="true"></span></div><span class="tc-form-name"></span></div>${foregroundArt}</div>
  <div class="tc-energy-band tc-band-one" aria-hidden="true"></div><div class="tc-energy-band tc-band-two" aria-hidden="true"></div>
  <div class="tc-bottom"><span class="tc-phase-caption" aria-hidden="true"></span><button class="tc-skip" type="button" aria-label="変化の演出を省略">タップで省略 <span aria-hidden="true">↵</span></button></div>`;
 const base=dialog.querySelector<HTMLImageElement>('.tc-before-image')!;
 const silhouette=dialog.querySelector<HTMLImageElement>('.tc-silhouette-image')!;
 const after=dialog.querySelector<HTMLImageElement>('.tc-after-image')!;
 base.src=request.beforeSrc;silhouette.src=request.beforeSrc;after.src=request.afterSrc;
 base.alt=`変化前の${roster[identity].name}`;
 after.alt=`変化した${roster[identity].name}`;
 dialog.querySelector('.tc-form-name')!.textContent=request.formName??(identity==='imashiru'?'ピコーン閃いた！':`${roster[identity].name}の変化`);
 dialog.querySelector('.tc-signal')!.textContent=identity==='imashiru'?'INSIGHT SIGNAL':identity==='blue'?'CYAN SIGNAL':identity==='red'?'CRIMSON SIGNAL':`${identity.toUpperCase()} SIGNAL`;
 return dialog;
}

/**
 * A bounded modal animation, never a game-state controller.
 * The caller MUST await play() while its existing battle input lock is held.
 * All exits resolve once, including abort, pagehide, skip, replacement and destroy.
 */
export function createTransformationCinematic(options:TransformationOptions={}) {
 const doc=options.host?.ownerDocument??document;
 const win=doc.defaultView??window;
 const seenObjects=new WeakSet<object>(),seenValues=new Set<string|number>();
 let destroyed=false;
 let running:{id:TransformationRequest['eventId'];finish:(status:TransformationResult['status'],reason?:string)=>void}|undefined;
 const seen=(id:TransformationRequest['eventId'])=>typeof id==='object'?seenObjects.has(id):seenValues.has(id);
 const remember=(id:TransformationRequest['eventId'])=>{if(typeof id==='object')seenObjects.add(id);else seenValues.add(id);};
 const cancel=(reason='cancelled')=>running?.finish('cancelled',reason);
 return {
  get active():boolean{return !!running;},
  cancel,
  destroy():void {destroyed=true;cancel('destroyed');seenValues.clear();},
  play(request:TransformationRequest):Promise<TransformationResult> {
   if(destroyed)return Promise.resolve({status:'cancelled',reason:'destroyed'});
   if(!request.event||request.event.type!=='transformation'||!Object.hasOwn(roster,request.event.character)||(request.portraitCharacter!==undefined&&!Object.hasOwn(roster,request.portraitCharacter))||request.eventId==null||!request.beforeSrc||!request.afterSrc)return Promise.resolve({status:'invalid'});
   if(seen(request.eventId))return Promise.resolve({status:'duplicate'});
   if(request.signal?.aborted)return Promise.resolve({status:'cancelled',reason:'aborted'});
   cancel('superseded');
   remember(request.eventId);
   const timing=transformationTiming(request.motion);
   const short=transformationIsShort(request,win.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,doc.body.dataset.reducedMotion==='true');
   return new Promise<TransformationResult>(resolve=>{
    let done=false;
    let dialog:HTMLDialogElement|undefined;
    const timers:number[]=[];
    const removers:(()=>void)[]=[];
    const started=win.performance.now();
    const previousFocus=doc.activeElement;
    const listen=(target:EventTarget,type:string,listener:EventListener,options?:AddEventListenerOptions|boolean)=>{
     target.addEventListener(type,listener,options);removers.push(()=>target.removeEventListener(type,listener,options));
    };
    const finish=(status:TransformationResult['status'],reason?:string)=>{
     if(done)return;done=true;
     timers.forEach(timer=>win.clearTimeout(timer));
     removers.forEach(remove=>remove());
     if(dialog){try{if(dialog.open&&typeof dialog.close==='function')dialog.close();}catch{/* A removed host may already have closed it. */}dialog.remove();}
     if(running?.finish===finish)running=undefined;
     try{if(status!=='cancelled'&&previousFocus instanceof win.HTMLElement&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});}catch{/* Focus restoration must never delay the battle. */}
     resolve(reason?{status,reason}:{status});
    };
    running={id:request.eventId,finish};
    const sound=(cue:'charge'|'reveal')=>{try{options.onSound?.(cue,request.event.character);}catch{/* Audio can never hold a battle open. */}};
    const phase=(value:TransformationPhase)=>{
     if(done||!dialog)return;dialog.dataset.phase=value;
     dialog.querySelector('.tc-before')?.setAttribute('aria-hidden',String(value!=='before'));
     dialog.querySelector('.tc-after')?.setAttribute('aria-hidden',String(value!=='after'));
     const caption=dialog.querySelector('.tc-phase-caption');
     if(caption)caption.textContent=value==='before'?'シグナル、接続':value==='energy'?'エネルギー、展開':value==='after'?'変化 完了':'';
     if(value==='energy')sound('charge');
     if(value==='after')sound('reveal');
    };
    const schedule=(at:number,fn:()=>void)=>{if(!done)timers.push(win.setTimeout(fn,at));};
    const stopEvent=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
    const canSkip=()=>win.performance.now()-started>=TRANSFORMATION_TIMING.skipGuard;
    const click=(event:Event)=>{
     stopEvent(event);if(!canSkip())return;
     const pointer=event as MouseEvent;
     if(pointer.detail>0)try{options.onSkipPointer?.({clientX:pointer.clientX,clientY:pointer.clientY,detail:pointer.detail});}catch{/* Optional UI guard cannot hold the cinematic open. */}
     finish('skipped');
    };
    let skipKey='';
    const key=(event:Event)=>{
     const e=event as KeyboardEvent;
     // Block game keyboard shortcuts as well as skip keys. Tab remains in the native modal.
     if(e.key==='Tab')return;
     stopEvent(e);
     // Finish on keyup so the same Space/Enter cannot activate the underlying button.
     if(!e.repeat&&['Enter',' ','Escape'].includes(e.key)&&canSkip())skipKey=e.key;
    };
    const keyup=(event:Event)=>{const e=event as KeyboardEvent;if(e.key==='Tab')return;stopEvent(e);if(e.key===skipKey)finish('skipped');};
    try {
     dialog=makeDialog(doc,request,short);
     dialog.style.setProperty('--pace-scale',String(paceScale(request.motion??{short:false})));
     (options.host??doc.body).append(dialog);
     // Native top layer keeps input away from existing board and dialogs.
     if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
     listen(doc,'click',click,true);
     listen(doc,'keydown',key,true);
     listen(doc,'keyup',keyup,true);
     listen(dialog,'pointerdown',(e)=>e.stopImmediatePropagation());
     listen(dialog,'pointerup',(e)=>e.stopImmediatePropagation());
     listen(dialog,'contextmenu',stopEvent);
     listen(dialog,'cancel',(e)=>{stopEvent(e);if(canSkip())finish('skipped');});
     listen(dialog,'close',()=>finish('cancelled','closed'));
     listen(win,'pagehide',()=>finish('cancelled','pagehide'));
     if(request.signal)listen(request.signal,'abort',()=>finish('cancelled','aborted'),{once:true});
     dialog.querySelector<HTMLButtonElement>('.tc-skip')?.focus({preventScroll:true});
     // Durations are clock based: missing CSS, disabled animation, or a lost animationend cannot deadlock.
     if(short){phase('after');schedule(timing.total,()=>finish('completed'));}
     else {phase('before');schedule(timing.energy,()=>phase('energy'));schedule(timing.reveal,()=>phase('after'));schedule(timing.exit,()=>phase('exit'));schedule(timing.total,()=>finish('completed'));}
     if(request.signal?.aborted)finish('cancelled','aborted');
    } catch {finish('cancelled','presentation-unavailable');}
   });
  },
 };
}

import type {AnimationMotion} from './animationTimeline.ts';
import type {Actor,BattleEvent} from '../core/types.ts';

export interface PortraitReaction {
 readonly target:Actor;
 readonly kind:'hit'|'heal';
 readonly attacker?:Actor;
}
export interface PortraitReactionOptions {
 readonly signal?:AbortSignal;
 readonly motion:AnimationMotion;
}
export const PORTRAIT_REACTION_TIMING=Object.freeze({attack:160,hit:200,mark:240,static:120});

/** HP is read from the committed event; nominal damage or nominal healing cannot invent a hit. */
export function portraitReactionForEvent(event:BattleEvent):PortraitReaction|null {
 if(event.type==='heal')return event.amount>0&&event.hpAfter>event.hpBefore?{target:event.target,kind:'heal'}:null;
 if(event.type!=='attack'&&event.type!=='damage'&&event.type!=='instant-kill'&&event.type!=='type-damage')return null;
 const actualLoss=Math.max(0,event.hpBefore)-Math.max(0,event.hpAfter);
 if(!(actualLoss>0)||event.actor===event.target)return null;
 return {target:event.target,kind:'hit',attacker:event.actor};
}
const impactSvg='<svg viewBox="0 0 40 42" aria-hidden="true" focusable="false"><g class="portrait-impact-rays"><path d="m7 12 6 4m-9 5 7 1m-4 11 6-5"/><path class="portrait-impact-core" d="m18 12 2 6 6-1-4 5 4 5-6-1-2 6-2-6-6 1 4-5-4-5 6 1Z"/></g></svg>';
const healingSvg='<svg viewBox="0 0 40 42" aria-hidden="true" focusable="false"><ellipse class="portrait-heal-ring" cx="20" cy="22" rx="16" ry="17"/><path class="portrait-heal-plus" d="M20 5v8m-4-4h8"/></svg>';

/** Only the existing portrait moves. No HUD, HP bar, page, audio, or event timing is modified. */
export function createPortraitReactions(root:HTMLElement) {
 const hud=root.querySelector<HTMLElement>('.hud');
 const portraits={player:root.querySelector<HTMLElement>('#player-image'),enemy:root.querySelector<HTMLElement>('#enemy-image')};
 const seen=new WeakSet<object>();
 const systemMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let liveMotion:PortraitReactionOptions['motion']|undefined;
 let disposed=false;
 let captured=false;
 let active:(()=>void)|undefined;
 const clear=():void=>active?.();
 const resize=():void=>clear();
 const pagehide=():void=>clear();
 const settings=(event:Event):void=>{const value=(event as CustomEvent<PortraitReactionOptions['motion']>).detail;if(value&&typeof value.short==='boolean'&&typeof value.lowMotion==='boolean'){liveMotion=value;if(!captured||value.lowMotion)clear();}};
 const reducedNow=(motion:PortraitReactionOptions['motion']):boolean=>{
  if(motion.timeline)return motion.timeline.short||motion.lowMotion||document.body?.dataset.reducedMotion==='true'||!!systemMotion?.matches;
  const short=root.querySelector<HTMLInputElement>('#reduce')?.checked??liveMotion?.short??motion.short;
  const ui=document.body?.dataset.reducedMotion;
  return motion.short||motion.lowMotion||short||(ui===undefined?(liveMotion?.lowMotion??false):ui==='true')||!!systemMotion?.matches;
 };
 window.addEventListener('resize',resize);window.addEventListener('pagehide',pagehide);
 document.addEventListener('game1:presentation-settings',settings);systemMotion?.addEventListener('change',clear);
 return {
  play(event:BattleEvent,options:PortraitReactionOptions):boolean {
   // One cue owns the portraits at a time. Fast consecutive axes cannot accumulate transforms.
   clear();captured=!!options.motion.timeline;
   if(disposed||!hud||options.signal?.aborted||seen.has(event))return false;
   seen.add(event);
   const reaction=portraitReactionForEvent(event);
   if(!reaction)return false;
   const target=portraits[reaction.target];if(!target)return false;
   let layer:HTMLElement|undefined,timer:ReturnType<typeof setTimeout>|undefined;
   const animations:Animation[]=[];let finished=false;
   const finish=():void=>{
    if(finished)return;finished=true;
    if(timer!==undefined)clearTimeout(timer);options.signal?.removeEventListener('abort',finish);
    for(const animation of animations)try{animation.cancel();}catch{/* Portrait identity and source stay untouched. */}
    layer?.remove();if(active===finish)active=undefined;
   };
   try {
    const reduced=reducedNow(options.motion);
    const parent=hud.getBoundingClientRect(),bounds=target.getBoundingClientRect();
    if(![parent.left,parent.top,bounds.left,bounds.top,bounds.width,bounds.height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0)return false;
    layer=document.createElement('span');layer.className=`portrait-reaction-layer ${reaction.kind}`;layer.setAttribute('aria-hidden','true');layer.dataset.target=reaction.target;
    layer.style.left=`${bounds.left-parent.left-hud.clientLeft}px`;layer.style.top=`${bounds.top-parent.top-hud.clientTop}px`;layer.style.width=`${bounds.width}px`;layer.style.height=`${bounds.height}px`;
    layer.innerHTML=reaction.kind==='heal'?healingSvg:impactSvg;hud.append(layer);active=finish;
    options.signal?.addEventListener('abort',finish,{once:true});timer=setTimeout(finish,options.motion.timeline?.portrait.mark??(reduced?PORTRAIT_REACTION_TIMING.static:PORTRAIT_REACTION_TIMING.mark));
    if(!reduced){
     const track=(animation:Animation):void=>{animations.push(animation);animation.finished.catch(()=>{/* Normal cleanup rejects finished promises. */});};
     if(reaction.attacker){
      const attacker=portraits[reaction.attacker],direction=reaction.attacker==='player'?1:-1;
      if(attacker&&typeof attacker.animate==='function')track(attacker.animate([{transform:'translateX(0)'},{transform:`translateX(${direction*3}px)`,offset:.35},{transform:'translateX(0)'}],{duration:options.motion.timeline?.portrait.attack??PORTRAIT_REACTION_TIMING.attack,easing:'ease-out'}));
      if(typeof target.animate==='function')track(target.animate([{transform:'translateX(0) rotate(0deg)'},{transform:`translateX(${direction*3}px) rotate(${direction*3}deg)`,offset:.28},{transform:'translateX(0) rotate(0deg)'}],{duration:options.motion.timeline?.portrait.hit??PORTRAIT_REACTION_TIMING.hit,easing:'ease-out'}));
     }
     if(typeof layer.animate==='function')track(layer.animate([{opacity:1},{opacity:1,offset:.55},{opacity:0}],{duration:options.motion.timeline?.portrait.mark??PORTRAIT_REACTION_TIMING.mark,easing:'ease-out'}));
    }
    if(options.signal?.aborted){finish();return false;}
    return true;
   }catch{finish();return false;}
  },
  clear,
  dispose():void{if(disposed)return;disposed=true;clear();window.removeEventListener('resize',resize);window.removeEventListener('pagehide',pagehide);document.removeEventListener('game1:presentation-settings',settings);systemMotion?.removeEventListener('change',clear);},
 };
}

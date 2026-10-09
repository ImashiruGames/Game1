import type {BattleEvent,BattleState,Link,NormalSkillId} from '../core/types.ts';
import {recordedSkillActivations} from '../core/skillActivationRecord.ts';
import {buildSkills} from '../core/playerBuild.ts';
import {skillCatalog} from '../core/skillCatalog.ts';
import {LINK_PARTICLE_LAUNCH_MS} from './battleFeedback.ts';
import {energyLinkCue} from './energyLinks.ts';
import {animationTimeline} from './animationTimeline.ts';
import type {AnimationMotion} from './animationTimeline.ts';
export interface SkillActivationCue {readonly ids:readonly NormalSkillId[];readonly boxIds:readonly string[];readonly fire:boolean;readonly anchor?:'guard'|'charge'}
/** Only committed activations: no forecasting, condition re-evaluation, RNG or persistent data. */
export function skillActivationCue(event:BattleEvent,links:readonly Link[],state:BattleState):SkillActivationCue|null {
 const owned=new Set(buildSkills(state).map(s=>s.id));
 let ids:readonly NormalSkillId[]=recordedSkillActivations(event),boxIds:readonly string[]=[];
 if(event.type==='attack'&&event.actor==='enemy'&&ids.includes('first-guard')&&state.build?.fixed.id==='first-guard')return {ids:['first-guard'],boxIds:[],fire:false,anchor:'guard'};
 if(event.type==='gauge'&&event.source==='turn'&&event.after>event.before&&ids.includes('charge')&&state.build?.fixed.id==='charge')return {ids:['charge'],boxIds:[],fire:false,anchor:'charge'};
 if(event.type==='attack'){
  if(event.actor!=='player')return null;
  const link=energyLinkCue(event,links,state);if(!link)return null;
  boxIds=link.boxes.map(b=>b.id);if(!ids.length&&event.skillId)ids=[event.skillId];
 }else if((event.type==='damage'||event.type==='heal')&&event.shapeBoxIds?.length){
  const id=event.source as NormalSkillId;if(skillCatalog[id]?.kind!=='shape'||event.target!==(event.type==='heal'?'player':'enemy'))return null;
  ids=[id];boxIds=event.shapeBoxIds;
 }else if(event.type==='power-boost'&&event.boxIds.length&&ids.length)boxIds=event.boxIds;
 else return null;
 ids=[...new Set(ids)].filter(id=>owned.has(id)&&['shape','link'].includes(skillCatalog[id]?.kind));
 if(!ids.length||!boxIds.length||new Set(boxIds).size!==boxIds.length||boxIds.some(id=>!state.boxes.some(b=>b.id===id&&b.owner==='player')))return null;
 return {ids,boxIds,fire:ids.includes('grow-fire')&&event.type==='attack'};
}
export type CharacterSkillTheme='blue'|'mint'|'amber'|'violet'|'silver'|'rose'|'imashiru';
export function characterSkillTheme(cue:SkillActivationCue,state:BattleState):CharacterSkillTheme|null {
 const fixed=state.build?.fixed.id,id=state.config.meta?.rosterId??state.config.characterId;
 if(!fixed||!cue.ids.includes(fixed))return null;
 const skills:Record<string,readonly NormalSkillId[]>={blue:['health'],mint:['combo-unit','corner-strike'],amber:['square-strike'],violet:['death-arrow','diagonal-shot'],silver:['first-guard'],rose:['horizontal-slash'],imashiru:['charge']};
 return id&&skills[id]?.includes(fixed)?id as CharacterSkillTheme:null;
}
interface Rect {left:number;top:number;width:number;height:number}
const valid=(r:Rect)=>[r.left,r.top,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
const same=(a:Rect,b:Rect)=>['left','top','width','height'].every(k=>Math.abs(a[k as keyof Rect]-b[k as keyof Rect])<.5);
/** One bounded overlay. It survives identical DOM replacement and disappears on geometry/state changes. */
export function createSkillActivationEffects(root:HTMLElement){
 const area=root.querySelector<HTMLElement>('.game')??root;
 const system=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let disposed=false,active:{clear:()=>void;matches:()=>boolean;tail:boolean}|undefined;
 const seen=new WeakSet<object>();
 const clear=()=>active?.clear();
 const refresh=()=>{if(active&&!active.matches())clear();};
 const visibility=()=>{if(document.hidden)clear();};
 const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(refresh);observer?.observe(area);
 window.addEventListener('resize',clear);window.addEventListener('scroll',clear,true);window.addEventListener('pagehide',clear);
 document.addEventListener('visibilitychange',visibility);document.addEventListener('game1:presentation-settings',clear);system?.addEventListener('change',clear);
 return {
  play(event:BattleEvent,links:readonly Link[],state:BattleState,signal:AbortSignal,motion:AnimationMotion):boolean {
   if(disposed||signal.aborted||document.hidden||seen.has(event))return false;
   const cue=skillActivationCue(event,links,state);if(!cue)return false;clear();seen.add(event);
   const theme=characterSkillTheme(cue,state);
   let layer:HTMLElement|undefined,timer:ReturnType<typeof setTimeout>|undefined,finished=false;
   const animations:Animation[]=[];
   const finish=()=>{if(finished)return;finished=true;if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',finish);for(const a of animations)try{a.cancel();}catch{}layer?.remove();if(active?.clear===finish)active=undefined;};
   try{
    const bounds=area.getBoundingClientRect();if(!area.isConnected||!valid(bounds))return false;
    const icons=cue.ids.flatMap(id=>{const node=root.querySelector<HTMLElement>('.skill-trigger--'+id),rect=node?.getBoundingClientRect();return node?.isConnected&&rect&&valid(rect)?[{id,rect}]:[];});
    const board=root.querySelector<HTMLElement>('#board');
    const cells=cue.boxIds.flatMap(id=>{const box=state.boxes.find(b=>b.id===id)!;const selector='[data-cell-row="'+box.row+'"][data-cell-col="'+box.col+'"]',node=board?.querySelector<HTMLElement>(selector),rect=node?.getBoundingClientRect();return node?.isConnected&&node.dataset.boxId===id&&node.classList.contains('player')&&rect&&valid(rect)?[{id,selector,rect}]:[];});
    const anchorNode=cue.anchor?root.querySelector<HTMLElement>(cue.anchor==='guard'?'#player-image':'#gauge-text'):null,anchorRect=anchorNode?.getBoundingClientRect();
    const anchor=anchorNode?.isConnected&&anchorRect&&valid(anchorRect)?anchorRect:null;
    if(!icons.length&&!cells.length&&!anchor)return false;
    const profile=motion.timeline??animationTimeline(motion),budget=event.type==='attack'?profile.attack:profile.feedback;
    const reduced=profile.short||motion.lowMotion||!!system?.matches||document.body.dataset.reducedMotion==='true'||!!root.querySelector<HTMLInputElement>('#reduce')?.checked;
    // Reserve both arrival and ignition inside the existing earliest attack launch, regardless of pace.
    const duration=cue.anchor==='charge'?150:budget.lead+budget.hold,relayWindow=Math.max(0,Math.min(LINK_PARTICLE_LAUNCH_MS,budget.lead));
    const flight=relayWindow*.6,ignited=relayWindow*.85;
    layer=document.createElement('div');layer.className='skill-activation-layer'+(reduced?' is-still':'');layer.setAttribute('aria-hidden','true');
    const center=(r:Rect)=>({x:r.left-bounds.left-area.clientLeft+r.width/2,y:r.top-bounds.top-area.clientTop+r.height/2});
    const animate=(node:HTMLElement,frames:Keyframe[],options:KeyframeAnimationOptions)=>{
     if(reduced||typeof node.animate!=='function')return false;
     try{const a=node.animate(frames,options);animations.push(a);a.finished.catch(()=>{});return true;}catch{return false;}
    };
    const rim=(rect:Rect,cls:string,delay=0,peakAt?:number)=>{
     const n=document.createElement('span'),p=center(rect);n.className=cls;n.style.left=(p.x-rect.width/2-2)+'px';n.style.top=(p.y-rect.height/2-2)+'px';n.style.width=(rect.width+4)+'px';n.style.height=(rect.height+4)+'px';layer!.append(n);
     animate(n,[{opacity:0},{opacity:1,offset:peakAt===undefined?.2:(peakAt-delay)/Math.max(1,duration-delay)},{opacity:.7,offset:.6},{opacity:0}],{duration:Math.max(1,duration-delay),delay,fill:'both',easing:'ease-out'});return n;
    };
    const accent=(rect:Rect)=>{
     if(!theme||reduced)return;
     const n=rim(rect,'skill-character-accent theme-'+theme);animate(n,theme==='rose'?[{transform:'scaleX(.1)',opacity:0},{transform:'scaleX(1)',opacity:.85,offset:.4},{transform:'scaleX(1)',opacity:0}]:[{transform:'scale(.92)',opacity:0},{transform:'scale(1.04)',opacity:.8,offset:.35},{transform:'scale(1.08)',opacity:0}],{duration,fill:'both',easing:'ease-out'});
    };
    for(const icon of icons){rim(icon.rect,'skill-activation-icon'+(icon.id==='grow-fire'?' is-fire':theme&&icon.id===state.build?.fixed.id?' theme-'+theme:''));if(theme&&icon.id===state.build?.fixed.id)accent(icon.rect);}
    if(anchor){rim(anchor,'skill-activation-box'+(theme?' theme-'+theme:''));if(cue.anchor==='guard')accent(anchor);}
    const source=icons.find(i=>i.id==='grow-fire');
    // Missing icon/WAAPI/fast motion falls back to local outlines, with no invented origin.
    if(cue.fire||!icons.length||theme)for(const cell of cells){
     let flying=false;
     if(cue.fire&&source&&!reduced&&flight>0){
      const a=center(source.rect),b=center(cell.rect);
      for(let j=0;j<2;j++){
       const spark=document.createElement('i');spark.className='skill-fire-seed';layer.append(spark);
       const ok=animate(spark,[{transform:'translate('+a.x+'px,'+a.y+'px)',opacity:j?.4:1},{transform:'translate('+((a.x+b.x)/2+(j?5:-5))+'px,'+((a.y+b.y)/2-16)+'px)',opacity:j?.4:1,offset:.5},{transform:'translate('+b.x+'px,'+(b.y-cell.rect.height*.4)+'px)',opacity:0}],{duration:flight,delay:0,fill:'both',easing:'cubic-bezier(.3,0,.7,1)'});
       if(!ok)spark.remove();else flying=true;
      }
     }
     rim(cell.rect,'skill-activation-box'+(cue.fire?' is-fire':theme?' theme-'+theme:''),flying?flight:0,flying?ignited:undefined);if(theme)accent(cell.rect);
    }
    area.append(layer);
    active={clear:finish,tail:cue.anchor==='charge',matches:()=>{
     if(!area.isConnected||document.hidden||!same(area.getBoundingClientRect(),bounds))return false;
     if(anchor){const node=root.querySelector<HTMLElement>(cue.anchor==='guard'?'#player-image':'#gauge-text');if(!node?.isConnected||!same(node.getBoundingClientRect(),anchor))return false;}
     return icons.every(i=>{const n=root.querySelector<HTMLElement>('.skill-trigger--'+i.id);return !!n?.isConnected&&same(n.getBoundingClientRect(),i.rect);})&&cells.every(c=>{const n=root.querySelector<HTMLElement>('#board')?.querySelector<HTMLElement>(c.selector);return !!n?.isConnected&&n.dataset.boxId===c.id&&n.classList.contains('player')&&same(n.getBoundingClientRect(),c.rect);});
    }};
    signal.addEventListener('abort',finish,{once:true});timer=setTimeout(finish,duration);
    if(signal.aborted){finish();return false;}return true;
   }catch{finish();return false;}
  },clear,refresh,
  finish(){if(!active?.tail||document.hidden)clear();},
  dispose(){if(disposed)return;disposed=true;clear();observer?.disconnect();window.removeEventListener('resize',clear);window.removeEventListener('scroll',clear,true);window.removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('game1:presentation-settings',clear);system?.removeEventListener('change',clear);},
 };
}

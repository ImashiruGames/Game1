import type {BattleEvent,BattleState,Box,Link} from '../core/types.ts';
import type {AnimationMotion} from './battleAnimator.ts';
import {energyTheme,energyAppearance} from './energyBox.ts';
import {eventFeedbackTiming,LINK_PARTICLE_LAUNCH_MS,LINK_PARTICLE_STAGGER_MS} from './battleFeedback.ts';
export interface EnergyLinkCue {readonly actor:'player'|'enemy';readonly target:'player'|'enemy';readonly theme:string;readonly boxes:readonly Box[]}
/** Exact committed axis, never a board scan or a passive-link detector. */
export function energyLinkCue(event:BattleEvent,links:readonly Link[],state:BattleState):EnergyLinkCue|null {
 if(event.type!=='attack')return null;
 const link=links.find(item=>item.axis===event.axis);
 if(!link||link.boxIds.length!==event.linkCount||new Set(link.boxIds).size!==link.boxIds.length)return null;
 const boxes=link.boxIds.map(id=>state.boxes.find(box=>box.id===id));
 if(boxes.some(box=>!box||box.owner!==event.actor))return null;
 const ordered=(boxes as Box[]).slice().sort((a,b)=>event.axis==='horizontal'?a.col-b.col:a.row-b.row);
 if(ordered.some((box,index)=>{if(!index)return false;const prior=ordered[index-1]!;return event.axis==='horizontal'?box.row!==prior.row||box.col!==prior.col+1:event.axis==='vertical'?box.col!==prior.col||box.row!==prior.row+1:event.axis==='diagonal-down'?box.row!==prior.row+1||box.col!==prior.col+1:box.row!==prior.row+1||box.col!==prior.col-1;}))return null;
 return {actor:event.actor,target:event.target,theme:energyTheme(event.actor,energyAppearance(state)),boxes:ordered};
}
interface Rect {left:number;top:number;width:number;height:number}
const valid=(r:Rect)=>[r.left,r.top,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
const same=(a:Rect,b:Rect)=>['left','top','width','height'].every(key=>Math.abs(a[key as keyof Rect]-b[key as keyof Rect])<.5);
/** A single axis overlay lives inside the existing feedback budget; cells and controls stay real. */
export function createEnergyLinks(root:HTMLElement){
 const area=root.querySelector<HTMLElement>('.game')??root,board=root.querySelector<HTMLElement>('#board');
 const system=window.matchMedia?.('(prefers-reduced-motion: reduce)'),seen=new WeakSet<object>();
 let active:{event:BattleEvent;impact:()=>void;clear:()=>void;matches:()=>boolean}|undefined,disposed=false,captured=false,live:AnimationMotion|undefined;
 const clear=()=>active?.clear();
 const settings=(event:Event)=>{const value=(event as CustomEvent<AnimationMotion>).detail;if(value&&typeof value.short==='boolean'&&typeof value.lowMotion==='boolean'){live=value;if(!captured)document.body.dataset.energyShort=String(value.short);}if(!captured||value?.lowMotion)clear();};
 window.addEventListener('resize',clear);window.addEventListener('pagehide',clear);document.addEventListener('game1:presentation-settings',settings);system?.addEventListener('change',clear);
 const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{if(active&&!active.matches())clear();});observer?.observe(area);if(board)observer?.observe(board);
 return {
  play(event:BattleEvent,links:readonly Link[],state:BattleState,signal:AbortSignal,motion:AnimationMotion):boolean{
   if(disposed||signal.aborted||seen.has(event))return false;
   clear();captured=!!motion.timeline;const cue=energyLinkCue(event,links,state);if(!cue||!board)return false;seen.add(event);
   let layer:HTMLElement|undefined,timer:ReturnType<typeof setTimeout>|undefined,finished=false;const animations:Animation[]=[],particles:HTMLElement[]=[];
   const finish=()=>{if(finished)return;finished=true;if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',finish);for(const animation of animations)try{animation.cancel();}catch{}layer?.remove();if(active?.clear===finish)active=undefined;};
   try{
    const bounds=area.getBoundingClientRect(),boardBounds=board.getBoundingClientRect(),target=root.querySelector<HTMLElement>(`#${cue.target}-image`),targetBounds=target?.getBoundingClientRect();
    if(!area.isConnected||!board.isConnected||!valid(bounds)||!targetBounds||!valid(targetBounds))return false;
    const nodes=cue.boxes.map(box=>board.querySelector<HTMLElement>(`[data-cell-row="${box.row}"][data-cell-col="${box.col}"]`));
    if(nodes.some((node,i)=>!node||node.dataset.boxId!==cue.boxes[i]!.id||!node.classList.contains(cue.actor)))return false;
    const rects=nodes.map(node=>node!.getBoundingClientRect());if(rects.some(r=>!valid(r)))return false;
    const center=(r:Rect)=>({x:r.left-bounds.left-area.clientLeft+r.width/2,y:r.top-bounds.top-area.clientTop+r.height/2});
    const points=rects.map(center),end=center(targetBounds);
    if([...points,end].some(p=>p.x<0||p.y<0||p.x>bounds.width||p.y>bounds.height))return false;
    const reduced=(motion.timeline?.short??(motion.short||motion.lowMotion||!!live?.short||!!live?.lowMotion||!!root.querySelector<HTMLInputElement>('#reduce')?.checked||document.body.dataset.reducedMotion==='true'||!!system?.matches))||motion.lowMotion||document.body.dataset.reducedMotion==='true'||!!system?.matches;
    const budget=motion.timeline?.attack??eventFeedbackTiming(event,reduced),duration=budget.lead+budget.hold;
    layer=document.createElement('div');layer.className=`energy-link-layer ${cue.actor}${reduced?' is-still':''}`;layer.dataset.energyTheme=cue.theme;layer.dataset.axis=event.type==='attack'?event.axis:'';layer.dataset.phase='flight';layer.setAttribute('aria-hidden','true');
    const animate=(node:HTMLElement,frames:Keyframe[],options:KeyframeAnimationOptions)=>{if(reduced||typeof node.animate!=='function')return;try{const animation=node.animate(frames,options);animations.push(animation);animation.finished.catch(()=>{});}catch{}};
    for(const [index,p] of points.entries()){
     const delay=points.length>1?index/(points.length-1)*80:0;
     const node=document.createElement('span');node.className='energy-link-node';node.dataset.boxId=cue.boxes[index]!.id;node.style.left=`${p.x}px`;node.style.top=`${p.y}px`;layer.append(node);
     animate(node,[{opacity:0},{opacity:1}],{duration:20,delay,fill:'both'});
     if(index){const prior=points[index-1]!,dx=p.x-prior.x,dy=p.y-prior.y,line=document.createElement('span');line.className='energy-link-line';line.style.left=`${prior.x}px`;line.style.top=`${prior.y}px`;line.style.width=`${Math.hypot(dx,dy)}px`;const rotate=`rotate(${Math.atan2(dy,dx)}rad)`;line.style.transform=rotate;layer.append(line);animate(line,[{transform:`${rotate} scaleX(0)`,opacity:.2},{transform:`${rotate} scaleX(1)`,opacity:.85}],{duration:Math.max(15,80/(points.length-1)),delay:Math.max(0,delay-80/(points.length-1)),fill:'both',easing:'ease-out'});}
     if(!reduced){const spark=document.createElement('i');spark.className='energy-attack-particle';spark.style.opacity='0';layer.append(spark);particles.push(spark);const launch=LINK_PARTICLE_LAUNCH_MS+index/Math.max(1,points.length-1)*LINK_PARTICLE_STAGGER_MS;animate(spark,[{transform:`translate(${p.x}px,${p.y}px)`,opacity:1},{transform:`translate(${p.x+(end.x-p.x)*.35}px,${p.y+(end.y-p.y)*.5-12}px)`,opacity:1,offset:.4},{transform:`translate(${end.x}px,${end.y}px)`,opacity:1}],{duration:budget.lead-launch,delay:launch,fill:'both',easing:'cubic-bezier(.4,0,.65,1)'});}
    }
    area.append(layer);active={event,impact:()=>{if(finished)return;layer!.dataset.phase='impact';for(const particle of particles)particle.remove();},clear:finish,matches:()=>area.isConnected&&board.isConnected&&same(area.getBoundingClientRect(),bounds)&&same(board.getBoundingClientRect(),boardBounds)};
    signal.addEventListener('abort',finish,{once:true});timer=setTimeout(finish,duration);if(signal.aborted){finish();return false;}return true;
   }catch{finish();return false;}
  },
  // End the same event's flight in the HP-render task, even if a throttled animation missed a frame.
  impact(event:BattleEvent){if(active?.event===event)active.impact();},clear,
  dispose(){if(disposed)return;disposed=true;clear();observer?.disconnect();window.removeEventListener('resize',clear);window.removeEventListener('pagehide',clear);document.removeEventListener('game1:presentation-settings',settings);system?.removeEventListener('change',clear);},
 };
}

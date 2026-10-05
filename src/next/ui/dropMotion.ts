import type {AnimationMotion} from './animationTimeline.ts';
import {energyBoxMarkup} from './energyBox.ts';
import type {EnergyAppearance} from './energyBox.ts';
import type {Cell,DropEvent} from '../core/types.ts';

export interface DropMotionOptions {
 readonly signal?:AbortSignal;
 readonly motion:AnimationMotion;
}
export interface DropMotionRect {readonly left:number;readonly top:number;readonly width:number;readonly height:number}
export interface DropMotionPoint {readonly x:number;readonly y:number}
export interface DropMotionGeometry {
 readonly width:number;readonly height:number;readonly points:readonly DropMotionPoint[];
}
export const DROP_MOTION_TIMING=Object.freeze({fall:120,land:60,total:180});
const sameCell=(a:Cell,b:Cell)=>a.row===b.row&&a.col===b.col;
const validRect=(r:DropMotionRect)=>[r.left,r.top,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;

/** Read the emitted route, never calculate a replacement landing or cross an internal ceiling. */
export function dropMotionGeometry(event:DropEvent,area:DropMotionRect,rects:readonly DropMotionRect[]):DropMotionGeometry|null {
 const path=event.path,last=path.at(-1);
 if(!last||rects.length!==path.length||!validRect(area)||!sameCell(path[0]!,event.spawn)||!sameCell(last,event.landing)||!sameCell(event.box,event.landing))return null;
 if(path.some((cell,i)=>!Number.isInteger(cell.row)||!Number.isInteger(cell.col)||cell.row<0||cell.col<0||(i>0&&(cell.col!==path[i-1]!.col||cell.row!==path[i-1]!.row+1))))return null;
 const end=rects.at(-1)!;
 if(rects.some(r=>!validRect(r)||Math.abs(r.width-end.width)>.5||Math.abs(r.height-end.height)>.5))return null;
 const points=rects.map(r=>({x:r.left-area.left,y:r.top-area.top}));
 // Fail closed if the DOM no longer represents this route or the board resized mid-read.
 if(points.some((p,i)=>p.x<-.5||p.y<-.5||p.x+end.width>area.width+.5||p.y+end.height>area.height+.5||(i>0&&(Math.abs(p.x-points[i-1]!.x)>.5||p.y<=points[i-1]!.y))))return null;
 return {width:end.width,height:end.height,points};
}

/** Acceleration uses only event path positions; the landing never moves outside its real cell. */
export function dropMotionFrames(geometry:DropMotionGeometry):Keyframe[] {
 const {points}=geometry,end=points.at(-1)!;
 const transform=(point:DropMotionPoint,scaleY=1)=>`translate(${point.x}px, ${point.y}px) scaleY(${scaleY})`;
 const frames:Keyframe[]=points.length===1?[{transform:transform(end),offset:0}]:points.map((point,i)=>({transform:transform(point),offset:(DROP_MOTION_TIMING.fall/DROP_MOTION_TIMING.total)*Math.sqrt(i/(points.length-1))}));
 if(points.length===1)frames.push({transform:transform(end),offset:DROP_MOTION_TIMING.fall/DROP_MOTION_TIMING.total});
 // Vertical compression stays inside the landing cell, so it never clips into terrain below.
 frames.push({transform:transform(end,.9),offset:.79},{transform:transform(end),offset:1});
 return frames;
}

/** A non-blocking decoration. The caller retains its existing 180ms/15ms event pause. */
export function createDropMotion(root:HTMLElement,appearance:()=>EnergyAppearance=()=>({})) {
 const area=root.querySelector<HTMLElement>('.board-area');
 const board=root.querySelector<HTMLElement>('#board');
 const seen=new WeakSet<object>();
 const systemMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let liveMotion:DropMotionOptions['motion']|undefined;
 let disposed=false;
 let captured=false;
 let active:{clear:()=>void;matchesLayout:()=>boolean}|undefined;
 const clear=():void=>{active?.clear();};
 const resize=():void=>clear();
 const pagehide=():void=>clear();
 const settings=(event:Event):void=>{const value=(event as CustomEvent<DropMotionOptions['motion']>).detail;if(value&&typeof value.short==='boolean'&&typeof value.lowMotion==='boolean'){liveMotion=value;if(!captured||value.lowMotion)clear();}};
 const reducedNow=(motion:DropMotionOptions['motion']):boolean=>{
  if(motion.timeline)return motion.timeline.short||motion.lowMotion||document.body?.dataset.reducedMotion==='true'||!!systemMotion?.matches;
  const short=root.querySelector<HTMLInputElement>('#reduce')?.checked??liveMotion?.short??motion.short;
  const ui=document.body?.dataset.reducedMotion;
  // A resolution already on the 15ms budget cannot be lengthened by turning motion back on.
  return motion.short||motion.lowMotion||short||(ui===undefined?(liveMotion?.lowMotion??false):ui==='true')||!!systemMotion?.matches;
 };
 window.addEventListener('resize',resize);
 window.addEventListener('pagehide',pagehide);
 document.addEventListener('game1:presentation-settings',settings);
 systemMotion?.addEventListener('change',clear);
 const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{if(active&&!active.matchesLayout())clear();});
 if(area)observer?.observe(area);
 if(board)observer?.observe(board);
 return {
  play(event:DropEvent,options:DropMotionOptions):boolean {
   clear();captured=!!options.motion.timeline;
   if(disposed||!area||!board||options.signal?.aborted||seen.has(event))return false;
   seen.add(event);
   // Static landing is the real, already-rendered box. Never mask it in short/reduced mode.
   if(reducedNow(options.motion))return false;
   let layer:HTMLElement|undefined,cell:HTMLElement|undefined,animation:Animation|undefined;
   let timer:ReturnType<typeof setTimeout>|undefined;
   let finished=false;
   const finish=():void=>{
    if(finished)return;finished=true;
    if(timer!==undefined)clearTimeout(timer);
    options.signal?.removeEventListener('abort',finish);
    // Remove only our class from the exact old cell, even after a render detached it.
    cell?.classList.remove('kinetic-drop-masked');
    try{animation?.cancel();}catch{/* A decorative animation cannot hold the real box hidden. */}
    layer?.remove();
    if(active?.clear===finish)active=undefined;
   };
   try {
    const cells=event.path.map(point=>board.querySelector<HTMLElement>(`[data-cell-row="${point.row}"][data-cell-col="${point.col}"]`));
    if(cells.some(node=>!node||node.classList.contains('terrain')||node.classList.contains('invalid')))return false;
    cell=cells.at(-1)!;
    if(!cell?.classList.contains(event.box.owner))return false;
    const areaRect=area.getBoundingClientRect(),rects=cells.map(node=>node!.getBoundingClientRect());
    const geometry=dropMotionGeometry(event,areaRect,rects);
    if(!geometry)return false;
    layer=document.createElement('div');layer.className='kinetic-drop-layer';layer.setAttribute('aria-hidden','true');
    const box=document.createElement('span');box.className=`kinetic-drop-box ${event.box.owner}`;box.innerHTML=energyBoxMarkup(event.box,appearance());
    box.style.width=`${geometry.width}px`;box.style.height=`${geometry.height}px`;box.style.fontSize=`${geometry.width*.42}px`;
    const first=geometry.points[0]!;box.style.transform=`translate(${first.x}px, ${first.y}px)`;
    layer.append(box);area.append(layer);
    // Unsupported or failed WAAPI leaves the real landing visible, with no synthetic fall.
    if(typeof box.animate!=='function'){finish();return false;}
    animation=box.animate(dropMotionFrames(geometry),{duration:options.motion.timeline?.drop??DROP_MOTION_TIMING.total,easing:'linear',fill:'both'});
    // Attach rejection handling before any later setup can fail and cancel the animation.
    animation.finished.catch(finish);
    active={clear:finish,matchesLayout:()=>{
     if(!cell?.isConnected||cells.some(node=>!node?.isConnected))return false;
     const now=area.getBoundingClientRect();
     return ['left','top','width','height'].every(key=>Math.abs(now[key as keyof DropMotionRect]-areaRect[key as keyof DropMotionRect])<.5)
      &&cells.every((node,i)=>{const next=node!.getBoundingClientRect(),prior=rects[i]!;return ['left','top','width','height'].every(key=>Math.abs(next[key as keyof DropMotionRect]-prior[key as keyof DropMotionRect])<.5);});
    }};
    options.signal?.addEventListener('abort',finish,{once:true});
    timer=setTimeout(finish,options.motion.timeline?.drop??DROP_MOTION_TIMING.total);
    if(options.signal?.aborted){finish();return false;}
    cell.classList.add('kinetic-drop-masked');
    return true;
   }catch{finish();return false;}
  },
  clear,
  dispose():void {if(disposed)return;disposed=true;clear();observer?.disconnect();window.removeEventListener('resize',resize);window.removeEventListener('pagehide',pagehide);document.removeEventListener('game1:presentation-settings',settings);systemMotion?.removeEventListener('change',clear);},
 };
}

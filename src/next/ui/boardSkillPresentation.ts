import type {AnimationMotion} from './animationTimeline.ts';
import {kitBoardCatalog} from '../core/kitBoards.ts';
import {energyBoxMarkup,energyAppearance} from './energyBox.ts';
import type {BattleEvent,BattleState,BoardSkillId,Cell,Resolution,Box} from '../core/types.ts';

export type BoardSkillEvent=Extract<BattleEvent,{type:'board-skill'|'row-cleared'|'boxes-converted'}>;
export interface BoardSkillPresentationOptions {
 readonly signal?:AbortSignal;
 readonly motion:AnimationMotion;
}
export interface BoardSkillTarget extends Cell {readonly id:string;readonly type?:Box['type']}
export interface BoardSkillCue {
 readonly activation:Extract<BattleEvent,{type:'board-skill'}>;
 readonly skillId:BoardSkillId;
 readonly name:string;
 readonly phase:'activation'|'clear-row'|'convert';
 readonly row?:number;
 readonly targets:readonly BoardSkillTarget[];
}
export const BOARD_SKILL_PRESENTATION_TIMING=Object.freeze({name:760,effect:420,static:240});
const names={'pain-shared':'痛みはお互いに',ember:'ほむらの火種','imashiru-insight':'いま、知りたい！',...Object.fromEntries(Object.values(kitBoardCatalog).map(d=>[d.id,d.name]))} as Readonly<Record<BoardSkillId,string>>;

/** Caller supplies a committed resolution; exact event membership rejects stale/foreign calls. */
export function boardSkillCueForEvent(event:BattleEvent,resolution:Resolution,before:BattleState):BoardSkillCue|null {
 if(resolution.actor!=='player'||(event.type!=='board-skill'&&event.type!=='row-cleared'&&event.type!=='boxes-converted'))return null;
 const index=resolution.events.indexOf(event);
 if(index<0)return null;
 let activation:Extract<BattleEvent,{type:'board-skill'}>|undefined;
 for(let prior=index;prior>=0;prior--){const item=resolution.events[prior];if(item?.type==='board-skill'){activation=item;break;}}
 if(!activation||activation.type!=='board-skill'||activation.actor!=='player'||!Object.hasOwn(names,activation.skillId))return null;
 const {width,height}=before.config.board;
 const validCell=(cell:Cell)=>Number.isInteger(cell.row)&&Number.isInteger(cell.col)&&cell.row>=0&&cell.row<height&&cell.col>=0&&cell.col<width;
 if(activation.skillId==='pain-shared'&&(!Number.isInteger(activation.row)||activation.row!<0||activation.row!>=height))return null;
 const base={activation,skillId:activation.skillId,name:names[activation.skillId]};
 if(event.type==='board-skill')return {...base,phase:'activation',targets:[]};
 if(event.type==='row-cleared'&&(activation.skillId!=='pain-shared'||event.row!==activation.row))return null;
 if(event.type==='boxes-converted'&&(activation.skillId!=='ember'||event.actor!=='player'||event.from!=='enemy'||event.to!=='player'))return null;
 if(new Set(event.boxIds).size!==event.boxIds.length)return null;
 const targets:BoardSkillTarget[]=[];
 for(const id of event.boxIds){
  const box=before.boxes.find(item=>item.id===id);
  if(!box||!validCell(box)||(event.type==='row-cleared'?box.row!==event.row:box.owner!=='enemy'))return null;
  targets.push({id:box.id,row:box.row,col:box.col,...(event.type==='boxes-converted'&&box.type!=='normal'?{type:box.type}:{})});
 }
 return event.type==='row-cleared'?{...base,phase:'clear-row',row:event.row,targets}:{...base,phase:'convert',targets};
}

interface Rect {readonly left:number;readonly top:number;readonly width:number;readonly height:number}
const validRect=(r:Rect)=>[r.left,r.top,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
const sameRect=(a:Rect,b:Rect)=>Math.abs(a.left-b.left)<.5&&Math.abs(a.top-b.top)<.5&&Math.abs(a.width-b.width)<.5&&Math.abs(a.height-b.height)<.5;
const contained=(r:Rect,area:Rect)=>validRect(r)&&r.left>=area.left-.5&&r.top>=area.top-.5&&r.left+r.width<=area.left+area.width+.5&&r.top+r.height<=area.top+area.height+.5;

/** Sync-only decoration. No cell is hidden or changed, no interaction or phase wait is added. */
export function createBoardSkillPresentation(root:HTMLElement) {
 const area=root.querySelector<HTMLElement>('.board-area'),board=root.querySelector<HTMLElement>('#board'),drops=root.querySelector<HTMLElement>('#drop-buttons');
 const seen=new WeakSet<object>(),systemMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 let liveMotion:BoardSkillPresentationOptions['motion']|undefined,disposed=false,captured=false;
 let active:{insetTop:number;clear:()=>void;matchesLayout:()=>boolean}|undefined;
 const clear=():void=>active?.clear();
 const settings=(event:Event):void=>{
  const value=(event as CustomEvent<BoardSkillPresentationOptions['motion']>).detail;
  if(value&&typeof value.short==='boolean'&&typeof value.lowMotion==='boolean'){liveMotion=value;if(!captured||value.lowMotion)clear();}
 };
 const reducedNow=(motion:BoardSkillPresentationOptions['motion']):boolean=>{
  if(motion.timeline)return motion.timeline.short||motion.lowMotion||document.body?.dataset.reducedMotion==='true'||!!systemMotion?.matches;
  const short=root.querySelector<HTMLInputElement>('#reduce')?.checked??liveMotion?.short??false;
  const ui=document.body?.dataset.reducedMotion;
  return motion.short||motion.lowMotion||short||(ui===undefined?(liveMotion?.lowMotion??false):ui==='true')||!!systemMotion?.matches;
 };
 window.addEventListener('resize',clear);window.addEventListener('pagehide',clear);
 document.addEventListener('game1:presentation-settings',settings);systemMotion?.addEventListener('change',clear);
 const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{if(active&&!active.matchesLayout())clear();});
 if(area)observer?.observe(area);if(board)observer?.observe(board);if(drops)observer?.observe(drops);
 return {
  play(event:BattleEvent,resolution:Resolution,before:BattleState,options:BoardSkillPresentationOptions):boolean {
   if(disposed||options.signal?.aborted||seen.has(event)||!resolution.events.includes(event))return false;
   // Unrelated event renders preserve this short cue: conversion may immediately precede an enemy action.
   if(!area||!board||!drops)return false;
   const cue=boardSkillCueForEvent(event,resolution,before);
   if(!cue)return false;
   seen.add(event);clear();captured=!!options.motion.timeline;
   let layer:HTMLElement|undefined,timer:ReturnType<typeof setTimeout>|undefined,finished=false;
   const animations:Animation[]=[];
   const finish=():void=>{
    if(finished)return;finished=true;
    if(timer!==undefined)clearTimeout(timer);options.signal?.removeEventListener('abort',finish);
    for(const animation of animations)try{animation.cancel();}catch{/* Owned decoration only; the real board always remains visible. */}
    layer?.remove();if(active?.clear===finish)active=undefined;
   };
   try {
    const areaRect=area.getBoundingClientRect(),boardRect=board.getBoundingClientRect(),dropsRect=drops.getBoundingClientRect();
    if(!area.isConnected||!board.isConnected||!drops.isConnected||!validRect(areaRect)||!contained(boardRect,areaRect)||!contained(dropsRect,areaRect))return false;
    const reduced=reducedNow(options.motion);
    layer=document.createElement('div');layer.className=`board-skill-layer ${cue.skillId}${reduced?' is-static':''}`;
    layer.dataset.skillId=cue.skillId;layer.dataset.phase=cue.phase;layer.setAttribute('aria-hidden','true');
    const place=(node:HTMLElement,rect:Rect):void=>{
     node.style.left=`${rect.left-areaRect.left-area.clientLeft}px`;node.style.top=`${rect.top-areaRect.top-area.clientTop}px`;
     node.style.width=`${rect.width}px`;node.style.height=`${rect.height}px`;
    };
    const badge=document.createElement('div');badge.className='board-skill-name';badge.textContent=cue.phase==='convert'?`${cue.name} · 敵箱${cue.targets.length}個 → 自箱`:cue.name;
    place(badge,dropsRect);layer.append(badge);
    const animate=(node:HTMLElement,frames:Keyframe[],duration:number):void=>{
     if(reduced||typeof node.animate!=='function')return;
     // Unsupported/failed animation keeps an honest static cue and never aborts gameplay.
     try{const animation=node.animate(frames,{duration,easing:'ease-out',fill:'both'});animations.push(animation);animation.finished.catch(()=>{});}catch{/* Static fallback. */}
    };
    const readCell=(point:Cell):{node:HTMLElement;rect:Rect}|null=>{
     const node=board.querySelector<HTMLElement>(`[data-cell-row="${point.row}"][data-cell-col="${point.col}"]`);
     if(!node||!node.isConnected||node.classList.contains('terrain')||node.classList.contains('invalid'))return null;
     // 日本語: DOMRectの座標はprototype getterなので、区間結合のspread前に明示コピーする。
     // English: DOMRect coordinates are prototype getters; copy values before spreading merged segments.
     const measured=node.getBoundingClientRect();
     const rect:Rect={left:measured.left,top:measured.top,width:measured.width,height:measured.height};
     return contained(rect,areaRect)&&contained(rect,boardRect)?{node,rect}:null;
    };
    const convertedCells=new Map<string,ReturnType<typeof readCell>>();
    if(cue.phase==='convert'){
     for(let row=0;row<before.config.board.height;row++)for(let col=0;col<before.config.board.width;col++){
      const cell=readCell({row,col}),id=cell?.node.dataset.boxId;
      if(id===undefined)continue;
      // The event chooses the IDs; current rendered geometry follows any already-committed settling.
      if(cue.targets.some(target=>target.id===id))convertedCells.set(id,convertedCells.has(id)?null:cell);
     }
    }
    if(cue.phase==='clear-row'){
     // Gaps and terrain split the horizontal cue; terrain never appears to be removed.
     const segments:Rect[]=[];
     let segment:Rect|undefined;
     for(let col=0;col<before.config.board.width;col++){
      const cell=readCell({row:cue.row!,col});
      if(!cell){if(segment)segments.push(segment);segment=undefined;continue;}
      if(segment&&Math.abs(segment.top-cell.rect.top)<.5&&Math.abs(segment.height-cell.rect.height)<.5&&cell.rect.left>=segment.left+segment.width&&cell.rect.left-(segment.left+segment.width)<=4)segment={...segment,width:cell.rect.left+cell.rect.width-segment.left};
      else{if(segment)segments.push(segment);segment=cell.rect;}
     }
     if(segment)segments.push(segment);
     for(const bounds of segments){
      const line=document.createElement('span');line.className='board-skill-row';line.dataset.row=String(cue.row);
      place(line,{...bounds,top:bounds.top+bounds.height/2-1,height:2});layer.append(line);
      animate(line,[{opacity:.5,transform:'scaleX(.12)'},{opacity:1,transform:'scaleX(1)',offset:.4},{opacity:0,transform:'scaleX(1)'}],options.motion.timeline?.skill.effect??BOARD_SKILL_PRESENTATION_TIMING.effect);
     }
    }
    for(const target of cue.targets){
     const cell=cue.phase==='convert'?convertedCells.get(target.id):readCell(target);
     if(!cell||(cue.phase==='convert'&&!cell.node.classList.contains('player')))continue;
     const mark=document.createElement('span');mark.className=cue.phase==='convert'?'board-skill-converted':'board-skill-erased';mark.dataset.boxId=target.id;
     place(mark,{left:cell.rect.left+2,top:cell.rect.top+2,width:Math.max(1,cell.rect.width-4),height:Math.max(1,cell.rect.height-4)});
     if(cue.phase==='convert'){
      mark.classList.add('energy-conversion');if(reduced)mark.classList.add('is-still');
      const own=document.createElement('span');own.className='conversion-new';own.innerHTML=energyBoxMarkup({...target,owner:'player'},energyAppearance(before));mark.append(own);
      if(!reduced){const old=document.createElement('span');old.className='conversion-old';old.innerHTML=energyBoxMarkup({...target,owner:'enemy'},energyAppearance(before));mark.append(old);animate(old,[{opacity:1},{opacity:.55,offset:.3},{opacity:0,offset:.65},{opacity:0}],options.motion.timeline?.skill.effect??BOARD_SKILL_PRESENTATION_TIMING.effect);}
     }
     layer.append(mark);
     animate(mark,cue.phase==='convert'?[{opacity:.65,transform:'scale(.76)'},{opacity:1,transform:'scale(1)',offset:.4},{opacity:0,transform:'scale(.94)'}]:[{opacity:1,transform:'scale(1)'},{opacity:.65,transform:'scale(.94)',offset:.5},{opacity:0,transform:'scale(.88)'}],options.motion.timeline?.skill.effect??BOARD_SKILL_PRESENTATION_TIMING.effect);
     if(!reduced){
      const radius=Math.max(2,Math.min(cell.rect.width,cell.rect.height)/2-6);
      for(const [x,y] of [[-1,-.6],[.8,-.9],[-.7,.9],[1,.55]]){
       const spark=document.createElement('i');spark.className='board-skill-spark';mark.append(spark);
       const near=`translate(${x!*2}px, ${y!*2}px)`,far=`translate(${x!*radius}px, ${y!*radius}px)`;
       animate(spark,cue.phase==='convert'?[{opacity:0,transform:far},{opacity:1,transform:far,offset:.15},{opacity:1,transform:near,offset:.65},{opacity:0,transform:near}]:[{opacity:1,transform:near},{opacity:.9,transform:far,offset:.65},{opacity:0,transform:far}],options.motion.timeline?.skill.effect??BOARD_SKILL_PRESENTATION_TIMING.effect);
      }
     }
    }
    area.append(layer);
    active={insetTop:Math.max(0,dropsRect.top-areaRect.top-area.clientTop+dropsRect.height),clear:finish,matchesLayout:()=>area.isConnected&&board.isConnected&&drops.isConnected&&sameRect(area.getBoundingClientRect(),areaRect)&&sameRect(board.getBoundingClientRect(),boardRect)&&sameRect(drops.getBoundingClientRect(),dropsRect)};
    options.signal?.addEventListener('abort',finish,{once:true});
    const duration=options.motion.timeline?(cue.phase==='activation'?options.motion.timeline.skill.name:options.motion.timeline.skill.effect):reduced?BOARD_SKILL_PRESENTATION_TIMING.static:cue.phase==='activation'?BOARD_SKILL_PRESENTATION_TIMING.name:BOARD_SKILL_PRESENTATION_TIMING.effect;
    timer=setTimeout(finish,duration);
    if(options.signal?.aborted){finish();return false;}
    return true;
   }catch{finish();return false;}
  },
  feedbackInsetTop():number {
   try{if(active?.matchesLayout())return active.insetTop;}catch{/* Stale DOM geometry cannot move feedback outside the board. */}
   clear();return 0;
  },
  clear,
  dispose():void {if(disposed)return;disposed=true;clear();observer?.disconnect();window.removeEventListener('resize',clear);window.removeEventListener('pagehide',clear);document.removeEventListener('game1:presentation-settings',settings);systemMotion?.removeEventListener('change',clear);},
 };
}

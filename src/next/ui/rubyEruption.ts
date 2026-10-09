import {paceScale,resolveBattlePace,type AnimationMotion} from './animationTimeline.ts';
import {configureLightCanvas} from './imashiruLight.ts';
import {transformationIdentity} from './transformationIdentity.ts';
import type {BattleConfig,BattleEvent} from '../core/types.ts';

export function rubyTransformationApplies(config:Pick<BattleConfig,'meta'|'characterId'>,event:BattleEvent):boolean{
 return event.type==='transformation'&&event.character==='red'&&transformationIdentity(config,event.character).id==='red';
}
export function rubyEruptionDuration(motion:AnimationMotion,short=false):number{
 return motion.lowMotion?280:short||motion.short||resolveBattlePace(motion)==='fast'?360:Math.round(900*paceScale(motion));
}
// Fixed visual-only hash. Never reads or advances the battle RNG or Math.random.
const visual=(i:number)=>{let x=Math.imul(i+17,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/4294967296;};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function rubyMeteorCount(reduced=false,subdued=false):number{return reduced?2:subdued?3:5;}
export function rubyMeteorScale(width:number):number{return Math.min(1.15,Math.max(.65,width/264));}
export function rubySpark(index:number){
 const lanes=[.12,.69,.31,.88,.5];
 return {startX:lanes[index%lanes.length]!,delay:index*.045+.025*visual(index*7+3),
 life:.65+.12*visual(index*7+4),size:13+5*visual(index*7+5),brightness:.72+.28*visual(index*7+6),depth:.88+.1*visual(index*7+2)};
}
export function rubySparkPoint(index:number,progress:number,width:number,height:number){
 const s=rubySpark(index),t=clamp((progress-s.delay)/s.life);
 return {x:width*s.startX,y:-24+(height*s.depth+24)*(.18*t+.82*t*t),
 t,alpha:progress<s.delay||progress>s.delay+s.life?0:Math.min(1,t/.08)*Math.min(1,(1-t)/.18)*s.brightness,size:s.size*rubyMeteorScale(width)};
}
export function paintRubyEruption(ctx:CanvasRenderingContext2D,width:number,height:number,progress:number,reduced=false,subdued=false):void{
 ctx.clearRect(0,0,width,height);ctx.save();ctx.globalCompositeOperation='lighter';
 const glow=(x:number,y:number,size:number,alpha:number)=>{
  const g=ctx.createRadialGradient(x,y,0,x,y,size*2.2);
  g.addColorStop(0,'rgba(255,231,135,'+alpha+')');g.addColorStop(.35,'rgba(255,130,32,'+(alpha*.8)+')');g.addColorStop(1,'rgba(235,53,12,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,size*2.2,0,Math.PI*2);ctx.fill();
 };
 if(reduced){for(let i=0;i<rubyMeteorCount(true);i++){const s=rubySpark(i);glow(width*s.startX,height*(.22+.12*i),s.size*rubyMeteorScale(width)*.6,.28);}ctx.restore();return;}
 for(let i=0;i<rubyMeteorCount(false,subdued);i++){
  const h=rubySparkPoint(i,progress,width,height);if(h.alpha<=0)continue;
  const alpha=h.alpha*(subdued?.55:1),r=h.size,tail=r*(3.8+1.6*h.t);
  // Wide filled flame tail extends straight upward; the head never drifts sideways.
  for(const [widthScale,lengthScale,opacity,color] of [[1.05,1,.48,'255,84,18'],[.7,.82,.78,'255,169,38']] as const){
   ctx.fillStyle='rgba('+color+','+(alpha*opacity)+')';ctx.beginPath();ctx.moveTo(h.x,h.y-tail*lengthScale);
   ctx.quadraticCurveTo(h.x+r*widthScale,h.y-r*1.5,h.x+r*.8*widthScale,h.y);
   ctx.quadraticCurveTo(h.x,h.y+r*.8,h.x-r*.8*widthScale,h.y);
   ctx.quadraticCurveTo(h.x-r*widthScale,h.y-r*1.5,h.x,h.y-tail*lengthScale);ctx.fill();
  }
  glow(h.x,h.y,r,alpha*.65);
  ctx.fillStyle='rgba(255,111,22,'+(alpha*.9)+')';ctx.beginPath();ctx.arc(h.x,h.y,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,218,96,'+alpha+')';ctx.beginPath();ctx.arc(h.x,h.y+r*.08,r*.7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,248,188,'+(alpha*.9)+')';ctx.beginPath();ctx.arc(h.x,h.y+r*.15,r*.4,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
export function createRubyEruption(board:HTMLElement){
 const doc=board.ownerDocument,win=doc.defaultView!,seen=new WeakSet<object>();
 let active:(()=>void)|undefined;
 const clear=()=>active?.();
 return {clear,get active(){return !!active;},play(eventId:object,signal:AbortSignal,motion:AnimationMotion,short=false):Promise<void>{
  if(signal.aborted||seen.has(eventId))return Promise.resolve();
  clear();const rect=board.getBoundingClientRect();if(!board.isConnected||rect.width<=0||rect.height<=0)return Promise.resolve();
  seen.add(eventId);
  return new Promise(resolve=>{
   let done=false,frame=0,timer=0,canvas:HTMLCanvasElement|undefined,observer:ResizeObserver|undefined;
   const cleanup=()=>{if(done)return;done=true;win.cancelAnimationFrame(frame);win.clearTimeout(timer);observer?.disconnect();signal.removeEventListener('abort',cleanup);win.removeEventListener('resize',cleanup);win.removeEventListener('scroll',cleanup,true);win.removeEventListener('pagehide',cleanup);canvas?.remove();if(active===cleanup)active=undefined;resolve();};
   active=cleanup;
   try{
    // Enter from above the board without stretching the effect to the whole screen.
    const top=Math.max(0,rect.top-96),height=rect.height+rect.top-top;
    canvas=doc.createElement('canvas');canvas.className='ruby-eruption';canvas.setAttribute('aria-hidden','true');
    const ctx=configureLightCanvas(canvas,rect.width,height,win.devicePixelRatio);
    Object.assign(canvas.style,{position:'fixed',left:rect.left+'px',top:top+'px',pointerEvents:'none',zIndex:'24'});
    doc.body.append(canvas);if(!ctx){cleanup();return;}
    const low=motion.lowMotion||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||doc.body.dataset.reducedMotion==='true';
    const subdued=short||motion.short||resolveBattlePace(motion)==='fast',duration=rubyEruptionDuration({...motion,lowMotion:low},short),start=win.performance.now();
    const draw=(now:number)=>{if(done)return;try{const p=clamp((now-start)/duration);paintRubyEruption(ctx,rect.width,height,p,low,subdued);if(p>=1)cleanup();else frame=win.requestAnimationFrame(draw);}catch{cleanup();}};
    signal.addEventListener('abort',cleanup,{once:true});win.addEventListener('resize',cleanup);win.addEventListener('scroll',cleanup,true);win.addEventListener('pagehide',cleanup);
    if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>{const n=board.getBoundingClientRect();if(Math.abs(n.width-rect.width)>.5||Math.abs(n.height-rect.height)>.5||Math.abs(n.left-rect.left)>.5||Math.abs(n.top-rect.top)>.5)cleanup();});observer.observe(board);}
    timer=win.setTimeout(cleanup,duration+100);draw(start);if(signal.aborted)cleanup();
   }catch{cleanup();}
  });
 }};
}

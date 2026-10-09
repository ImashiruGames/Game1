import {paceScale,resolveBattlePace,type AnimationMotion} from './animationTimeline.ts';
import type {TransformationResult} from './transformationCinematic.ts';

/** One presentation barrier: portrait closes, then the board gathers light. */
export async function transformationThenLight(portrait:()=>Promise<TransformationResult>,gather:(short:boolean)=>Promise<void>,signal:AbortSignal):Promise<void>{
 const result=await portrait();
 if(signal.aborted||!['completed','skipped'].includes(result.status))return;
 await gather(result.status==='skipped');
}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const x=clamp(n);return x*x*(3-2*x);};
export function lightGatherDuration(motion:AnimationMotion,short=false):number{
 return motion.lowMotion?360:short||motion.short||resolveBattlePace(motion)==='fast'?480:Math.round(1550*paceScale(motion));
}
/** Radius and angular speed share the same smooth convergence curve.
 * The integral of smoothstep keeps rotation continuous while speed rises with collapse. */
export function lightOrbitMotion(progress:number){
 const q=clamp(progress/.72),u=clamp((q-.16)/.84),collapse=smooth(u);
 const turns=.65*q+3.8*.84*(u*u*u-.5*u*u*u*u);
 return {radius:1-collapse,angle:-.25-Math.PI*2*turns};
}
/** A single fast rise followed by one fade, with no repeated peaks. */
export function lightBurstEnvelope(progress:number):number{
 return smooth((progress-.72)/.04)*(1-smooth((progress-.78)/.22));
}
/** Screen-space negative angles are counterclockwise. Both heads share one circular radius; only fine tail strands shimmer. */
export function lightSpiralPoint(progress:number,arm:number,thread=0){
 const orbit=lightOrbitMotion(progress),q=clamp(progress/.72),angle=arm*Math.PI+orbit.angle;
 const strand=thread===0?1:1+thread*.018+Math.abs(thread)*.009*Math.sin(angle*3+q*5);
 const radius=orbit.radius*strand;
 return {x:Math.cos(angle+thread*.025)*radius,y:Math.sin(angle+thread*.025)*radius};
}
/** Map drawing units to CSS pixels exactly, including fractional bounds and DPR rounding. */
export function configureLightCanvas(canvas:HTMLCanvasElement,width:number,height:number,dpr=1):CanvasRenderingContext2D|null{
 const density=Math.min(2,Math.max(1,dpr||1));
 canvas.width=Math.ceil(width*density);canvas.height=Math.ceil(height*density);
 canvas.style.width=width+'px';canvas.style.height=height+'px';
 const ctx=canvas.getContext('2d');ctx?.scale(canvas.width/width,canvas.height/height);return ctx;
}
export function paintLightGather(ctx:CanvasRenderingContext2D,width:number,height:number,progress:number,reduced=false,subdued=false):void{
 const p=clamp(progress),cx=width/2,cy=height/2,r=Math.min(width,height)*.39;
 ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(cx,cy);ctx.globalCompositeOperation='lighter';
 const disk=(x:number,y:number,size:number,alpha:number)=>{
  const g=ctx.createRadialGradient(x,y,0,x,y,size);
  g.addColorStop(0,'rgba(255,255,240,'+alpha+')');g.addColorStop(.18,'rgba(255,247,176,'+(alpha*.9)+')');g.addColorStop(.5,'rgba(164,219,255,'+(alpha*.26)+')');g.addColorStop(1,'rgba(130,191,255,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
 };
 if(reduced){
  // Still, low-intensity signal: no orbit, zoom, strobe or moving rays.
  disk(0,0,r*.36,.6);ctx.strokeStyle='rgba(222,242,255,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*.4,0,Math.PI*2);ctx.stroke();ctx.restore();return;
 }
 if(p<.78){
  const head=Math.min(p,.72),tailSpan=.22*smooth(p/.18),fade=1-smooth((p-.70)/.08),birth=smooth(p/.07);
  for(let arm=0;arm<2;arm++){
   for(let thread=-1;thread<=1;thread++){
    for(let i=1;i<=56;i++){
     const a=(i-1)/56,b=i/56;
     // Past points are pulled inward with the head near fusion; no abandoned ring.
     const pull=1-smooth((p-.61)/.13),ta=Math.max(0,head-tailSpan*(1-a)*pull),tb=Math.max(0,head-tailSpan*(1-b)*pull);
     const u=lightSpiralPoint(ta,arm,thread),v=lightSpiralPoint(tb,arm,thread);
     ctx.strokeStyle='rgba('+(thread===0?'255,248,203':'158,221,255')+','+(Math.pow(b,1.4)*fade*birth*(thread===0?.88:.42))+')';
     ctx.lineWidth=thread===0?1.2+2*b:.7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(u.x*r,u.y*r);ctx.lineTo(v.x*r,v.y*r);ctx.stroke();
    }
   }
   const h=lightSpiralPoint(head,arm);disk(h.x*r,h.y*r,11+5*smooth(p/.3),fade*birth);
  }
 }
 const core=smooth((p-.60)/.12)*(1-smooth((p-.72)/.10));
 if(core>0)disk(0,0,12+10*smooth((p-.64)/.08),core*(subdued?.55:1));
 if(p>.72){
  const burst=clamp((p-.72)/.28),spread=smooth(burst),pulse=lightBurstEnvelope(p),strength=subdued?.38:1;
  // One localized flash with area and layered glow, never a full-screen strobe.
  disk(0,0,r*(.58+.26*spread),pulse*.42*strength);
  disk(0,0,r*(.24+.22*spread),pulse*.95*strength);
  disk(0,0,10+r*(.08+.10*spread),pulse*strength);
  for(let i=0;i<20;i++){
   const a=i*Math.PI*2/20+.06*Math.sin(i*4),inner=8+spread*r*.12,outer=inner+r*(.48+.24*(.5+.5*Math.sin(i*7)))*smooth(burst/.35);
   for(const glow of [true,false]){
    ctx.lineWidth=(glow?(i%3===0?8:5):(i%3===0?3.2:1.8))*(subdued?.65:1);
    ctx.strokeStyle='rgba('+(glow?'154,211,255':'255,252,225')+','+(pulse*strength*(glow?.24:.92))+')';
    ctx.beginPath();ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);ctx.stroke();
   }
  }
  for(const [width,alpha] of [[12,.12],[5,.42],[2.8,.95]]){
   ctx.lineWidth=width!*(subdued?.65:1);ctx.strokeStyle='rgba(222,244,255,'+(pulse*alpha!*strength)+')';
   ctx.beginPath();ctx.arc(0,0,12+r*.9*spread,0,Math.PI*2);ctx.stroke();
  }
 }
 ctx.restore();
}
export function createImashiruLight(board:HTMLElement){
 const doc=board.ownerDocument,win=doc.defaultView!;
 let active:(()=>void)|undefined;
 const clear=()=>active?.();
 return {clear,get active(){return !!active;},play(signal:AbortSignal,motion:AnimationMotion,short=false):Promise<void>{
  clear();if(signal.aborted)return Promise.resolve();
  const rect=board.getBoundingClientRect();if(!board.isConnected||rect.width<=0||rect.height<=0)return Promise.resolve();
  return new Promise(resolve=>{
   let done=false,frame=0,timer=0,canvas:HTMLCanvasElement|undefined,observer:ResizeObserver|undefined;
   const cleanup=()=>{if(done)return;done=true;win.cancelAnimationFrame(frame);win.clearTimeout(timer);observer?.disconnect();signal.removeEventListener('abort',cleanup);win.removeEventListener('resize',cleanup);win.removeEventListener('scroll',cleanup,true);win.removeEventListener('pagehide',cleanup);canvas?.remove();if(active===cleanup)active=undefined;resolve();};
   active=cleanup;
   try{
    canvas=doc.createElement('canvas');canvas.className='imashiru-light-gather';canvas.setAttribute('aria-hidden','true');
    const ctx=configureLightCanvas(canvas,rect.width,rect.height,win.devicePixelRatio);
    Object.assign(canvas.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',pointerEvents:'none',zIndex:'24'});
    doc.body.append(canvas);if(!ctx){cleanup();return;}
    const low=motion.lowMotion||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||doc.body.dataset.reducedMotion==='true';
    const duration=lightGatherDuration({...motion,lowMotion:low},short),start=win.performance.now();
    const draw=(now:number)=>{if(done)return;try{const p=clamp((now-start)/duration);paintLightGather(ctx,rect.width,rect.height,p,low,short||motion.short||resolveBattlePace(motion)==='fast');if(p>=1)cleanup();else frame=win.requestAnimationFrame(draw);}catch{cleanup();}};
    signal.addEventListener('abort',cleanup,{once:true});win.addEventListener('resize',cleanup);win.addEventListener('scroll',cleanup,true);win.addEventListener('pagehide',cleanup);
    if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>{const next=board.getBoundingClientRect();if(Math.abs(next.width-rect.width)>.5||Math.abs(next.height-rect.height)>.5||Math.abs(next.left-rect.left)>.5||Math.abs(next.top-rect.top)>.5)cleanup();});observer.observe(board);}
    // A hidden/stalled RAF must never hold the committed action open.
    timer=win.setTimeout(cleanup,duration+100);draw(start);if(signal.aborted)cleanup();
   }catch{cleanup();}
  });
 }};
}

import {configureLightCanvas} from './imashiruLight.ts';
import {paceScale,resolveBattlePace,type AnimationMotion} from './animationTimeline.ts';
import {transformationIdentity} from './transformationIdentity.ts';
import type {BattleConfig,BattleEvent} from '../core/types.ts';
export type BlueVariant='ripple'|'tide'|'petals'|'skills';
export const blueVariants={skills:'A改：回復スキルへ波紋',ripple:'A：波紋から光の帯',tide:'B：満ちる光から一筋の閃光',petals:'C：花びら状の光の収束'};
export interface Point {x:number;y:number}
export interface Rect {left:number;top:number;width:number;height:number}
export interface BlueScene {width:number;height:number;board:Rect;enemy:Point;boxes:readonly Point[];healingTargets?:readonly Point[]}
export const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const x=clamp(n);return x*x*(3-2*x);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function bluePreviewApplies(config:Pick<BattleConfig,'meta'|'characterId'>,event:BattleEvent){return event.type==='transformation'&&event.character==='blue'&&transformationIdentity(config,'blue').id==='blue';}
export function blueDuration(motion:AnimationMotion,short=false){return motion.lowMotion?420:short||motion.short||resolveBattlePace(motion)==='fast'?520:Math.round(1300*paceScale(motion));}
export function bluePhase(progress:number){return progress<.72?'癒やし':progress<.94?'転換・敵へ':'小さな閃光';}
export function blueScene(width:number,height:number,board:Rect,enemy:Rect,boxes:readonly Rect[]):BlueScene|null{
 if(![width,height,board.left,board.top,board.width,board.height,enemy.left,enemy.top,enemy.width,enemy.height].every(Number.isFinite)||width<=0||height<=0||board.width<=0||board.height<=0||enemy.width<=0||enemy.height<=0)return null;
 return {width,height,board:{left:board.left,top:board.top,width:board.width,height:board.height},enemy:{x:enemy.left+enemy.width/2,y:enemy.top+enemy.height/2},boxes:boxes.filter(b=>[b.left,b.top,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0).map(b=>({x:b.left+b.width/2,y:b.top+b.height/2}))};
}
export function blueOrigin(scene:BlueScene,kind:BlueVariant):Point{const b=scene.board;return {x:b.left+b.width*.5,y:b.top+b.height*(kind==='tide'?.12:kind==='petals'?.40:.48)};}
/** One continuous blue-white path, accelerating late; no color change or homing RNG. */
export function blueFlightPoint(scene:BlueScene,kind:BlueVariant,t:number):Point{
 const a=blueOrigin(scene,kind),d=scene.enemy,q=clamp(t),u=1-q;
 const b={x:a.x-scene.board.width*.12,y:a.y-scene.board.height*.27},c={x:d.x-scene.board.width*.22,y:d.y+scene.board.height*.12};
 return {x:u*u*u*a.x+3*u*u*q*b.x+3*u*q*q*c.x+q*q*q*d.x,y:u*u*u*a.y+3*u*u*q*b.y+3*u*q*q*c.y+q*q*q*d.y};
}
/** Soft curved transfer; all equipped targets finish within the same fixed duration. */
export function blueSkillFlightPoint(scene:BlueScene,target:Point,t:number):Point{
 const a=blueOrigin(scene,'ripple'),q=smooth(t),u=1-q,dx=target.x-a.x;
 const b={x:a.x+dx*.18,y:a.y+scene.board.height*.2},c={x:target.x-dx*.12,y:target.y-36};
 return {x:u*u*u*a.x+3*u*u*q*b.x+3*u*q*q*c.x+q*q*q*target.x,y:u*u*u*a.y+3*u*u*q*b.y+3*u*q*q*c.y+q*q*q*target.y};
}
export function bluePetalPoint(scene:BlueScene,index:number,p:number):Point{
 const b=scene.board,angle=[-2.7,-1.55,-.4,.55,1.7,2.65][index%6]!,start={x:b.left+b.width*(.5+Math.cos(angle)*.52),y:b.top+b.height*(.48+Math.sin(angle)*.40)},box=scene.boxes[index%Math.max(1,scene.boxes.length)]??blueOrigin(scene,'petals'),near={x:mix(start.x,box.x,.62),y:mix(start.y,box.y,.62)},gather=blueOrigin(scene,'petals');
 const wrap=smooth(p/.58),join=smooth((p-.57)/.21);return {x:mix(mix(start.x,near.x,wrap),gather.x,join),y:mix(mix(start.y,near.y,wrap),gather.y,join)};
}
export function paintBlueTransformation(ctx:CanvasRenderingContext2D,scene:BlueScene,kind:BlueVariant,progress:number,reduced=false,subdued=false):void{
 const p=clamp(progress),b=scene.board,cx=b.left+b.width/2,cy=b.top+b.height*.48,unit=Math.min(1.2,Math.max(.65,b.width/264)),power=subdued?.6:1,fade=1-smooth((p-.72)/.12);
 ctx.clearRect(0,0,scene.width,scene.height);if(p>=1)return;ctx.save();ctx.globalCompositeOperation='lighter';
 const glow=(x:number,y:number,rx:number,ry:number,alpha:number,angle=0)=>{if(alpha<=.0001||rx<=0||ry<=0)return;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba(237,255,255,'+alpha+')');g.addColorStop(.22,'rgba(183,244,255,'+(alpha*.75)+')');g.addColorStop(.58,'rgba(88,200,240,'+(alpha*.32)+')');g.addColorStop(1,'rgba(65,163,221,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();};
 if(reduced){const a=smooth(p/.15)*(1-smooth((p-.78)/.22));glow(cx,cy,b.width*.48,b.height*.35,a*.22);if(kind==='skills'){for(const target of scene.healingTargets??[])glow(target.x,target.y,22*unit,22*unit,a*.20);}else glow(scene.enemy.x,scene.enemy.y,18*unit,18*unit,a*.16);ctx.restore();return;}
 const birth=smooth(p/.08);
 if(kind==='ripple'||kind==='skills'){
  if(p<.24){const fall=smooth(p/.20);glow(cx,mix(b.top+8,cy,fall),12*unit,16*unit,birth*(1-smooth((p-.19)/.05))*.85*power);}
  const maximum=Math.hypot(b.width*.5,b.height*.55);
  for(let i=0;i<(subdued?2:3);i++){const q=clamp((p-.17-i*.075)/.5),radius=maximum*smooth(q),alpha=birth*fade*(1-q)*.44*power;if(radius<2||alpha<=0)continue;
   const g=ctx.createRadialGradient(cx,cy,0,cx,cy,radius+14*unit);g.addColorStop(0,'rgba(95,207,242,0)');g.addColorStop(.65,'rgba(112,221,248,0)');g.addColorStop(.80,'rgba(149,235,255,'+(alpha*.42)+')');g.addColorStop(.90,'rgba(220,252,255,'+alpha+')');g.addColorStop(1,'rgba(96,204,238,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,radius+14*unit,0,Math.PI*2);ctx.fill();
  }
  for(const box of scene.boxes){const distance=Math.hypot(box.x-cx,box.y-cy)/maximum,arrival=.2+distance*.42,a=Math.exp(-Math.pow((p-arrival)/.10,2))*fade;glow(box.x,box.y,25*unit,25*unit,a*.30*power);}
 }else if(kind==='tide'){
  const rise=smooth(p/.7),level=b.top+b.height*(1-rise);for(let i=0;i<7;i++){const y=mix(level,b.top+b.height+.03*b.height,i/6);glow(cx+Math.sin(i*.9+p*3)*b.width*.035,y,b.width*.58,b.height*.13,birth*fade*(.055+.02*i/6)*power);}
  glow(cx,level,b.width*.53,32*unit,birth*fade*.19*power);
  for(const box of scene.boxes){const entered=smooth((box.y-level+12)/38);glow(box.x,box.y,25*unit,26*unit,entered*birth*fade*.24*power);}
 }else{
  for(let i=0;i<(subdued?4:6);i++){const h=bluePetalPoint(scene,i,p),shrink=1-smooth((p-.63)/.17)*.68;glow(h.x,h.y,18*unit*shrink,32*unit*shrink,birth*fade*.44*power,(i%3-1)*.48);}
  for(const [i,box]of scene.boxes.entries()){const a=smooth((p-.18-(i%4)*.055)/.22)*fade;glow(box.x,box.y,23*unit,27*unit,a*.20*power);}
 }
 if(kind==='skills'){
  const targets=scene.healingTargets??[];
  for(const [i,target]of targets.entries()){
   const delay=targets.length>1?i/(targets.length-1)*.018:0,start=.59+delay,arrival=.85+delay,q=clamp((p-start)/(arrival-start));
   if(p>=start&&p<arrival+.04){const tail=.24*(1-smooth((p-arrival)/.04)),visibility=1-smooth((p-arrival)/.04);
    for(let j=0;j<18;j++){const at=blueSkillFlightPoint(scene,target,clamp(q-tail*(1-j/17)));glow(at.x,at.y,(5+3*j/17)*unit,(5+3*j/17)*unit,(.018+.040*j/17)*visibility*power);}
    const head=blueSkillFlightPoint(scene,target,q);glow(head.x,head.y,10*unit,10*unit,.46*visibility*power);
   }
   const local=clamp((p-arrival)/(1-arrival)),settle=smooth(local/.18)*(1-smooth((local-.40)/.60));
   glow(target.x,target.y,21*unit,21*unit,settle*.32*power);
   for(let n=0;n<2;n++){const ring=clamp((local-n*.18)/.82),radius=(6+24*smooth(ring))*unit,alpha=smooth(ring/.15)*(1-smooth(ring))*.35*power;if(alpha<=0)continue;
    const g=ctx.createRadialGradient(target.x,target.y,0,target.x,target.y,radius);g.addColorStop(0,'rgba(112,221,248,0)');g.addColorStop(.58,'rgba(112,221,248,0)');g.addColorStop(.78,'rgba(220,252,255,'+alpha+')');g.addColorStop(1,'rgba(96,204,238,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(target.x,target.y,radius,0,Math.PI*2);ctx.fill();
   }
  }
  ctx.restore();return;
 }
 // The healing body gently yields to a gathered source, then the same light departs.
 const origin=blueOrigin(scene,kind),gather=smooth((p-.60)/.16)*(1-smooth((p-.79)/.10));
 glow(origin.x,origin.y,24*unit,32*unit,gather*.62*power);
 if(p>=.75&&p<.98){const flight=clamp((p-.75)/.19),head=flight*flight,tail=.26*(1-smooth((p-.90)/.08));
  for(let i=0;i<20;i++){const t=clamp(head-tail*(1-i/19)),v=blueFlightPoint(scene,kind,t),width=(kind==='tide'?6:10)*unit*(.4+.6*i/19);glow(v.x,v.y,width,width,(.018+.055*i/19)*power*(1-smooth((p-.94)/.04)));}
  const h=blueFlightPoint(scene,kind,head);glow(h.x,h.y,12*unit,12*unit,.72*power*(1-smooth((p-.94)/.04)));
 }
 const flash=smooth((p-.935)/.018)*(1-smooth((p-.956)/.044));if(flash>0){glow(scene.enemy.x,scene.enemy.y,25*unit,21*unit,flash*.44*power);glow(scene.enemy.x,scene.enemy.y,17*unit,3*unit,flash*.7*power,-.25);}
 ctx.restore();
}
export interface BluePlayOptions {short?:boolean;rate?:number;at?:number}
/** Isolated presentation lifecycle. Does not read or write battle state, saves or audio. */
export function createBlueTransformation(board:HTMLElement,enemy:HTMLElement,boxes:()=>readonly HTMLElement[],healingTargets:()=>readonly HTMLElement[]=()=>[]){
 const doc=board.ownerDocument,win=doc.defaultView!;let active:{clear():void;pause():void;resume():void;seek(p:number):void}|undefined;
 const clear=()=>active?.clear();
 return {clear,pause:()=>active?.pause(),resume:()=>active?.resume(),seek:(p:number)=>active?.seek(p),get active(){return !!active;},
 play(kind:BlueVariant,signal:AbortSignal,motion:AnimationMotion,options:BluePlayOptions={}):Promise<void>{
  clear();if(signal.aborted||!board.isConnected||!enemy.isConnected)return Promise.resolve();
  const boardRect=board.getBoundingClientRect(),enemyRect=kind==='skills'?boardRect:enemy.getBoundingClientRect(),scene=blueScene(win.innerWidth,win.innerHeight,boardRect,enemyRect,boxes().map(n=>n.getBoundingClientRect()));if(!scene)return Promise.resolve();
  const targetNodes=kind==='skills'?healingTargets():[],targetRects=targetNodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};});if(kind==='skills')scene.healingTargets=targetRects.map(r=>({x:r.left+r.width/2,y:r.top+r.height/2}));
  return new Promise(resolve=>{let done=false,frame=0,timer=0,canvas:HTMLCanvasElement|undefined,observer:ResizeObserver|undefined,paused=options.at!==undefined,elapsed=clamp(options.at??0),start=0;
   const media=win.matchMedia?.('(prefers-reduced-motion: reduce)'),low=motion.lowMotion||!!media?.matches||doc.body.dataset.reducedMotion==='true',subdued=!!options.short||motion.short||resolveBattlePace(motion)==='fast',rate=options.rate===.25||options.rate===.1?options.rate:1,duration=blueDuration({...motion,lowMotion:low},options.short)/rate;elapsed*=duration;
   const cleanup=()=>{if(done)return;done=true;win.cancelAnimationFrame(frame);win.clearTimeout(timer);observer?.disconnect();signal.removeEventListener('abort',cleanup);win.removeEventListener('resize',cleanup);win.removeEventListener('scroll',cleanup,true);win.removeEventListener('pagehide',cleanup);media?.removeEventListener('change',cleanup);canvas?.remove();if(active?.clear===cleanup)active=undefined;resolve();};
   try{
    canvas=doc.createElement('canvas');canvas.className='blue-transformation-preview';canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'24'});const ctx=configureLightCanvas(canvas,scene.width,scene.height,win.devicePixelRatio);doc.body.append(canvas);if(!ctx){cleanup();return;}
    const targetsChanged=()=>{const current=kind==='skills'?healingTargets():[];return current.length!==targetNodes.length||targetNodes.some((node,i)=>{const r=node.getBoundingClientRect(),old=targetRects[i]!;return current[i]!==node||!node.isConnected||['left','top','width','height'].some(k=>Math.abs(r[k as keyof Rect]-old[k as keyof Rect])>.5);});};
    const paint=()=>paintBlueTransformation(ctx,scene,kind,clamp(elapsed/duration),low,subdued);
    const deadline=()=>{win.clearTimeout(timer);timer=win.setTimeout(cleanup,paused?60000:Math.max(0,duration-elapsed)+100);};
    const draw=(now:number)=>{if(done||paused)return;try{if(targetsChanged()){cleanup();return;}elapsed=now-start;paint();if(elapsed>=duration)cleanup();else frame=win.requestAnimationFrame(draw);}catch{cleanup();}};
    active={clear:cleanup,pause(){if(done||paused)return;elapsed=win.performance.now()-start;paused=true;win.cancelAnimationFrame(frame);paint();deadline();},resume(){if(done||!paused)return;paused=false;start=win.performance.now()-elapsed;deadline();draw(win.performance.now());},seek(p){if(done)return;paused=true;win.cancelAnimationFrame(frame);elapsed=clamp(p)*duration;paint();if(elapsed>=duration)cleanup();else deadline();}};
    signal.addEventListener('abort',cleanup,{once:true});win.addEventListener('resize',cleanup);win.addEventListener('scroll',cleanup,true);win.addEventListener('pagehide',cleanup);media?.addEventListener('change',cleanup);
    if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(()=>{const a=board.getBoundingClientRect(),b=kind==='skills'?a:enemy.getBoundingClientRect();if(targetNodes.some((node,i)=>{const current=node.getBoundingClientRect(),old=targetRects[i]!;return ['left','top','width','height'].some(k=>Math.abs(current[k as keyof Rect]-old[k as keyof Rect])>.5);})||['left','top','width','height'].some(key=>Math.abs(a[key as keyof Rect]-boardRect[key as keyof Rect])>.5||Math.abs(b[key as keyof Rect]-enemyRect[key as keyof Rect])>.5))cleanup();});observer.observe(board);if(kind!=='skills')observer.observe(enemy);for(const node of targetNodes)observer.observe(node);}
    start=win.performance.now()-elapsed;deadline();if(paused){paint();if(elapsed>=duration)cleanup();}else draw(win.performance.now());if(signal.aborted)cleanup();
   }catch{cleanup();}
  });
 }};
}

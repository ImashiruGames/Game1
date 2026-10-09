import {applyRubyComet} from '../../src/next/ui/rubyDropFlame.ts';
const ORIGINAL_FLAME_MARKUP='<svg viewBox="0 0 100 160" aria-hidden="true" focusable="false" style="width:100%;height:100%;overflow:visible"><path fill="#ff6328" fill-opacity=".6" d="M7 133 Q-3 112 14 76 L22 105 Q30 65 29 28 Q53 53 49 94 Q68 66 76 10 Q95 66 84 111 L92 96 Q109 135 90 151 L88 82 L12 82 Z"/><path fill="#ffc25b" fill-opacity=".8" d="M10 127 Q8 110 19 95 L22 112 Q36 87 37 57 Q52 77 49 106 Q68 90 75 53 Q83 79 78 111 L87 109 L89 133 L86 88 L15 88 Z"/></svg>';
export type RubyDropCandidate='original'|'orb'|'comet'|'sprite'|'red-shell';
export const candidateLabels:Record<RubyDropCandidate,string>={'red-shell':'D：赤い外光＋少量の火の粉（改良案）',original:'旧案：尖った炎（比較用）',orb:'A：球状ハロー',comet:'B：短い彗星光（本編採用）',sprite:'C：発光球スプライト'};
export function candidateOf(value:unknown):RubyDropCandidate{return value==='original'||value==='comet'||value==='sprite'||value==='red-shell'?value:'orb';}
export const RED_EMBER_COUNT=3;
/** Three finite rearward drifts. Offsets are on the same full drop clock as the parent halo. */
export function redEmberFrames(index:number,boxSize:number):Keyframe[]{
 const i=Math.max(0,Math.min(2,Math.floor(index))),birth=[.03,.25,.46][i]!,life=[.55,.48,.44][i]!,dx=[-.30,.10,.32][i]!*boxSize,dy=[-.78,-.96,-.69][i]!*boxSize;
 const at=(p:number)=>p*2/3,move=(p:number)=>'translate('+dx*p+'px,'+dy*p+'px) scale('+(1-.55*p)+')';
 return [{offset:0,opacity:0,transform:move(0)},{offset:at(birth),opacity:0,transform:move(0)},{offset:at(birth+life*.18),opacity:.8,transform:move(.18)},{offset:at(birth+life),opacity:0,transform:move(1)},{offset:1,opacity:0,transform:move(1)}];
}
export const RED_SHELL_BACKGROUND='radial-gradient(circle closest-side at 50% 50%,rgba(245,18,15,0) 0%,rgba(245,18,15,0) 43%,rgba(250,24,18,.08) 50%,rgba(255,31,24,.48) 60%,rgba(255,54,35,.62) 67%,rgba(227,12,21,.27) 80%,rgba(190,0,18,0) 100%)';
/** Fixed, pre-rendered texture. No game RNG, moving particles, or per-frame paint. */
export function paintRubyDropSprite(ctx:CanvasRenderingContext2D,size:number){
 const scale=size/192;ctx.save();ctx.scale(scale,scale);ctx.clearRect(0,0,192,192);
 const glow=(x:number,y:number,r:number,stops:readonly (readonly [number,string])[])=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);for(const [at,color]of stops)g.addColorStop(at,color);ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
 glow(96,96,94,[[0,'rgba(255,97,38,.10)'],[.48,'rgba(255,80,24,.30)'],[.68,'rgba(255,47,18,.16)'],[1,'rgba(185,32,10,0)']]);
 // A shaded round body with a broad, soft rim rather than a drawn outline.
 glow(100,104,57,[[0,'rgba(132,25,18,.22)'],[.38,'rgba(222,57,20,.35)'],[.67,'rgba(255,134,43,.68)'],[.8,'rgba(255,191,83,.48)'],[1,'rgba(255,95,28,0)']]);
 ctx.globalCompositeOperation='screen';
 for(let i=0;i<12;i++){const angle=i*Math.PI*2/12,radius=27+(i%3)*5;glow(96+Math.cos(angle)*radius,96+Math.sin(angle)*radius,18+(i%4)*3,[[0,'rgba(255,158,55,.16)'],[1,'rgba(255,110,35,0)']]);}
 glow(82,81,37,[[0,'rgba(255,247,204,.82)'],[.25,'rgba(255,217,137,.6)'],[.62,'rgba(255,151,65,.26)'],[1,'rgba(255,100,28,0)']]);
 glow(101,106,21,[[0,'rgba(255,255,242,.86)'],[.2,'rgba(255,242,178,.72)'],[.62,'rgba(255,192,90,.35)'],[1,'rgba(255,125,40,0)']]);ctx.restore();
}
/** Decorate the production flame node; its existing WAAPI opacity/clock/cleanup stay in charge. */
export function createRubyDropCandidates(doc:Document){
 let sprite:string|undefined,textureBuilds=0;
 const active=new Set<Animation>();
 const clear=()=>{for(const a of active){try{a.cancel();}catch{}active.delete(a);}};
 const embers=(node:HTMLElement)=>{
  const clock=node.getAnimations?.()[0],duration=clock?.effect?.getTiming().duration,start=clock?.startTime;
  if(!clock||typeof duration!=='number'||typeof start!=='number')return;
  const size=Number.parseFloat(node.parentElement?.style.width??'')||36,own:Animation[]=[];
  const release=()=>{for(const a of own){try{a.cancel();}catch{}active.delete(a);}};
  // Parent cancellation (resize/replacement/home) also releases paused child animations.
  clock.finished.then(release,release);
  try{for(let i=0;i<RED_EMBER_COUNT;i++){
   const dot=doc.createElement('span');dot.className='ruby-drop-ember';
   const diameter=Math.min(4,Math.max(1.8,size*[.065,.055,.075][i]!));
   Object.assign(dot.style,{position:'absolute',left:[42,50,57][i]+'%',top:[27,24,28][i]+'%',width:diameter+'px',height:diameter+'px',borderRadius:'50%',pointerEvents:'none',background:'radial-gradient(circle,rgba(255,117,79,.94) 0%,rgba(255,45,26,.74) 35%,rgba(223,12,18,0) 100%)',boxShadow:'0 0 2px rgba(255,31,24,.35)',opacity:'0'});
   node.append(dot);const animation=dot.animate(redEmberFrames(i,size),{duration,easing:'linear',fill:'both'});animation.finished.catch(()=>{});animation.startTime=start;own.push(animation);active.add(animation);
  }}catch{release();}
 };

 const texture=()=>{if(sprite)return sprite;const c=doc.createElement('canvas');c.width=c.height=192;const ctx=c.getContext('2d');if(!ctx)throw Error('比較用Canvasを作成できません');paintRubyDropSprite(ctx,192);sprite=c.toDataURL('image/png');textureBuilds++;return sprite;};
 return {clear,get textureBuilds(){return textureBuilds;},get activeParticleAnimations(){return active.size;},
  prepare(selection:unknown){if(candidateOf(selection)==='sprite')texture();},
  apply(node:HTMLElement,selection:unknown):RubyDropCandidate{
   const kind=candidateOf(selection);
   if(kind==='original'){node.innerHTML=ORIGINAL_FLAME_MARKUP;node.dataset.candidate='original';Object.assign(node.style,{left:'-8%',top:'-62%',width:'116%',height:'160%',backgroundImage:'none'});return kind;}
   if(kind==='comet'){applyRubyComet(node);return kind;}
   node.innerHTML='';node.dataset.candidate=kind;
   Object.assign(node.style,{pointerEvents:'none',backgroundRepeat:'no-repeat',backgroundSize:'100% 100%',border:'0',borderRadius:'0',filter:'none',mixBlendMode:'normal'});
   if(kind==='red-shell'){Object.assign(node.style,{left:'-50%',top:'-50%',width:'200%',height:'200%',backgroundImage:RED_SHELL_BACKGROUND});embers(node);}
   else if(kind==='orb')Object.assign(node.style,{left:'-35%',top:'-35%',width:'170%',height:'170%',backgroundImage:'radial-gradient(circle at 50% 50%,rgba(255,255,247,.92) 0%,rgba(255,249,216,.88) 7%,rgba(255,220,146,.66) 16%,rgba(255,170,79,.28) 30%,rgba(255,119,44,.11) 45%,rgba(255,93,24,0) 69%)'});
   else Object.assign(node.style,{left:'-45%',top:'-45%',width:'190%',height:'190%',backgroundImage:'url("'+texture()+'")'});
   return kind;
  },
 };
}

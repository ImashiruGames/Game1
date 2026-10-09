import {createProfile,freezeRunMeta} from '../../src/next/meta/profile.ts';
import {prepareDeparture} from '../../src/next/meta/departure.ts';
import {createBattle} from '../../src/next/core/battle.ts';
import {resolveActiveDrop} from '../../src/next/core/activeDrop.ts';
import {completePlayerTurn} from '../../src/next/core/transformations.ts';
import {createSkillActivationEffects,skillActivationCue} from '../../src/next/ui/skillActivationEffects.ts';
import {createEnergyLinks} from '../../src/next/ui/energyLinks.ts';
import {captureAnimationMotion} from '../../src/next/ui/animationTimeline.ts';
import '../../src/next/ui/skillActivationEffects.css';
import '../../src/next/ui/energyBox.css';
import type {RosterId} from '../../src/next/meta/roster.ts';
import type {Box} from '../../src/next/core/types.ts';
let cleanup=()=>{};
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
function run(frame:number|null){
 cleanup();
 const id=el<HTMLSelectElement>('character').value as RosterId,speed=el<HTMLSelectElement>('pace').value as 'slow'|'medium'|'fast',lowMotion=el<HTMLInputElement>('reduce').checked;
 const box=(row:number,col:number,owner:Box['owner']='player'):Box=>({id:row+':'+col,row,col,owner,type:'normal',status:'normal'});
 const boxes=id==='blue'?[box(5,2),box(6,1),box(6,3),box(7,2)]:id==='mint'?[box(6,1),box(7,1)]:id==='amber'?[box(6,1),box(6,2),box(7,1)]:id==='violet'?[box(7,0),box(7,1),box(7,3),box(7,5,'enemy')]:id==='rose'?[box(7,0),box(7,1)]:id==='silver'?[box(5,2,'enemy'),box(6,2,'enemy')]:[box(5,2),box(6,2)];
 const profile=createProfile(1);profile.ownedCharacters=['red','blue','mint','amber','violet','rose','silver','imashiru'];
 const config=prepareDeparture(freezeRunMeta(profile,id,false),1).config;
 let before=createBattle({...config,initialBoxes:boxes,board:{width:6,height:8,gravity:'down',terrain:[],invalidCells:[]}});
 if(id==='silver')before={...before,actor:'enemy'};
 const origin=id==='blue'?{row:6,col:2}:{row:7,col:2};
 const step=id==='imashiru'?{...completePlayerTurn(before),links:[]}:resolveActiveDrop(before,{id:'test',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:origin.row,path:[origin]});
 const event=step.events.find(e=>skillActivationCue(e,step.links,step.state)?.ids.includes(before.build!.fixed.id))!;
 const scene=el('scene');scene.innerHTML='<div class="game"><div class="hud"><div id="player-image" class="portrait">自分</div><div id="enemy-image" class="portrait">敵</div></div><div id="gauge-text">ゲージ '+step.state.gauge+'</div><button class="hud-skill skill-trigger--'+before.build!.fixed.id+'">'+before.build!.fixed.id+'</button><div class="board-area"><div id="board"></div></div></div>';
 const board=el('board');
 for(let row=0;row<8;row++)for(let col=0;col<6;col++){const cell=document.createElement('div'),b=step.state.boxes.find(b=>b.row===row&&b.col===col);cell.className='cell'+(b?' '+b.owner:'');cell.dataset.cellRow=String(row);cell.dataset.cellCol=String(col);if(b)cell.dataset.boxId=b.id;board.append(cell);}
 const effects=createSkillActivationEffects(scene),energy=createEnergyLinks(scene),signal=new AbortController(),motion=captureAnimationMotion({speed,short:false,lowMotion});
 document.body.dataset.reducedMotion=String(lowMotion);
 // This isolated page holds only renderer cleanup timers for frame inspection. Never used by the game.
 const original=window.setTimeout;let fake=900000;
 if(frame!==null)window.setTimeout=(()=>++fake) as typeof window.setTimeout;
 try{effects.play(event,step.links,step.state,signal.signal,motion);if(event.type==='attack')energy.play(event,step.links,step.state,signal.signal,motion);}finally{window.setTimeout=original;}
 const seeds=Array.from(scene.querySelectorAll('.skill-fire-seed')).flatMap(n=>n.getAnimations());
 const rims=Array.from(scene.querySelectorAll('.skill-activation-box')).flatMap(n=>n.getAnimations());
 const attacks=Array.from(scene.querySelectorAll('.energy-attack-particle')).flatMap(n=>n.getAnimations());
 const end=(a:Animation)=>{const t=a.effect!.getTiming();return Number(t.delay)+Number(t.duration);};
 const arrival=seeds.length?Math.max(...seeds.map(end)):null;
 const ignitions=rims.map(a=>{const e=a.effect as KeyframeEffect,t=e.getTiming(),peak=e.getKeyframes().find(f=>Number(f.opacity)===1);return peak?Number(t.delay)+Number(t.duration)*peak.computedOffset:null;}).filter(x=>x!==null);
 const launch=attacks.length?Math.min(...attacks.map(a=>a.effect!.getTiming().delay)):null;
 if(frame!==null)for(const a of scene.getAnimations({subtree:true})){a.pause();a.currentTime=frame;}
 el('readout').textContent=JSON.stringify({character:id,speed,lowMotion,frame:frame??'live',cue:skillActivationCue(event,step.links,step.state),fireArrivalMs:arrival,boxPeakMs:ignitions,firstAttackMs:launch,orderOK:arrival!==null&&launch!==null?arrival<=Math.max(...ignitions as number[])&&Math.max(...ignitions as number[])<launch:'static / non-fire',attackBudget:motion.timeline!.attack},null,2);
 cleanup=()=>{signal.abort();effects.dispose();energy.dispose();};
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-frame]'))b.onclick=()=>run(Number(b.dataset.frame));
el('play').onclick=()=>run(null);
for(const id of ['character','pace','reduce'])el(id).onchange=()=>run(85);
run(85);

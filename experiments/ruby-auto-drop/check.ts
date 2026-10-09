import {createRubyDropCandidates,candidateOf,candidateLabels} from './candidates.ts';
import {createBattle,applyAction,getDropOptions} from '../../src/next/core/index.ts';
import type {BattleState,Box} from '../../src/next/core/types.ts';
import {createProfile,freezeRunMeta} from '../../src/next/meta/profile.ts';
import {prepareDeparture} from '../../src/next/meta/departure.ts';
import {createBattleAnimator,pauseAnimation} from '../../src/next/ui/battleAnimator.ts';
import {captureAnimationMotion} from '../../src/next/ui/animationTimeline.ts';
import {rubyAutoDrop} from '../../src/next/ui/rubyDropFlame.ts';
import {previewTiming,seekDropFrame,INSPECTION_DURATION} from './playback.ts';
import {createDropMotion} from '../../src/next/ui/dropMotion.ts';
import {energyBoxMarkup,energyAppearance} from '../../src/next/ui/energyBox.ts';
import {rosterPortrait} from '../../src/next/meta/home.ts';
import '../../src/next/ui/dropMotion.css';
import '../../src/next/ui/energyBox.css';
const style=document.createElement('style');style.textContent='*{box-sizing:border-box}body{margin:0;background:#11212d;color:#eaf8ff;font:14px system-ui}header{height:100px;display:flex;align-items:center;gap:16px;padding:8px 20px}header img{width:64px;height:84px;object-fit:contain}.board-area{position:relative;padding:36px 16px 16px;width:min(320px,100vw);margin:auto}#board{position:relative;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(8,minmax(0,1fr));gap:2px;aspect-ratio:6/8}.cell{position:relative;min-width:0;min-height:0;border:1px solid #344c59;border-radius:4px;background:#1a2c37;display:grid;place-items:center}.cell.player{background:#51462c}.cell.neutral{background:#454c60}.cell.terrain{background:repeating-linear-gradient(45deg,#59616d 0 4px,#333c4a 4px 8px)}#status{padding:0 16px;color:#c4d9e5}';document.head.append(style);
const root=document.getElementById('root')!,board=document.getElementById('board')!,status=document.getElementById('status')!;
(document.getElementById('portrait') as HTMLImageElement).src=rosterPortrait('red',true).src;
const candidates=createRubyDropCandidates(document);
const profile=createProfile();profile.ownedCharacters=['blue','red'];const config=prepareDeparture(freezeRunMeta(profile,'red',false),7).config;
let shown:BattleState,abort=new AbortController();const drop=createDropMotion(root,()=>energyAppearance(shown));
function fixture(kind:string){const initialBoxes:Box[]=kind==='stack'?Array.from({length:6},(_,col)=>({id:'base:'+col,row:7,col,owner:'neutral',type:'normal',status:'normal'})):[];return createBattle({...config,initialTransformation:{character:'red',scope:'run',remainingStarts:2},initialBoxes,board:{width:6,height:8,gravity:'down',terrain:kind==='terrain'?Array.from({length:6},(_,col)=>({row:7,col})):[],invalidCells:[]}});}
function render(s:BattleState){shown=s;board.innerHTML=Array.from({length:48},(_,i)=>{const row=Math.floor(i/6),col=i%6,b=s.boxes.find(b=>b.row===row&&b.col===col),terrain=s.config.board.terrain.some(c=>c.row===row&&c.col===col);return '<div data-cell-row="'+row+'" data-cell-col="'+col+'" class="cell '+(terrain?'terrain':b?.owner??'')+'">'+(b?energyBoxMarkup(b,energyAppearance(s)):'')+'</div>';}).join('');}
function emit(s:string){status.textContent=s;parent.postMessage({kind:'status',text:s},location.origin);}
let sampleFrame=0;
function cancel(){candidates.clear();cancelAnimationFrame(sampleFrame);abort.abort();drop.clear();emit('消去完了 / 残留炎 '+document.querySelectorAll('.ruby-drop-flame').length);}
async function play(d:any){cancel();candidates.prepare(d.look);abort=new AbortController();const signal=abort.signal;let before=fixture(d.landing);render(before);document.body.dataset.reducedMotion=String(d.lowMotion);const motion={speed:d.short?'fast':d.speed,short:d.short,lowMotion:d.lowMotion};
 const timing=previewTiming(Number(d.rate));
 for(let n=0;n<(d.count??1)&&!signal.aborted;n++){
  if(d.kind==='manual')before={...before,playerTurnStarted:true};
  const r=applyAction(before,d.kind==='manual'?{type:'drop',candidateId:getDropOptions(before).find(x=>x.available)!.id}:{type:'start-turn'});if(!r.accepted)throw Error('preview fixture');
  const samples:string[]=[];let mode='',diagnosis='';
  await createBattleAnimator({motion:()=>motion,playSound(){},describe(){},observe(){},highlight(){},render,drop:(e,s,m,c)=>{
   const played=drop.play(e,{signal:s,motion:m,rubyAutoDrop:c?.rubyAutoDrop});
   const box=root.querySelector<HTMLElement>('.kinetic-drop-box'),flame=root.querySelector<HTMLElement>('.ruby-drop-flame');
   if(flame)candidates.apply(flame,d.look);
   mode=candidateLabels[candidateOf(d.look)]+(candidateOf(d.look)==='comet'?'（本編既定）':'（比較専用）')+' / '+(c?.rubyAutoDrop?'自動投入':'通常投入')+' / 飛行 '+Math.round(m.timeline!.drop*2/3)+'ms / 着地 '+(e.landing.row+1)+'行 '+(e.landing.col+1)+'列';
   diagnosis=diagnostic(played);emit(mode+'\n'+diagnosis);
   if(box){let middle=false;const sample=()=>{if(signal.aborted||!box.isConnected)return;const a=box.getAnimations()[0],time=Number(a?.currentTime??0),p=time/(m.timeline!.drop*2/3);if(!samples.length||(!middle&&p>=.3&&p<1)){if(samples.length)middle=true;samples.push(Math.round(time)+'ms: '+getComputedStyle(box).transform+' / 炎 '+(flame?getComputedStyle(flame).opacity:'なし'));}sampleFrame=requestAnimationFrame(sample);};sampleFrame=requestAnimationFrame(sample);}
  },react(){},feedback(){return {remove(){}};},transform:async()=>{},complete(){},end:()=>{if(signal===abort.signal){cancelAnimationFrame(sampleFrame);candidates.clear();drop.clear();}}},timing)(r.resolution!,before,r.state,signal);
  if(signal.aborted)return;emit(mode+'\n'+diagnosis+'\n着地完了 / 残留炎 '+document.querySelectorAll('.ruby-drop-flame').length+'\n実ブラウザーの描画サンプル\n'+(samples.join('\n')||'取得なし（省略設定または描画開始不可）'));before={...r.state,playerTurnStarted:false};if(n+1<d.count)await pauseAnimation(450,signal);
 }
}
function diagnostic(played:boolean){const heights=[...board.querySelectorAll<HTMLElement>('.cell')].map(c=>c.getBoundingClientRect().height),min=Math.min(...heights),max=Math.max(...heights),os=matchMedia('(prefers-reduced-motion: reduce)').matches;return (played?'落下アニメーション開始':'落下は省略／開始不可')+' / 行高 '+min.toFixed(2)+'–'+max.toFixed(2)+'px / OS低モーション '+os;}
function inspect(d:any){
 cancel();candidates.prepare(d.look);abort=new AbortController();const signal=abort.signal,before=fixture(d.landing),r=applyAction(before,{type:'start-turn'});if(!r.accepted)throw Error('inspection fixture');const e=r.resolution!.events.find(e=>e.type==='drop')!;
 render({...before,boxes:[...before.boxes,e.box]});document.body.dataset.reducedMotion=String(d.lowMotion);
 const m=captureAnimationMotion({speed:'medium',short:false,lowMotion:!!d.lowMotion},INSPECTION_DURATION);
 const played=drop.play(e,{signal,motion:m,rubyAutoDrop:rubyAutoDrop(e,r.resolution!,before)});
 const box=root.querySelector<HTMLElement>('.kinetic-drop-box'),flame=root.querySelector<HTMLElement>('.ruby-drop-flame');
   if(flame)candidates.apply(flame,d.look);
 if(!box){emit(diagnostic(played));return;}
 const animations=[...box.getAnimations(),...(flame?.getAnimations({subtree:true})??[])];seekDropFrame(animations,Number(d.percent));
 sampleFrame=requestAnimationFrame(()=>{if(signal.aborted||!box.isConnected)return;emit(candidateLabels[candidateOf(d.look)]+(candidateOf(d.look)==='comet'?'（本編既定）':'（比較専用）')+'\n静止：飛行時間 '+d.percent+'% / 実際の落下アニメーションを停止・時間指定\n'+diagnostic(played)+'\n箱 '+getComputedStyle(box).transform+'\n炎の不透明度 '+(flame?getComputedStyle(flame).opacity:'なし')+'\n最大60秒保持。再生・中断・次の静止確認で解除します。');});
}
window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;if(e.data.kind==='cancel')cancel();else if(e.data.kind==='inspect')inspect(e.data);else if(['auto','manual'].includes(e.data.kind))void play(e.data).catch(err=>emit(String(err)));});window.addEventListener('pagehide',cancel);render(fixture('floor'));emit('準備完了');

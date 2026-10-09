import {createRubyEruption,paintRubyEruption} from '../../src/next/ui/rubyEruption.ts';
import '../../src/next/ui/transformationCinematic.css';
import '../../src/next/ui/energyBox.css';
import {createTransformationCinematic} from '../../src/next/ui/transformationCinematic.ts';
import {configureLightCanvas,transformationThenLight} from '../../src/next/ui/imashiruLight.ts';
import {createBattleAnimator} from '../../src/next/ui/battleAnimator.ts';
import {createBattle,applyAction,gaugeDefinition,tuningOf} from '../../src/next/core/index.ts';
import {createProfile,freezeRunMeta} from '../../src/next/meta/profile.ts';
import {prepareDeparture} from '../../src/next/meta/departure.ts';
import {rosterPortrait} from '../../src/next/meta/home.ts';
import {energyBoxMarkup,energyAppearance} from '../../src/next/ui/energyBox.ts';
const style=document.createElement('style');style.textContent='*{box-sizing:border-box}body{margin:0;background:#11212d;color:#eaf8ff;font:14px system-ui;min-width:0}header{height:104px;display:flex;align-items:center;gap:16px;padding:8px 20px}header img{width:68px;height:86px;object-fit:contain}#board{position:relative;width:min(264px,calc(100vw - 32px));aspect-ratio:6/8;margin:12px auto;display:grid;grid-template-columns:repeat(6,1fr);gap:2px}.cell{position:relative;border:1px solid #344c59;border-radius:5px;background:#1a2c37;min-width:0}.cell.player{background:#51462c}.cell.enemy{background:#254958}#status{padding:8px 16px;overflow-wrap:anywhere}';document.head.append(style);
const board=document.getElementById('board')!,portrait=document.getElementById('portrait') as HTMLImageElement,status=document.getElementById('status')!;
const cinematic=createTransformationCinematic(),light=createRubyEruption(board);let abort=new AbortController(),trace:string[]=[],still:HTMLCanvasElement|undefined;
const profile=createProfile();profile.ownedCharacters=['blue','red'];const config=prepareDeparture(freezeRunMeta(profile,'red',false),1).config;
const before=createBattle({...config,initialGauge:gaugeDefinition(config.characterId,tuningOf(config))!.cap,initialBoxes:[{id:'a',row:7,col:0,owner:'player',type:'normal',status:'normal'},{id:'b',row:6,col:0,owner:'player',type:'normal',status:'normal'},{id:'c',row:7,col:2,owner:'player',type:'normal',status:'normal'},{id:'d',row:7,col:5,owner:'enemy',type:'normal',status:'normal'}]});
const result=applyAction(before,{type:'transform'});if(!result.accepted)throw Error('fixture');
const emit=(label:string)=>{trace.push(label);status.textContent=label;parent.postMessage({kind:'status',text:trace.join('\n')},location.origin);};
const render=(state:typeof before)=>{board.innerHTML=Array.from({length:48},(_,i)=>{const box=state.boxes.find(b=>b.row===Math.floor(i/6)&&b.col===i%6);return '<div class="cell '+(box?.owner??'')+'">'+(box?energyBoxMarkup(box,energyAppearance(state)):'')+'</div>';}).join('');};
function reset(){abort.abort();cinematic.cancel();light.clear();still?.remove();still=undefined;abort=new AbortController();trace=[];portrait.src=rosterPortrait('red').src;render(before);}
async function play(data:any){reset();const signal=abort.signal,motion={speed:data.speed,short:data.short,lowMotion:data.lowMotion};let revealed=false;
 await createBattleAnimator({motion:()=>motion,playSound(){},describe(){},observe(){},highlight(){},render(state){render(state);},drop(){},react(){},feedback(){return {remove(){}};},pause:async()=>{},complete(){emit('完了 / 残留Canvas '+document.querySelectorAll('.ruby-eruption').length);},
 transform:async event=>transformationThenLight(async()=>{emit('1 変化イラスト開始');const r=await cinematic.play({eventId:{},event,beforeSrc:rosterPortrait('red').src,afterSrc:rosterPortrait('red',true).src,signal,motion});portrait.src=rosterPortrait('red',true).src;emit('1 イラスト切替終了 '+r.status);return r;},async skipped=>{emit('2 炎の隕石開始');await light.play({},signal,motion,skipped||data.short);emit('2 炎の隕石終了 / 残留Canvas '+document.querySelectorAll('.ruby-eruption').length);},signal)})(result.resolution!,before,result.state,signal);
 if(signal.aborted)emit('中断 / 残留Canvas '+document.querySelectorAll('.ruby-eruption').length);
}
window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin)return;const d=e.data;if(d.kind==='play')void play(d);if(d.kind==='cancel'){abort.abort();cinematic.cancel();light.clear();}if(d.kind==='still'){reset();portrait.src=rosterPortrait('red',true).src;const r=board.getBoundingClientRect();still=document.createElement('canvas');Object.assign(still.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});board.append(still);const ctx=configureLightCanvas(still,r.width,r.height,window.devicePixelRatio)!;paintRubyEruption(ctx,r.width,r.height,d.p,d.lowMotion,d.short);emit('静止確認 '+Math.round(d.p*100)+'% / 炎の隕石の静止確認');}});
render(before);portrait.src=rosterPortrait('red').src;emit('準備完了');

import '../../src/next/ui/foundation.css';
import '../../src/next/ui/transformationButton.css';
import '../../src/next/style.css';
import '../../src/next/ui/boxVanish.css';
import '../../src/next/ui/skillActivationEffects.css';
import '../../src/next/ui/energyBox.css';
import '../../src/next/ui/portraitViewer.css';
import '../../src/next/ui/dropMotion.css';
import '../../src/next/ui/boardSkillPresentation.css';
import '../../src/next/ui/rowProjection.css';
import '../../src/next/ui/stageNumberCinematic.css';
import '../../src/next/ui/portraitReactions.css';
import '../../src/next/ui/rewardPresentation.css';
import '../../src/next/ui/stagePresentation.css';
import '../../src/next/ui/bossPresentation.css';
import '../../src/next/ui/turnPresentation.css';
import '../../src/next/ui/enemyIntent.css';
import '../../src/next/ui/enemyPower.css';
import '../../src/next/ui/playerPower.css';
import '../../src/next/ui/carryPreview.css';
import '../../src/next/ui/battleReadability.css';
import '../../src/next/ui/shapeFeedback.css';
import '../../src/next/ui/transformationCinematic.css';
import {mountHome,rosterPortrait} from '../../src/next/meta/home.ts';
import {ProfileStore,createProfile,freezeRunMeta} from '../../src/next/meta/profile.ts';
import {rosterIds} from '../../src/next/meta/roster.ts';
import {prepareDeparture} from '../../src/next/meta/departure.ts';
import {createBattle} from '../../src/next/core/battle.ts';
import {createSkill} from '../../src/next/core/playerBuild.ts';
import {resolveActiveDrop} from '../../src/next/core/activeDrop.ts';
import {skillHudHtml} from '../../src/next/ui/skillHud.ts';
import {energyBoxMarkup,energyAppearance} from '../../src/next/ui/energyBox.ts';
import {createEnergyLinks} from '../../src/next/ui/energyLinks.ts';
import {createSkillActivationEffects} from '../../src/next/ui/skillActivationEffects.ts';
import {captureAnimationMotion} from '../../src/next/ui/animationTimeline.ts';
import {placeFeedbackBubble} from '../../src/next/ui/feedbackLayout.ts';
import {installViewportHeight} from '../../src/next/ui/viewportLayout.ts';
import {feedbackForEvent} from '../../src/next/ui/battleFeedback.ts';
import {shapeFeedbackHtml} from '../../src/next/ui/shapeFeedback.ts';
import {transformationButton} from '../../src/next/ui/transformationButton.ts';
import {controlIcon} from '../../src/next/ui/controlIcons.ts';
import battleMarkup from './battle-markup.html?raw';
import type {Box} from '../../src/next/core/types.ts';
installViewportHeight(document.documentElement);
const root=document.getElementById('app')!,view=new URLSearchParams(location.search).get('view')??'home';
root.innerHTML=battleMarkup;
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const data=new Map<string,string>(),store=new ProfileStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}},()=>true);
store.read();const profile=createProfile(1);profile.ownedCharacters=[...rosterIds];profile.selected='imashiru';
if(view==='long-home'){profile.energy=123456789;profile.coins=123456789;}
if(view==='deep-home')profile.trophies['clear50:imashiru']=1;
store.write(profile);
const home=mountHome(root,{store:()=>store,saved:()=>null,continue(){},async launch(){},preview:false,mountMusic(host){host.innerHTML='<button id="home-music-toggle" class="compact-sound-control" aria-label="BGM"><span>BGM</span><span>ON</span></button>';return ()=>{};}});
let place=()=>{};
if(view.includes('home')){
 home.show();
 if(view==='long-home')document.querySelector('.home-identity h1')!.textContent='ヴァイオレット・星の守り手';
 if(view==='home-dialog')(document.querySelector('[data-home="settings"]') as HTMLButtonElement).click();
}else{
 home.hide();
 const col=view==='damage-right'?5:0,boxes:Box[]=[5,6].map(row=>({id:'qa:'+row,row,col,owner:'player',type:'normal',status:'normal'}));
 const config=prepareDeparture(freezeRunMeta(profile,'red',false),1).config;
 const before=createBattle({...config,initialBoxes:boxes}),origin={row:7,col};
 const step=resolveActiveDrop(before,{id:'test',available:true,landing:origin,spawn:origin,edge:{...origin,side:'top'},segmentEndRow:7,path:[origin]}),state={...step.state,build:{...step.state.build!}};
 state.build!.slots=[createSkill('full-power'),createSkill('foundation'),createSkill('health'),createSkill('crossfire')];
 const art=rosterPortrait('red');el<HTMLImageElement>('player-image').src=art.src;el<HTMLImageElement>('enemy-image').src=rosterPortrait('violet').src;
 el('player-name').textContent='アカリ';el('enemy-name').textContent='ヴァイオレット・強敵';el('player-hp').textContent='9999 / 9999';el('enemy-hp').textContent='999999 / 999999';
 el('gauge-text').textContent='ゲージ 99 / 100';el('intent').textContent='攻撃 999';el('stage').textContent='STAGE 50';el('turn').textContent='999手';el('form').textContent='通常';
 el('skill-hud').innerHTML=skillHudHtml(state,true);el('hint').textContent='列をタップして着地点を確認';el('save-status').textContent='保存済み';
 el('actions').innerHTML='<button data-board="true">ほむらの火種</button>'+transformationButton(state,true)+'<button class="settings-icon-button" aria-label="設定">'+controlIcon('settings')+'</button>';
 for(const id of ['audio-controls','music-controls'])el(id).innerHTML='<button class="compact-sound-control">'+(id==='audio-controls'?'効果音':'BGM')+'<span>ON</span></button>';
 const board=el('board');for(let row=0;row<8;row++)for(let c=0;c<6;c++){const b=state.boxes.find(x=>x.row===row&&x.col===c),cell=document.createElement('button');cell.className='cell'+(b?' '+b.owner:'');cell.dataset.cellRow=String(row);cell.dataset.cellCol=String(c);if(b){cell.dataset.boxId=b.id;cell.innerHTML=energyBoxMarkup(b,energyAppearance(state));}board.append(cell);}
 const area=root.querySelector<HTMLElement>('.board-area')!;
 function fit(){const r=area.getBoundingClientRect(),size=Math.max(24,Math.floor(Math.min((r.width-28-10)/6,(r.height-34-14)/8,64)));root.style.setProperty('--cell',size+'px');root.style.setProperty('--cols','6');root.style.setProperty('--rows','8');place();}
 const resize=new ResizeObserver(fit);resize.observe(area);fit();
 for(let c=0;c<6;c++){const b=document.createElement('button');b.className='edge-emitter';b.textContent='▼';b.style.left='calc('+c+' * (var(--cell) + 2px) + var(--cell)/2)';b.style.top='0';el('drop-buttons').append(b);}
 if(view.startsWith('damage')){
  const event=step.events.find(e=>e.type==='attack')!,feedback=feedbackForEvent(event,step.links)!;
  const bubble=document.createElement('div');bubble.className='floating-feedback damage';
  const n=view==='damage-large'?'9007199254740991':view==='damage-right'?'999999999':'999';
  bubble.innerHTML='<strong>'+n+'ダメージ</strong><small>縦3リンク・成長する火＋・追加ダメージ</small>';
  el('feedback-layer').append(bubble);
  place=()=>placeFeedbackBubble(area,el('feedback-layer'),bubble,[...board.querySelectorAll<HTMLElement>('.player')],'enemy');place();area.addEventListener('scroll',place);
  const fire=createSkillActivationEffects(root),energy=createEnergyLinks(root),motion=captureAnimationMotion({speed:'slow',short:false,lowMotion:false});
  const timer=window.setTimeout;window.setTimeout=(()=>999999) as typeof window.setTimeout;
  try{fire.play(event,step.links,state,new AbortController().signal,motion);energy.play(event,step.links,state,new AbortController().signal,motion);}finally{window.setTimeout=timer;}
  for(const a of document.getAnimations())if((a.effect as KeyframeEffect)?.target instanceof Element&&((a.effect as KeyframeEffect).target as Element).closest('.skill-activation-layer,.energy-link-layer')){a.pause();a.currentTime=140;}
 }
 if(view==='skill-dialog'){const d=el<HTMLDialogElement>('skill-info');d.innerHTML='<div class="dialog-top"><h2>成長する火＋・技の説明</h2><button class="dialog-close-icon">×</button></div><p class="skill-info-effect">'+('縦リンクが成立するたび、次の攻撃が強くなります。 ').repeat(14)+'</p><button class="skill-use-button">閉じる</button>';d.showModal();}
}
function report(){
 place();
 const box=(e:Element)=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const surface=document.querySelector<HTMLElement>(view.includes('home')?'#meta-home':'.game')!,r=box(surface);
 const active=document.querySelector<HTMLDialogElement>('dialog[open]');
 const selectors=view.includes('home')?['.home-top','.home-hero','.home-identity','.home-tools','.home-roster','.home-utilities','.home-departure','.home-primary','.home-deep','.home-music-controls']:['.hud','.strip','.board-area','.board','.skill-hud','.controls','.actions','.floating-feedback'];
 const rects=Object.fromEntries(selectors.flatMap(s=>{const e=document.querySelector(s);return e?[[s,box(e)]]:[];})),failures:string[]=[];
 if(document.documentElement.scrollWidth>innerWidth+1)failures.push('document horizontal overflow');
 if(surface.scrollWidth>surface.clientWidth+1)failures.push('surface horizontal overflow');
 if(view.includes('home')){for(const [a,b] of [['.home-tools','.home-roster'],['.home-identity','.home-tools'],['.home-utilities','.home-departure']]){const x=rects[a],y=rects[b];if(x&&y&&x.bottom>y.top+1&&x.top<y.bottom&&x.left<y.right&&x.right>y.left)failures.push(a+' overlaps '+b);}}
 const bubble=document.querySelector<HTMLElement>('.floating-feedback');if(bubble){const b=box(bubble),a=box(document.querySelector('.board-area')!);if(b.left<a.left-1||b.right>a.right+1||b.top<a.top-1||b.bottom>a.bottom+1)failures.push('damage outside board viewport');if(bubble.scrollWidth>bubble.clientWidth+1)failures.push('damage text overflow');}
 if(active){const d=box(active);if(d.left<0||d.right>innerWidth+1||d.top<0||d.bottom>innerHeight+1)failures.push('dialog outside viewport');if(active.scrollWidth>active.clientWidth+1)failures.push('dialog horizontal overflow');}
 const primary=document.querySelector<HTMLElement>(view.includes('home')?'.home-primary':'.settings-icon-button');if(primary&&box(primary).height<44)failures.push('primary tap height below44');
 const brokenImages=[...document.images].filter(i=>i.hasAttribute('src')&&!!i.getAttribute('src')&&i.complete&&!i.naturalWidth).map(i=>i.src);if(brokenImages.length)failures.push('image missing');
 parent.postMessage({kind:'layout-result',report:{view,viewport:[innerWidth,innerHeight],surface:r,scrollWidth:surface.scrollWidth,clientWidth:surface.clientWidth,scrollHeight:surface.scrollHeight,scrollable:surface.scrollHeight>surface.clientHeight+1,rects,dialog:active?{...box(active),scrollHeight:active.scrollHeight,clientHeight:active.clientHeight}:null,failures,brokenImages}},location.origin);
}
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.kind==='measure')requestAnimationFrame(report);});
await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await document.fonts.ready;requestAnimationFrame(()=>requestAnimationFrame(report));

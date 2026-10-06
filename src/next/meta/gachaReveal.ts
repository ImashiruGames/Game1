import {META} from './profile.ts';
import type {DrawResult} from './profile.ts';
import type {RosterId} from './roster.ts';
import {roster} from './roster.ts';
import {skillName} from '../core/skillCatalog.ts';
import type {NormalSkillId} from '../core/types.ts';
import {preparationSkillCard} from './preparationPresentation.ts';
import {createGachaRevealState,gachaTotals,isNewCharacter} from './gachaRevealState.ts';
import type {GachaRevealState} from './gachaRevealState.ts';
import './gachaReveal.css';
import {preloadGachaPortraits} from './gachaPortraitPreload.ts';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const name=(r:DrawResult)=>r.kind==='character'?roster[r.item as RosterId].name:r.kind==='skill'?skillName(r.item as NormalSkillId,1):'経験値エナジー';
const kind=(r:DrawResult)=>r.kind==='character'?'キャラクター':r.kind==='skill'?'通常スキル':'育成アイテム';
const exchange=(r:DrawResult)=>r.duplicate?`重複 → ${r.kind==='character'?`経験値エナジー+${r.energy}`:`コイン+${r.coins}`}`:r.kind==='energy'?`経験値エナジー+${r.energy}`:'NEW';
export function gachaDrawButtons(coins:number,disabled=false,again=false){return `<div class="gacha-draw-buttons">${([1,10] as const).map(count=>{const cost=count===1?META.gachaCost:META.gachaBatchCost;return `<div><button class="gacha-pull" data-gacha="${count}" ${disabled||coins<cost?'disabled':''}><strong>${count===1?(again?'もう1回':'1回引く'):(again?'10連':'10連で引く')}</strong><span>◈ ${cost} コイン</span>${count===10?'<small>1回分お得</small>':''}</button><p class="gacha-shortage">${coins<cost?`あと${cost-coins}コイン`:''}</p></div>`;}).join('')}</div>`;}
interface RevealHooks {coins():number;blocked():boolean;draw(count:1|10):DrawResult[]|null;portrait(id:RosterId):{src:string;alt:string};closed():void;error():string}
/** 日本語: 別のモーダルで背面のガチャ操作を止める。
 * English: A second native modal keeps the underlying gacha panel inert. */
export function mountGachaReveal(root:HTMLElement,hooks:RevealHooks){
 const dialog=document.createElement('dialog');dialog.id='gacha-reveal';dialog.setAttribute('aria-label','ガチャ結果');dialog.tabIndex=-1;root.append(dialog);
 let controller:ReturnType<typeof createGachaRevealState>|null=null,results:DrawResult[]=[],state:GachaRevealState={phase:'closed',index:0,seen:[],skipping:false,waitingForPortrait:false},destroyed=false,drawing=false,reduced=false;
 let preload:ReturnType<typeof preloadGachaPortraits>|null=null;
 function portraitMarkup(r:DrawResult){const portrait=hooks.portrait(r.item as RosterId);return `<div class="gacha-portrait" ${preload?.status(portrait.src)==='failed'?'data-image-error="true"':''}><span class="gacha-art-fallback" aria-hidden="true">✦</span><img src="${esc(portrait.src)}" alt="${esc(portrait.alt)}" decoding="async"><span class="gacha-art-error">イラストを読み込めませんでした</span></div>`;}
 function compact(r:DrawResult,index:number){return `<li class="gacha-small-result" data-result-index="${index}" data-kind="${r.kind}"><span class="gacha-result-number">${String(index+1).padStart(2,'0')}</span><small>${kind(r)}</small><strong>${esc(name(r))}</strong><span class="${!r.duplicate&&r.kind!=='energy'?'gacha-new-label':'gacha-exchange'}">${exchange(r)}</span></li>`;}
 function render(){
  if(destroyed||state.phase==='closed')return;
  dialog.dataset.phase=state.phase;dialog.dataset.reducedMotion=String(reduced);
  const r=results[state.index],summary=state.phase==='summary',front=state.phase==='front',flipping=state.phase==='flipping';
  const top=`<header class="gacha-reveal-header"><div><small>DISCOVERY</small><strong>${summary?'RESULT':`${state.index+1} / ${results.length}`}</strong></div>${summary?'':`<button data-gacha-skip>スキップ</button>`}</header>`;
  let body='';
  if(state.phase==='capsules')body=`<div class="gacha-capsules ${results.length===10?'is-ten':''}" aria-label="カプセルが開きます">${results.map((_,i)=>`<div class="gacha-capsule" style="--capsule-index:${i}"><i></i><b></b><span>✦</span></div>`).join('')}</div><p class="gacha-reveal-hint">カプセルを開いています</p>`;
  else if(summary){const totals=gachaTotals(results);body=`<section class="gacha-summary" aria-labelledby="gacha-summary-title"><div class="gacha-summary-heading"><h2 id="gacha-summary-title">獲得したもの</h2><p class="gacha-summary-totals">経験値エナジー+${totals.energy}　コイン+${totals.coins}</p></div><ol class="gacha-result-grid">${results.map(compact).join('')}</ol><footer class="gacha-summary-actions"><p class="gacha-current-balance">所持コイン ◈ ${hooks.coins()}</p>${gachaDrawButtons(hooks.coins(),hooks.blocked()||drawing,true)}<button data-gacha-close>閉じる</button><p class="gacha-save-error" role="alert">${hooks.blocked()?esc(hooks.error()):''}</p></footer></section>`;}
  else if(front&&r&&isNewCharacter(r))body=`<section class="gacha-new-character" aria-label="初入手 ${esc(name(r))}">${portraitMarkup(r)}<div class="gacha-character-name"><span class="gacha-new-label">NEW</span><p>新しい仲間</p><h2>${esc(name(r))}</h2></div></section><p class="gacha-reveal-hint">${state.waitingForPortrait?'イラストを読み込んでいます':'タップで次へ'}</p>`;
  else if(r){const content=front?r.kind==='skill'?`<div class="skill-card-surface gacha-revealed-skill">${preparationSkillCard(r.item as NormalSkillId)}</div><span class="${r.duplicate?'gacha-exchange':'gacha-new-label'}">${exchange(r)}</span>`:r.kind==='character'?`<article class="gacha-revealed-character">${portraitMarkup(r)}<small>キャラクター</small><h2>${esc(name(r))}</h2><p>${exchange(r)}</p></article>`:`<article class="gacha-energy-card"><span aria-hidden="true">✧</span><small>育成アイテム</small><h2>経験値エナジー+${r.energy}</h2></article>`:`<button class="gacha-card-back ${flipping?'is-flipping':''}" data-gacha-flip aria-label="${state.index+1}枚目のカードをめくる" ${flipping?'disabled':''}><span>DISCOVERY</span><b aria-hidden="true">✦</b><small>タップでめくる</small></button>`;body=`<div class="gacha-card-stage">${content}</div><p class="gacha-reveal-hint">${front?'画面をタップして次へ':flipping?'カードをめくっています':'カードをタップ'}</p>`;}
  const tray=!summary&&state.phase!=='capsules'?`<ol class="gacha-reveal-tray" aria-label="めくったカード">${state.seen.filter(i=>i!==state.index).map(i=>compact(results[i]!,i)).join('')}</ol>`:'';
  dialog.innerHTML=top+`<div class="gacha-reveal-content ${front&&r&&isNewCharacter(r)?'has-new-character':''}">${body}</div>`+tray;
  dialog.querySelectorAll<HTMLImageElement>('.gacha-portrait img').forEach(img=>{if(img.complete&&!img.naturalWidth)img.parentElement!.dataset.imageError='true';});
  // Keep keyboard focus in the modal after replacing a revealed card or an action button.
  if(!dialog.contains(document.activeElement))dialog.focus({preventScroll:true});
 }
 function start(committed:DrawResult[]){
  if(destroyed||!committed.length)return;
  controller?.destroy();controller=null;preload?.destroy();results=committed.map(r=>({...r}));
  reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.body.dataset.reducedMotion==='true';
  preload=preloadGachaPortraits(results.filter(isNewCharacter).map(r=>hooks.portrait(r.item as RosterId).src),()=>controller?.portraitSettled());
  controller=createGachaRevealState(results,reduced,next=>{state=next;render();},undefined,r=>preload?.settled(hooks.portrait(r.item as RosterId).src)??false);state=controller.current;
  if(!dialog.open)dialog.showModal();
  render();
 }
 function close(notify=true){if(!controller&&!dialog.open)return;controller?.destroy();controller=null;state={...state,phase:'closed'};results=[];preload?.destroy();preload=null;if(dialog.open)dialog.close();dialog.innerHTML='';if(notify)hooks.closed();}
 function drawAgain(count:1|10){if(drawing||state.phase!=='summary'||hooks.blocked()||hooks.coins()<(count===1?META.gachaCost:META.gachaBatchCost))return;drawing=true;try{const committed=hooks.draw(count);if(committed)start(committed);else render();}finally{drawing=false;}}
 dialog.addEventListener('click',event=>{event.stopPropagation();const target=event.target instanceof Element?event.target:null,button=target?.closest<HTMLButtonElement>('button');if(button?.disabled)return;if(button?.hasAttribute('data-gacha-skip')){controller?.skip();return;}if(button?.hasAttribute('data-gacha-close')){close();return;}if(button?.hasAttribute('data-gacha')){drawAgain(button.dataset.gacha==='10'?10:1);return;}controller?.tap(!!button?.hasAttribute('data-gacha-flip'));});
 dialog.addEventListener('keydown',event=>{if(event.repeat){if(event.key==='Enter'||event.key===' ')event.preventDefault();return;}if((event.key==='Enter'||event.key===' ')&&event.target===dialog){event.preventDefault();controller?.tap(state.phase==='back');}});
 dialog.addEventListener('close',()=>{if(!dialog.open)close();});
 dialog.addEventListener('cancel',event=>{event.preventDefault();if(state.phase==='summary')close();});
 dialog.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.closest('.gacha-portrait'))img.parentElement!.dataset.imageError='true';},true);
 const interrupted=()=>close();window.addEventListener('popstate',interrupted);window.addEventListener('pagehide',interrupted);
 return {start,close,get active(){return !!controller;},destroy(){destroyed=true;close(false);window.removeEventListener('popstate',interrupted);window.removeEventListener('pagehide',interrupted);dialog.remove();}};
}

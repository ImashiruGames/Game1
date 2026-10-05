import '../src/next/style.css';
import '../src/next/ui/rewardPresentation.css';
import { rewardPanelHtml, rewardCardView } from '../src/next/ui/rewardPresentation.ts';
import type { RewardPresentationState } from '../src/next/ui/rewardPresentation.ts';
import { createBattle } from '../src/next/core/battle.ts';
import { createTrialConfig } from '../src/next/config.ts';
import { createSkill } from '../src/next/core/playerBuild.ts';
import type { RewardId, RewardOffer } from '../src/next/app/rewards.ts';
import { requiresReplacement } from '../src/next/app/rewards.ts';
const qs=new URLSearchParams(location.search);
const mode=qs.get('mode')??'stats';
let state=createBattle(createTrialConfig());
state={...state,hp:{...state.hp,player:{current:18,max:60}},build:{...state.build!,slots:mode==='replace'?[createSkill('horizontal-slash'),createSkill('grow-fire')]:[null,null]}};
let offer:RewardOffer={id:'design-preview-offer',category:mode==='category'?'pending':mode==='stats'?'stats':'skills',choices:mode==='stats'?['max-health','three-polish','five-polish']:mode==='replace'?['square-strike','first-guard','magic-bullet']:['health','corner-strike','square-strike']};
let ui:RewardPresentationState={selected:qs.get('selected') as RewardId|null,replacing:mode==='replace',replacementSlot:qs.get('slot')===null?null:Number(qs.get('slot')),stage:8};
let receipt='';
const dialog=document.querySelector<HTMLDialogElement>('#reward')!;
const render=()=>{
 if(receipt){dialog.innerHTML=`<div class="build-reward-shell"><p class="reward-eyebrow">DESIGN PREVIEW / UI SAMPLE</p><h2 id="reward-title">${receipt}</h2><p style="margin:18px 0;color:#b7c8bf;font-size:13px">表示サンプルの確認が完了しました。<br>実際のゲームやセーブには反映されません。</p><button class="reward-confirm" data-preview-return>カードへ戻る</button></div>`;return;}
 dialog.innerHTML=rewardPanelHtml(state,offer,ui).replace(' / BUILD',' / UI SAMPLE');
};
dialog.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;
 if(b.hasAttribute('data-preview-return')){receipt='';render();return;}
 if(b.dataset.category==='heal'){receipt='回復サンプル：HP 18 → 28 / 60';render();return;}
 if(b.dataset.category){offer={...offer,category:b.dataset.category as 'stats'|'skills',choices:b.dataset.category==='stats'?['max-health','three-polish','five-polish']:['health','corner-strike','square-strike']};ui={...ui,selected:null,replacing:false,replacementSlot:null};}
 if(b.dataset.rewardPreview){ui={...ui,selected:b.dataset.rewardPreview as RewardId,replacing:false,replacementSlot:null};}
 if(b.dataset.rewardConfirm&&ui.selected){if(requiresReplacement(state.build!,ui.selected)&&!ui.replacing)ui={...ui,replacing:true};else receipt=`${rewardCardView(state,ui.selected).title}：確定サンプル`;}
 if(b.dataset.replacePreview!==undefined)ui={...ui,replacementSlot:Number(b.dataset.replacePreview)};
 if(b.dataset.replaceCancel)ui={...ui,replacing:false,replacementSlot:null};
 if(b.dataset.rewardSkip)receipt='取らずに次へ：確認サンプル';
 render();
});
dialog.addEventListener('cancel',e=>e.preventDefault());
render();dialog.showModal();

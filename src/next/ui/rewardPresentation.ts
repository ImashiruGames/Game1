import { isSkillReward, requiresReplacement } from '../app/rewards.ts';
import {stageLabel} from './stageLabel.ts';
import type { RewardId, RewardOffer } from '../app/rewards.ts';
import { currentRewardReplacement, rewardSlotToken, rewardSelectionToken } from './rewardInteraction.ts';
import { basePlayerPower, canReceiveSkillReward } from '../core/playerBuild.ts';
import { skillCatalog, skillDescription, skillName, skillValue } from '../core/skillCatalog.ts';
import { tuningOf } from '../core/tuning.ts';
import type { BattleState, NormalSkillId, SkillInstance } from '../core/types.ts';
import type { ShapePattern } from '../core/shapePatterns.ts';

/** A read-only presenter. No RNG, controller calls, persistence or game-state writes. */
export interface RewardPresentationState {
  readonly selected: RewardId | null;
  readonly replacing: boolean;
  readonly replacementSlot: number | null;
  readonly replacementToken?: string | null;
  readonly busy?: boolean;
  readonly stage?: number;
}
export interface RewardCardView {
  readonly id: RewardId;
  readonly title: string;
  readonly family: string;
  readonly metric: string;
  readonly effect: string;
  readonly detail: string;
  readonly placement: string;
  readonly comparison: readonly { label: string; before: string; after: string }[];
  readonly tone: 'pink' | 'mint' | 'blue' | 'gold';
  readonly icon: 'heart' | 'bolt' | 'shield' | 'sword' | 'potion' | 'shape' | 'fire';
  readonly pattern?: ShapePattern;
  readonly linkDirection?: 'vertical' | 'horizontal' | 'diagonal';
  readonly powerTier?: 3 | 4 | 5;
  readonly upgrade: boolean;
}
const esc = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const rankOf = (state: BattleState, id: NormalSkillId): SkillInstance | undefined => [state.build!.fixed, ...state.build!.slots].find(skill => skill?.id === id) ?? undefined;

export function rewardCardView(state: BattleState, id: RewardId, asUnowned=false, displayRank?:1|2): RewardCardView {
  const t = tuningOf(state.config), r = t.rewards, hp = state.hp.player;
  const common = { id, upgrade: false, tone: 'mint' as const, icon: 'sword' as const, family: 'ステータス', placement: 'このラン中 · 枠を使わない' };
  if (id === 'max-health') return { ...common, title: 'HP上限UP', family: '生存力', tone: 'pink', icon: 'heart', metric: `+${r.maxHp}`, effect: '最大HP ＆ 現在HP', detail: '最大HPと現在HPが同じ分だけ増えます。', comparison: [{ label: '現在HP', before: String(hp.current), after: String(hp.current + r.maxHp) }, { label: '最大HP', before: String(hp.max), after: String(hp.max + r.maxHp) }] };
  if (id === 'immediate-heal') return { ...common, title: '今すぐ回復', family: '回復', tone: 'pink', icon: 'heart', metric: `+${Math.min(r.immediateHeal, hp.max-hp.current)}`, effect: '現在HP', detail: `HPを${r.immediateHeal}回復。最大HPまで。`, placement: '即時回復 · 枠を使わない', comparison: [{label:'HP', before:`${hp.current}/${hp.max}`, after:`${Math.min(hp.max,hp.current+r.immediateHeal)}/${hp.max}`}] };
  if (!isSkillReward(id)) {
    const tier = id === 'three-polish' ? 3 : id === 'four-polish' ? 4 : 5;
    const gain = tier === 3 ? r.threePower : tier === 4 ? r.fourPower : r.fivePower;
    if (id === 'large-polish') return { ...common, title: '大連研磨', metric: `+${r.largeFourPower} / +${r.largeFivePower}`, effect: '4 / 5以上リンク火力', detail: '次の戦闘からも続く基本火力の強化です。', comparison: [4,5].map(n => ({label:`${n === 5 ? '5+' : n}リンク`, before:String(basePlayerPower(state,n as 4|5)), after:String(basePlayerPower(state,n as 4|5)+(n===4?r.largeFourPower:r.largeFivePower))})) };
    return { ...common, powerTier:tier, title: tier === 3 ? '三連研磨' : `${tier === 5 ? '5以上' : tier}リンク強化`, metric: `+${gain}`, effect: `${tier === 5 ? '5以上' : tier}リンク火力`, detail: '次の戦闘での基本火力。戦闘中の成長分は含みません。', comparison: [{ label: `${tier === 5 ? '5+' : tier}リンク`, before: String(basePlayerPower(state,tier)), after: String(basePlayerPower(state,tier)+gain) }] };
  }
  const owned = asUnowned ? undefined : rankOf(state,id), rank = displayRank ?? (owned && skillCatalog[id].upgradeable !== false ? 2 : 1), n = skillValue(id,rank,t), old = owned ? skillValue(id,owned.rank,t) : 0;
  const slot = state.build!.fixed.id === id ? '固定枠' : `自由${state.build!.slots.findIndex(s => s?.id===id)+1}`;
  const placement = owned ? `${slot}で＋強化 · 枠はそのまま` : requiresReplacement(state.build!,id) ? '自由枠が満杯 · 入れ替えが必要' : `自由${state.build!.slots.findIndex(s=>s===null)+1}に装備`;
  const base = { ...common, title: skillName(id,rank), family: owned ? '同じスキルを＋へ' : '新しいスキル', upgrade: !!owned, placement, detail: skillDescription(id,rank,t), pattern: skillCatalog[id].pattern };
  const compare = (label:string, before:string, after:string) => [{label,before:owned?before:'未装備',after}];
  switch(id) {
    case 'heavy-swing': return {...base,icon:'sword',metric:`5連 ×${n/100}`,effect:'5個以上リンクに火力加算',comparison:compare('現在の加算量',String(Math.floor(basePlayerPower(state,5)*old/100)),String(Math.floor(basePlayerPower(state,5)*n/100)))};
    case 'rescue-kit': return {...base,title:skillName(id,1),upgrade:false,family:'トロフィースキル · 強化なし',placement:owned?`${slot}に装備中 · 強化なし`:placement,tone:'pink',icon:'shape',metric:'HP 10',effect:'固定形で回復 · 中央上は任意',comparison:compare('回復量',String(old),'10')};
    case 'clear-column': case 'pincer-strike': case 'twin-diagonal': case 'square-conduit': case 'venom-edge': case 'frost-edge': case 'exact-four': case 'shiny-relay': return {...base,icon:'sword',metric:`+${n}`,effect:'現在の盤面条件でリンク強化',comparison:compare('条件成立時の加算',String(old),String(n))};
    case 't-strike': case 'zigzag-strike': case 'cup-strike': case 'diamond-strike': case 'cross-strike': return {...base,icon:'shape',metric:String(n),effect:'形のダメージ',comparison:compare('ダメージ',String(old),String(n))};
    case 'full-power': case 'foundation': case 'snake-line': case 'edge-strike': case 'siege': case 'crossfire': case 'last-stand': return {...base,icon:'sword',metric:`+${n}`,effect:'現在の盤面条件でリンク強化',comparison:compare('条件成立時の加算単位',String(old),String(n))};
    case 'iron-wall': return {...base,icon:'shield',metric:`−${n}`,effect:'自箱2×2で敵リンク軽減',comparison:compare('軽減量',String(old),String(n))};
    case 'capacitor': return {...base,icon:'bolt',metric:`+${n}`,effect:'ゲージ・1回限り',comparison:compare('ゲージ獲得',String(old),String(n))};
    case 'solvent': return {...base,icon:'potion',metric:`${n}箱`,effect:'自箱の毒・氷をノーマルへ',comparison:compare('最大対象数',String(old),String(n))};
    case 'poison-craft': return {...base,icon:'shape',metric:'常時',effect:'自箱2×2ごと毒ダメージ＋1',comparison:[]};
    case 'health': return {...base,tone:'pink',icon:'shape',metric:`HP ${n}`,effect:'＋形で回復',comparison:compare('回復量',String(old),String(n))};
    case 'grow-fire': return {...base,linkDirection:'vertical',tone:'gold',icon:'fire',metric:`3連 +${n}`,effect:'縦3以上の火力',detail:`縦3以上は3連基本火力＋${n}。発動後に戦闘中の成長＋${t.links.growFireGrowth}。`,comparison:compare('次戦の縦3+',String(basePlayerPower(state,3)+old),String(basePlayerPower(state,3)+n))};
    case 'charge': return {...base,tone:'blue',icon:'bolt',metric:`+${n+t.gauge.turnGain}`,effect:'手番終了のゲージ',comparison:compare('終了時ゲージ',`+${old+t.gauge.turnGain}`,`+${n+t.gauge.turnGain}`)};
    case 'first-guard': return {...base,tone:'blue',icon:'shield',metric:`−${n}`,effect:'敵の最初のリンク被害',comparison:compare('被害の軽減',`−${old}`,`−${n}`)};
    case 'horizontal-slash': return {...base,linkDirection:'horizontal',icon:'sword',metric:`+${n}`,effect:'横3以上のリンク火力',comparison:compare('横の上乗せ',`+${old}`,`+${n}`)};
    case 'diagonal-shot': return {...base,linkDirection:'diagonal',icon:'sword',metric:`+${n}`,effect:'斜め3以上のリンク火力',comparison:compare('斜めの上乗せ',`+${old}`,`+${n}`)};
    case 'corner-strike': return {...base,icon:'shape',metric:String(n),effect:'L形のダメージ',comparison:compare('ダメージ',String(old),String(n))};
    case 'square-strike': return {...base,icon:'shape',metric:String(n),effect:'2×2のダメージ',comparison:compare('ダメージ',String(old),String(n))};
    case 'healing-potion': return {...base,tone:'pink',icon:'potion',metric:`HP ${n}`,effect:'1回限り · 1手消費',comparison:compare('回復量',String(old),String(n))};
    case 'magic-bullet': return {...base,tone:'gold',icon:'bolt',metric:`4連 ×${n}`,effect:'1回限り · 1手消費',comparison:compare('現在のダメージ',String(basePlayerPower(state,4)*old),String(basePlayerPower(state,4)*n))};
  }
}

/** Exact catalog cells, including the 5-cell plus. fixedOrientation is the future hook. */
export function rewardShapeHtml(pattern: ShapePattern): string {
  const minRow=Math.min(...pattern.cells.map(c=>c.row)), minCol=Math.min(...pattern.cells.map(c=>c.col));
  const rows=Math.max(...pattern.cells.map(c=>c.row))-minRow+1, columns=Math.max(...pattern.cells.map(c=>c.col))-minCol+1;
  const orientation=pattern.fixedOrientation?'天地無用':'回転可';
  return `<span class="reward-shape-wrap"><span class="reward-shape" role="img" aria-label="${rows}行${columns}列、${pattern.cells.length}マスの形、${orientation}" style="--shape-cols:${columns}">${Array.from({length:rows*columns},(_,i)=>`<i class="${pattern.cells.some(c=>c.row-minRow===Math.floor(i/columns)&&c.col-minCol===i%columns)?'filled':''}" aria-hidden="true"></i>`).join('')}</span><span class="shape-orientation${pattern.fixedOrientation?' fixed-orientation':''}">${pattern.fixedOrientation?'↑ ': '↻ '}${orientation}</span></span>`;
}
export function rewardIconHtml(icon: RewardCardView['icon']): string {
  const paths: Record<RewardCardView['icon'],string> = {
    heart: '<path d="M3 6h3V3h5v3h2V3h5v3h3v7h-3v3h-3v3h-3v3h-3v-3H6v-3H3z"/><path class="icon-shine" d="M6 6h3v3H6z"/>',
    bolt: '<path d="M13 1h7l-5 8h6L8 23l3-10H4z"/><path class="icon-shine" d="M13 4h3l-4 6H9z"/>',
    shield: '<path d="M3 3h6V1h6v2h6v12h-3v4h-3v3H9v-3H6v-4H3z"/><path class="icon-cut" d="M10 7h4v8h-4z"/>',
    sword: '<path d="M17 1h6v6L12 18l-3-3zM5 12l7 7-3 3-7-7zM4 19l2 2-3 3-2-2z"/><path class="icon-shine" d="M19 3h2v2L11 15l-2-2z"/>',
    potion: '<path d="M8 1h8v3h-2v4l6 6v7H4v-7l6-6V4H8z"/><path class="icon-cut" d="M8 14h8v4H8z"/><path class="icon-shine" d="M7 12h3v3H7z"/>',
    fire: '<path d="M13 1v6h4v3h3v10h-3v3H7v-3H4v-8h3V8h3V4z"/><path class="icon-cut" d="M12 12v4h3v5H9v-6z"/>',
    shape: '<path d="M9 1h6v7h7v7h-7v7H9v-7H2V8h7z"/>',
  };
  return `<svg class="reward-pixel-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" shape-rendering="crispEdges">${paths[icon]}</svg>`;
}
function linkDiagramHtml(direction: 'vertical' | 'horizontal' | 'diagonal'): string {
 const label=direction==='vertical'?'縦':direction==='horizontal'?'横':'斜め';
 return `<span class="reward-shape-wrap"><span class="reward-shape" role="img" aria-label="${label}方向に3個以上のリンク" style="--shape-cols:3">${Array.from({length:9},(_,i)=>`<i class="${(direction==='vertical'?i%3===1:direction==='horizontal'?Math.floor(i/3)===1:Math.floor(i/3)+i%3===2)?'filled':''}" aria-hidden="true"></i>`).join('')}</span><span class="shape-orientation">${label} 3以上</span></span>`;
}
function art(view: RewardCardView): string {
 const power=view.powerTier?`<span class="reward-power-emblem">${rewardIconHtml(view.icon)}<span class="reward-tier-chain" role="img" aria-label="${view.powerTier}個の連結箱、${view.powerTier===5?'5以上':view.powerTier}リンク強化">${Array.from({length:view.powerTier},()=>'<i aria-hidden="true"></i>').join('')}<b>${view.powerTier===5?'5+':view.powerTier}</b></span></span>`:null;
 return `<span class="reward-art">${view.pattern?rewardShapeHtml(view.pattern):view.linkDirection?linkDiagramHtml(view.linkDirection):power??rewardIconHtml(view.icon)}</span>`;
}
function comparisonHtml(view: RewardCardView): string { return `<dl class="reward-deltas">${view.comparison.map(row=>`<div><dt>${esc(row.label)}</dt><dd><span>${esc(row.before)}</span><i aria-label="から">→</i><strong>${esc(row.after)}</strong></dd></div>`).join('')}</dl>`; }
function loadoutHtml(state:BattleState,selected:RewardCardView|null,ui:RewardPresentationState):string {
  const replacing=ui.replacing;
  const slots=[state.build!.fixed,...state.build!.slots].map((s,i)=>{
    const chosen=replacing&&ui.replacementSlot===i-1&&i>0;
    const label=i===0?'◆ 固定':chosen?'もう一度で入替':replacing?`自由 ${i} を外す`:`自由 ${i}`;
    const content=`<small>${label}</small><strong>${s?esc(skillName(s.id,s.rank)):'空き'}</strong>${s&&selected?.id===s.id?'<b>→ ＋</b>':''}`;
    if(replacing&&i>0&&s)return `<button type="button" class="loadout-slot replacement-option${ui.replacementSlot===i-1?' is-selected':''}" data-replace-preview="${i-1}" data-reward-repeat="${chosen}" data-replace-token="${esc(rewardSlotToken(state.build!,i-1)!)}" aria-pressed="${ui.replacementSlot===i-1}" aria-label="${esc(`自由${i}の${skillName(s.id,s.rank)}${chosen?"を外して獲得します。もう一度タップ、またはEnterで確定。":"を外す候補に選ぶ。"}${skillDescription(s.id,s.rank,tuningOf(state.config))}`)}" ${ui.busy?'disabled':''}>${content}</button>`;
    return `<span class="loadout-slot${i===0?' is-fixed':''}${s&&selected?.id===s.id?' is-upgrading':''}">${content}</span>`;
  }).join('');
  return `<section class="reward-loadout${replacing?' has-replacement':''}" aria-label="${replacing?'外す自由枠を選択。固定枠は入れ替えられません':`現在の装備、固定1枠と自由${state.build!.slots.length}枠`}"><span class="loadout-caption">${replacing?'外す枠を選ぶ':'いまの装備'}</span><div>${slots}</div></section>`;
}
function categoryHtml(state:BattleState,busy:boolean):string {
  const r=tuningOf(state.config).rewards,hp=state.hp.player;
  const categories=[
    {id:'heal',tone:'pink',icon:'heart' as const,title:'今すぐ回復',value:`HP +${r.immediateHeal}`,copy:`${hp.current} → ${Math.min(hp.max,hp.current+r.immediateHeal)} / ${hp.max}`,hint:'押すと回復して次へ'},
    {id:'stats',tone:'mint',icon:'sword' as const,title:'ステータス',value:'ラン中ずっと',copy:'HP・リンク火力の3択',hint:'このカテゴリに決める'},
    {id:'skills',tone:'blue',icon:'bolt' as const,title:'スキル',value:'新しい組み方',copy:'スキルから最大3択',hint:'このカテゴリに決める'},
  ];
  return `<div class="reward-category-grid">${categories.map(c=>`<button type="button" class="reward-category pixel-card tone-${c.tone}" data-category="${c.id}" ${busy?'disabled':''}><span class="reward-art">${rewardIconHtml(c.icon)}</span><strong>${c.title}</strong><b>${c.value}</b><span>${c.copy}</span><small>${c.hint} <i aria-hidden="true">›</i></small></button>`).join('')}</div><p class="reward-category-warning">カテゴリは選ぶと確定。あとから変更できません</p>`;
}
/** 日本語: 戦闘・準備・ガチャで同じカード本体を使う。English: One card body across battle, preparation and gacha. */
export function rewardCardBody(view:RewardCardView,selected:boolean,label:string,instruction:string):string {
 return `<span class="reward-card-top"><span>${esc(label)}</span><span class="selection-mark" aria-hidden="true">${selected?'✓':'◇'}</span></span>${art(view)}<span class="reward-card-name">${esc(view.title)}</span><strong class="reward-card-metric">${esc(view.metric)}</strong><span class="reward-card-effect">${esc(view.effect)}</span><span class="reward-card-family">${esc(view.family)}</span>${instruction?`<span class="reward-card-footer">${esc(instruction)}</span>`:''}`;
}
function cardHtml(view:RewardCardView,selected:boolean,busy:boolean,index:number,replacing=false,armed=selected):string {
  const instruction=selected?(replacing?'外す枠を選ぶ':view.upgrade?'もう一度で＋強化':'もう一度で獲得'):'タップで比較';
  return `<button type="button" class="build-reward-card pixel-card tone-${view.tone}${selected?' is-selected':''}" data-reward-preview="${view.id}" data-reward-repeat="${armed}" aria-pressed="${selected}" aria-label="${esc(`${view.title}、${view.effect} ${view.metric}、${view.placement}。${instruction}。Enterでも操作できます`)}" ${busy?'disabled':''}>${rewardCardBody(view,selected,view.upgrade?'PLUS UPGRADE':String(index+1).padStart(2,'0'),instruction)}</button>`;
}
function replacementHtml(state:BattleState,view:RewardCardView,ui:RewardPresentationState):string {
  const old=ui.replacementSlot===null?null:state.build!.slots[ui.replacementSlot];
  return `<section class="reward-replacement tone-${view.tone}" aria-labelledby="replacement-title"><div class="replacement-heading"><h3 id="replacement-title">${old?`${esc(skillName(old.id,old.rank))} → ${esc(view.title)}`:'上の自由枠から、外すスキルを選ぶ'}</h3><button type="button" class="replacement-cancel" data-replace-cancel="true" ${ui.busy?'disabled':''}>戻る</button></div><div class="replacement-comparison"><p><b>獲得 ${esc(view.title)}</b><span>${esc(view.detail)}</span></p><p><b>${old?`外す ${esc(skillName(old.id,old.rank))}`:'固定枠は入れ替えられません'}</b><span>${old?esc(skillDescription(old.id,old.rank,tuningOf(state.config))):'カード・自由枠の選択だけでは確定しません'}</span></p></div></section>`;
}
export function rewardPanelHtml(state:BattleState,offer:RewardOffer,ui:RewardPresentationState):string {
  if(!state.build)return '';
  const pending=offer.category==='pending',selectedId=!pending&&ui.selected&&offer.choices.includes(ui.selected)&&(!isSkillReward(ui.selected)||canReceiveSkillReward(state.build,ui.selected))?ui.selected:null;
  const selected=selectedId?rewardCardView(state,selectedId):null;
  const validSlot=currentRewardReplacement(state.build,ui);
  const replace=!!selected&&requiresReplacement(state.build,selected.id);
  const replacing=replace;
  const safeUi={...ui,replacing,replacementSlot:validSlot?ui.replacementSlot:null};
  const title=pending?'次の勝ち方を、選ぼう':offer.category==='stats'?'ひとつ、強くなる': 'ビルドを、進化させよう';
  const disabled=!!ui.busy||!selected||ui.replacing!==replace||(replacing&&!validSlot);
  const instruction=!selected?'カードを選んで効果を確認':replacing?(validSlot?'選んだ枠をもう一度タップで入替':'外す自由枠を選んで比較'):'同じカードをもう一度タップで確定';
  const html = `<div class="build-reward-shell${pending?' is-category':''}${replacing?' is-replacing':''}"><header class="build-reward-header"><div><p class="reward-eyebrow">${ui.stage?`${stageLabel(ui.stage,true)} CLEAR`:'BATTLE CLEAR'}<span> / BUILD</span></p><h2 id="reward-title">${title}</h2></div><div class="reward-hp"><small>いまのHP</small><strong>${state.hp.player.current}<span> / ${state.hp.player.max}</span></strong></div></header><div class="reward-stage-cue" data-reward-stage-cue></div><div class="reward-step"><span class="${pending?'active':'done'}">01 <b>カテゴリ確定</b></span><i></i><span class="${!pending?'active':''}">02 <b>比較 → 獲得</b></span></div>${loadoutHtml(state,selected,safeUi)}${pending?categoryHtml(state,!!ui.busy):`<p id="reward-note" class="reward-help">${offer.category==='stats'?'ステータス':'スキル'}の候補は確定済み · 選択 → 同じ場所でもう一度</p><div class="build-reward-grid" aria-label="報酬候補、1つ選んで比較">${offer.choices.length?offer.choices.map((id,i)=>cardHtml(rewardCardView(state,id),selectedId===id,!!ui.busy,i,replacing,selectedId===id&&!disabled)).join(''):'<p class="reward-empty">取得できる候補がありません。次へ進めます。</p>'}</div><div class="reward-preview-area" aria-live="polite">${replacing&&selected?replacementHtml(state,selected,safeUi):selected?`<section class="reward-selected-detail tone-${selected.tone}"><div class="reward-detail-title"><span>${selected.upgrade?'＋強化の比較':'習得後の変化'}</span><strong>${esc(selected.placement)}</strong></div>${comparisonHtml(selected)}<p class="reward-detail-copy">${esc(selected.detail)}</p></section>`:'<div class="reward-unselected"><span aria-hidden="true">↑</span><p>気になるカードをタップ<br><small>効果と装備先を見てから決められます</small></p></div>'}</div><footer class="reward-decision"><p class="reward-inplace-hint" aria-live="polite">${instruction}</p><button type="button" id="skip-reward" class="reward-skip" data-reward-skip="true" ${ui.busy?'disabled':''}>取らずに次へ</button></footer><p class="reward-commit-note">${replacing?'別の枠は選択変更だけ · 戻っても候補は変わりません':'別のカードは選択変更だけ · ゆっくり読んでから決められます'}</p>`}</div>`;
  return html.replaceAll('<button type="button"', `<button type="button" data-offer-id="${esc(offer.id)}" data-offer-category="${esc(offer.category??'mixed')}" data-reward-selection="${esc(rewardSelectionToken(ui))}"`);
}

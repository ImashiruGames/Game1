import type {BattleState,NormalSkillId} from '../core/types.ts';
import {skillCatalog,skillName,skillDescription} from '../core/skillCatalog.ts';
import {instantSlots} from '../core/playerBuild.ts';
import {tuningOf} from '../core/tuning.ts';
import {rewardCardBody,rewardCardView,rewardShapeHtml,rewardIconHtml} from './rewardPresentation.ts';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
/** 日本語: 形とリンク数だけの定幅カード。条件付きリンクも最低成立数を表示し、詳細で条件を読む。
 * English: Fixed-size silhouettes show the shape or minimum link length; details retain exact conditions. */
export function skillMiniArt(id:NormalSkillId):string {
 const definition=skillCatalog[id];
 if(definition.pattern)return rewardShapeHtml(definition.pattern);
 if(definition.kind==='link')return `<span class="skill-link-number" aria-hidden="true">${id==='heavy-swing'||id==='snake-line'?'5+':id==='exact-four'?'4':'3+'}</span>`;
 return rewardIconHtml(id==='healing-potion'||id==='solvent'?'potion':id==='charge'||id==='capacitor'||id==='magic-bullet'?'bolt':id==='poison-craft'?'shape':'shield');
}
export function skillHudHtml(s:BattleState,available:boolean):string {
 const build=s.build;if(!build)return '';
 return '<span class="skill-hud-label">所持スキル｜</span><div class="skill-hud-cards">'+[build.fixed,...build.slots].map((skill,i)=>{
  if(!skill)return `<span class="hud-skill is-empty" aria-label="自由${i}空き">＋</span>`;
  const title=esc(skillDescription(skill.id,skill.rank,tuningOf(s.config))),name=esc(skillName(skill.id,skill.rank)),consumable=i>0&&skill.uses!==null;
  return `<button type="button" class="hud-skill${i===0?' is-fixed':''}${consumable?' is-consumable':''}" data-skill-info="${i}" title="${name}：${title}${consumable?`・残り${skill.uses}回`:''}" aria-label="${name}・効果を見る${i===0?'・固有スキル':''}${consumable?`・残り${skill.uses}回`:''}" ${!available?'disabled':''}>${skillMiniArt(skill.id)}${skill.rank===2?'<span class="skill-rank" aria-hidden="true">＋</span>':''}${consumable?`<span class="skill-uses" aria-hidden="true">${skill.uses}</span>`:''}</button>`;
 }).join('')+'</div>';
}
/** 日本語: 報酬と同じカード部品で、強化候補ではなく今所持するランクを表示する。
 * English: Reuse the reward card body, showing the owned rank rather than its next upgrade. */
export function skillInfoHtml(s:BattleState,index:number):string|null {
 if(!Number.isSafeInteger(index)||index<0||!s.build)return null;
 const skill=[s.build.fixed,...s.build.slots][index];if(!skill)return null;
 const view=rewardCardView(s,skill.id,true,skill.rank),description=skillDescription(skill.id,skill.rank,tuningOf(s.config));
 const family={shape:'形スキル',link:'リンクスキル',passive:'パッシブ',instant:'即時発動'}[skillCatalog[skill.id].kind];
 const usable=index>0&&instantSlots(s).includes(index-1);
 return `<div class="dialog-top"><h2 id="skill-info-title">${esc(skillName(skill.id,skill.rank))}</h2><button type="button" class="dialog-close-icon" data-close="skill-info" aria-label="閉じる">×</button></div><article class="build-reward-card pixel-card tone-${view.tone} owned-skill-card">${rewardCardBody({...view,title:skillName(skill.id,skill.rank),family,effect:description},false,index===0?'◆ 固有スキル':'装備中',skill.uses!==null?`残り${skill.uses}回`:'')}</article>${skill.uses!==null?`<button type="button" class="skill-use-button" data-instant="${index-1}" ${!usable?'disabled':''}>${esc(skillName(skill.id,skill.rank))}を使う</button>`:''}`;
}

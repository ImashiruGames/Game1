import {createBattle} from '../core/battle.ts';
import {defaultConfig} from '../core/definitions.ts';
import {createSkill} from '../core/playerBuild.ts';
import {rewardCardBody,rewardCardView} from '../ui/rewardPresentation.ts';
import {skillCatalog,skillDescription} from '../core/skillCatalog.ts';
import type {NormalSkillId} from '../core/types.ts';
import {META,eligibleSkills} from './profile.ts';
import type {Profile} from './profile.ts';
import {roster} from './roster.ts';
import type {RosterId} from './roster.ts';
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
// 日本語: 旧保存は読むだけで変更しない。新しい準備操作だけで外された固有候補を戻す。
// English: Read legacy saves unchanged; repair an omitted starter only in new preparation snapshots.
export function preparationPool(p:Profile,id:RosterId):NormalSkillId[]{
 const pool=p.characters[id].pool,starter=roster[id].starter;
 return eligibleSkills(p,id).includes(starter)&&!pool.includes(starter)?[starter,...pool.slice(0,META.poolMax-1)]:[...pool];
}
export function togglePreparationSkill(p:Profile,id:RosterId,skill:NormalSkillId):Profile {
 if(!p.ownedCharacters.includes(id)||!eligibleSkills(p,id).includes(skill)||roster[id].starter===skill)return p;
 const pool=preparationPool(p,id),has=pool.includes(skill);
 if(has&&pool.length<=META.poolMin)throw new Error('最小6種類です。先に別のスキルをONにしてください');
 if(!has&&pool.length>=META.poolMax)throw new Error('最大20種類です。先に別のスキルをOFFにしてください');
 p.characters[id].pool=has?pool.filter(s=>s!==skill):[...pool,skill];return p;
}
export function preparationSkillCard(id:NormalSkillId,options:{selected?:boolean;fixed?:boolean;interactive?:boolean;disabled?:boolean;index?:number}={}):string {
 const state=createBattle({...defaultConfig,characterId:'blue',initialBuild:{fixed:createSkill('health'),slots:[null,null],power:{3:0,4:0,5:0}}});
 const view=rewardCardView(state,id,true),selected=!!options.selected,fixed=!!options.fixed;
 const family={shape:'形スキル',link:'リンクスキル',passive:'パッシブ',instant:'即時発動'}[skillCatalog[id].kind];
 const footer=fixed?'固有 · 常に装備':options.interactive?selected?'ON · タップでOFF':'OFF · タップでON':'';
 const tag=options.interactive&&!fixed?'button':'article';
 return `<${tag} class="build-reward-card pixel-card tone-${view.tone}${selected?' is-selected':''}${fixed?' is-fixed-skill':''}" ${tag==='button'?`type="button" data-pool="${id}" aria-pressed="${selected}" ${options.disabled?'disabled':''}`:''} aria-label="${esc(view.title+'。'+skillDescription(id,1)+'。'+footer)}" title="${esc(skillDescription(id,1))}">${rewardCardBody({...view,family,effect:skillDescription(id,1)},selected,fixed?'◆ 固有スキル':String((options.index??0)+1).padStart(2,'0'),footer)}</${tag}>`;
}
export function treeDots(rank:number,cap:number,pulse=false):string{return `<span class="tree-dots" role="img" aria-label="${cap}段階中${rank}段階強化済み">${Array.from({length:cap},(_,i)=>`<i class="${i<rank?'lit':''}${pulse&&i===rank-1?' pulse':''}" aria-hidden="true"></i>`).join('')}</span>`;}

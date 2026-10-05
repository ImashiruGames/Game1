import {characterTrophySkillIds} from '../core/skillCatalog.ts';
import type {NormalSkillId} from '../core/types.ts';
import {roster,rosterIds} from './roster.ts';
export const characterTrophySkills=characterTrophySkillIds;
export const trophyDefinitions:readonly {id:string;name:string;condition:string;skill?:NormalSkillId}[]=[
 {id:'clear50:first',name:'はじめての50階クリア',condition:'正式ランを1階から50階までクリア'},
 {id:'damage100:turn',name:'一手番の猛攻',condition:'1回の自手番中に敵HPを実際に100以上減らす（敵手番の毒・過剰ダメージは除外）',skill:'heavy-swing'},
 {id:'maxhp100:run',name:'大きな生命力',condition:'正式ラン中の最大HPが100以上に到達',skill:'rescue-kit'},
 ...rosterIds.map(id=>({id:`clear50:${id}`,name:`${roster[id].name}で50階クリア`,condition:'このキャラで正式ランを1階から50階までクリア',skill:characterTrophySkills[id]})),
];
/** 日本語: 記録済み実績だけが所持権を与える。装備や出発済みプールは変更しない。
 * English: Recorded trophies grant ownership exactly once; never equip or rewrite a frozen pool. */
export function missingTrophySkills(p:{trophies:Record<string,number>;ownedSkills:readonly NormalSkillId[]}):NormalSkillId[]{return trophyDefinitions.flatMap(t=>t.skill&&Object.hasOwn(p.trophies,t.id)&&!p.ownedSkills.includes(t.skill)?[t.skill]:[]);}

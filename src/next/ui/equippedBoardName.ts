import {getPlayerSkills} from '../core/skills.ts';
import type {BattleConfig} from '../core/types.ts';
import {boardSkillName} from './kitInformation.ts';
// 日本語: 使用可否は手番や演出で変わるが、装備名は変えない。未装備を別スキルで補わない。
// English: Availability changes with turns and animations; equipped identity does not. Never substitute another skill for an empty loadout.
export function equippedBoardName(config:BattleConfig):string {
 const id=getPlayerSkills(config).boardSkills[0];
 return id?boardSkillName(id,config):'盤面スキル';
}

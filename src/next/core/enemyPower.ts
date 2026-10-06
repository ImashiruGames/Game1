import type {BattleState} from './types.ts';
import {deepTraits,hinobouRage} from './monsterBehavior.ts';

/** 日本語: 火力上昇を見落とさないよう、攻撃とHUDが同じ現在値を読む。箱の輝き・凍結と防御は後で適用。
 * English: Share current link power with the HUD so boosts stay visible; box modifiers and defenses apply later. */
export function enemyLinkPower(state:BattleState,tier:3|4|5):number {
 return state.config.combatants.enemy.attacks[tier]+(hinobouRage(state)?deepTraits.hinobouRageBonus:0);
}

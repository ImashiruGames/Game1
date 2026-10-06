import type { BattleState } from '../core/types.ts';
import {enemyLinkPower} from '../core/enemyPower.ts';
import {getEnemyDefinition} from '../core/monsters.ts';
import {tuningOf} from '../core/tuning.ts';

const tiers = [3, 4, 5] as const;
export interface EnemyPowerView {
  readonly tiers: readonly { readonly tier: 3 | 4 | 5; readonly label: string; readonly damage: number; readonly increase: number; readonly emphasized: boolean }[];
  readonly warning: string;
  readonly boost: string;
}

/** Read the current encounter table, including saved or scaled values, never base roster stats. */
export function enemyPowerView(state: BattleState): EnemyPowerView {
  const attacks = state.config.combatants.enemy.attacks;
  const sharp = state.config.enemyId === 'hikikizan' && attacks[4] > attacks[3];
  // 日本語: ヒノボウ専用表示にせず、実戦の現在値と同じ設定の通常値を比較。強化中だけ増加分を追加する。
  // English: Compare live power with ordinary stats under the same tuning, for every enemy; only boosts add a label.
  const ordinary=state.config.enemyId?getEnemyDefinition(state.config.enemyId,tuningOf(state.config)).attacks:attacks;
  const values=tiers.map(tier=>{const damage=enemyLinkPower(state,tier);return {tier,label:tier===5?'5+':String(tier),damage,increase:Math.max(0,damage-ordinary[tier]),emphasized:sharp&&tier>=4};});
  const deltas=values.map(value=>value.increase),boost=deltas.some(n=>n>0)?(new Set(deltas).size===1?`火力↑ ＋${deltas[0]}`:`↑${deltas.join('/')}`):'';
  return {tiers:values,warning:sharp?'4連から高火力':'',boost};
}

export function enemyPowerHudHtml(state: BattleState): string {
  const view = enemyPowerView(state);
  return `<span class="enemy-power-values" aria-label="敵の現在のリンク火力">${view.tiers.map(value => `<span${value.increase>0 ? ' class="enemy-power-boosted"' : value.emphasized ? ' class="enemy-power-sharp"' : ''}>${value.label}:<b>${value.damage}</b></span>`).join('')}</span>${view.boost?`<span class="enemy-power-note enemy-power-boost">${view.boost}</span>`:view.warning ? '<span class="enemy-power-note">4連〜注意</span>' : ''}`;
}

export function enemyPowerDetailsHtml(state: BattleState): string {
  const view = enemyPowerView(state);
  return `<section class="skill-card enemy-power-details"><h3>今回の敵火力</h3><table><caption>リンク1軸ごとの現在火力</caption><thead><tr><th scope="col">3連</th><th scope="col">4連</th><th scope="col">5連以上</th></tr></thead><tbody><tr>${view.tiers.map(value => `<td${value.increase>0 ? ' class="enemy-power-boosted"' : value.emphasized ? ' class="enemy-power-sharp"' : ''}>${value.damage}${value.increase>0?`<small>通常比 ＋${value.increase}</small>`:''}</td>`).join('')}</tr></tbody></table>${view.warning ? `<p class="enemy-power-warning">⚠ ヒキキザンは4連で${view.tiers[1]!.damage}／5連以上で${view.tiers[2]!.damage}。敵箱の長い列に注意。</p>` : ''}<p>同じ投入で複数の軸が成立すると各軸を1つずつ攻撃します。輝き・凍結など箱の補正や初撃ガード・防御の軽減は別途適用します。ボスの固定ダメージ・回復はこの表に含みません。</p><p>いま戦っている敵の値です。HP条件や周回などの補正も含みます。増加分は同じ設定の通常火力との差です。</p></section>`;
}

/** The whole compact row opens the existing Details dialog; no new game action. */
export function renderEnemyPower(host: HTMLElement, state: BattleState): void {
  let meter = host.querySelector<HTMLButtonElement>('.enemy-power-meter');
  if (!meter) {
    meter = host.ownerDocument.createElement('button');
    meter.type = 'button'; meter.className = 'enemy-power-meter';
    meter.dataset.details = 'true'; meter.setAttribute('aria-haspopup', 'dialog'); meter.setAttribute('aria-controls', 'details');
    host.append(meter);
  }
  const view = enemyPowerView(state);
  meter.innerHTML = enemyPowerHudHtml(state);
  meter.setAttribute('aria-label', `敵の現在のリンク火力 ${view.tiers.map(value => `${value.label}連${value.damage}${value.increase>0?`、通常比プラス${value.increase}`:''}`).join('、')}。${view.warning}。詳細を開く`);
  meter.title = `敵リンク1軸の現在火力。${view.boost}。${view.warning}。タップで詳細`;
}

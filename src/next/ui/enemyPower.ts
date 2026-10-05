import type { BattleState } from '../core/types.ts';

const tiers = [3, 4, 5] as const;
export interface EnemyPowerView {
  readonly tiers: readonly { readonly tier: 3 | 4 | 5; readonly label: string; readonly damage: number; readonly emphasized: boolean }[];
  readonly warning: string;
}

/** Read the current encounter table, including saved or scaled values, never base roster stats. */
export function enemyPowerView(state: BattleState): EnemyPowerView {
  const attacks = state.config.combatants.enemy.attacks;
  const sharp = state.config.enemyId === 'hikikizan' && attacks[4] > attacks[3];
  return {
    tiers: tiers.map(tier => ({ tier, label: tier === 5 ? '5+' : String(tier), damage: attacks[tier], emphasized: sharp && tier >= 4 })),
    warning: sharp ? '4連から高火力' : '',
  };
}

export function enemyPowerHudHtml(state: BattleState): string {
  const view = enemyPowerView(state);
  return `<span class="enemy-power-values" aria-label="敵の基本火力">${view.tiers.map(value => `<span${value.emphasized ? ' class="enemy-power-sharp"' : ''}>${value.label}:<b>${value.damage}</b></span>`).join('')}</span>${view.warning ? '<span class="enemy-power-note">4連〜注意</span>' : ''}`;
}

export function enemyPowerDetailsHtml(state: BattleState): string {
  const view = enemyPowerView(state);
  return `<section class="skill-card enemy-power-details"><h3>今回の敵火力</h3><table><caption>リンク1軸ごとの基本ダメージ</caption><thead><tr><th scope="col">3連</th><th scope="col">4連</th><th scope="col">5連以上</th></tr></thead><tbody><tr>${view.tiers.map(value => `<td${value.emphasized ? ' class="enemy-power-sharp"' : ''}>${value.damage}</td>`).join('')}</tr></tbody></table>${view.warning ? `<p class="enemy-power-warning">⚠ ヒキキザンは4連で${view.tiers[1]!.damage}、5連以上で${view.tiers[2]!.damage}。敵箱の長い列に注意。</p>` : ''}<p>同じ投入で複数の軸が成立すると、各軸を1つずつ攻撃します。初撃ガードの軽減などは別途適用します。ボスの固定ダメージ・回復はこの表に含みません。</p><p>いま戦っている敵の値です。周回などの補正がある場合も、補正後の火力を表示します。</p></section>`;
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
  meter.setAttribute('aria-label', `敵の基本火力 ${view.tiers.map(value => `${value.label}連${value.damage}`).join('、')}。${view.warning}。詳細を開く`);
  meter.title = `敵リンク1軸の基本ダメージ。${view.warning}。タップで詳細`;
}

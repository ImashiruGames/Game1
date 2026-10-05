import { activeSkillValue, playerPower, skillRank } from '../core/playerBuild.ts';
import { tuningOf } from '../core/tuning.ts';
import type { BattleState } from '../core/types.ts';

const tiers = [3, 4, 5] as const;
export interface PowerTier {
  readonly tier: 3 | 4 | 5;
  readonly label: string;
  readonly base: number;
  readonly permanent: number;
  readonly growth: number;
  readonly current: number;
}
export interface PlayerPowerView {
  readonly tiers: readonly PowerTier[];
  readonly growth: number;
  readonly grow: { readonly bonus: number; readonly damage: number; readonly growthPerActivation: number } | null;
  readonly warning: string;
}

/** Presentation reads the existing formula; it never makes the tiers monotonic. */
export function playerPowerView(state: BattleState): PlayerPowerView {
  const values = tiers.map(tier => ({ tier, label: tier === 5 ? '5+' : String(tier), base: state.config.combatants.player.attacks[tier], permanent: state.build?.power[tier] ?? 0, growth: tier === 3 ? state.link3Growth : 0, current: playerPower(state, tier) }));
  const descending = values.slice(0, -1).flatMap((value, i) => value.current > values[i + 1]!.current ? [`${value.label}連 > ${values[i + 1]!.label}連`] : []);
  const bonus = activeSkillValue(state, 'grow-fire');
  return {
    tiers: values, growth: state.link3Growth,
    grow: skillRank(state, 'grow-fire') ? { bonus, damage: playerPower(state, 3) + bonus, growthPerActivation: tuningOf(state.config).links.growFireGrowth } : null,
    warning: descending.length ? `${descending.join('・')}：長くしても火力が上がらない場合があります` : '',
  };
}

export function playerPowerHudHtml(state: BattleState): string {
  const view = playerPowerView(state);
  return `<span class="power-values" aria-label="現在の基本火力">${view.tiers.map(value => `<span>${value.label}:<b>${value.current}</b></span>`).join('')}</span>${view.grow || view.growth > 0 || view.warning ? `<span class="power-growth">${view.grow || view.growth > 0 ? `火+${view.growth}` : ''}${view.warning ? ' ⚠' : ''}</span>` : ''}`;
}

export function playerPowerDetailsHtml(state: BattleState): string {
  const view = playerPowerView(state);
  return `<section class="skill-card power-details"><h3>自分の現在火力</h3><p>通常の各軸で使う基本火力。横・斜めのスキルや変化の加算・倍率、輝き・フローズン、敵の軽減は別途適用します。</p><dl>${view.tiers.map(value => `<div><dt>${value.label}連</dt><dd>${value.current} <small>＝ 基礎${value.base} ＋ 永続${value.permanent} ＋ 戦闘成長${value.growth}</small></dd></div>`).join('')}</dl>${view.warning ? `<p class="power-warning">⚠ ${view.warning}。火力の式はそのままです。</p>` : ''}<p>永続強化はこのラン中、成長する火で得た成長はこの戦闘中だけ有効です。次の戦闘で成長は0に戻ります。</p>${view.grow ? `<p>成長する火：縦3個以上は、箱数が4・5以上でも「現在の3連火力 ${view.tiers[0]!.current} ＋ スキル${view.grow.bonus} ＝ ${view.grow.damage}」を倍率・タイプ補正前の火力として使います。通常の4連・5+連火力への上乗せではありません。攻撃後に戦闘成長＋${view.grow.growthPerActivation}。今回の成長は次の攻撃から反映されます。</p>` : '<p>成長する火は未装備です。</p>'}</section>`;
}

export function renderPlayerPower(host: HTMLElement, state: BattleState): void {
  let meter = host.querySelector<HTMLElement>('.player-power-meter');
  if (!meter) { meter = host.ownerDocument.createElement('div'); meter.className = 'player-power-meter'; host.append(meter); }
  const view = playerPowerView(state);
  meter.innerHTML = playerPowerHudHtml(state);
  meter.title = `3/4/5+連の基本火力。永続＝このランの強化、火＝この戦闘の3連成長。${view.warning}`;
  meter.setAttribute('aria-label', `基本火力 ${view.tiers.map(value => `${value.label}連${value.current}`).join('、')}。永続強化 ${view.tiers.map(value => `${value.label}連プラス${value.permanent}`).join('、')}。戦闘成長プラス${view.growth}。${view.warning}`);
}

import {skillCatalog} from '../core/skillCatalog.ts';
import {kitBoardCatalog} from '../core/kitBoards.ts';
import type {NormalSkillId,BoardSkillId} from '../core/types.ts';
/** 日本語: 確定イベントから読む表示履歴。戦闘処理や保存内容は変更しない。 */
import type { Actor, Axis, BattleEvent, Box, Resolution } from '../core/types.ts';

export interface RecentDrop { readonly boxId: string; readonly actor: Actor }
export interface RecentDropView extends RecentDrop { readonly row: number; readonly col: number; readonly label: string }

/** Presentation-only history. An owner conversion does not change who inserted the box. */
export function observeRecentDrop(current: RecentDrop | null, event: BattleEvent): RecentDrop | null {
  if (event.type === 'drop') return { boxId: event.box.id, actor: event.actor };
  if (event.type === 'row-cleared' && current && event.boxIds.includes(current.boxId)) return null;
  return current;
}
/** Missing IDs are forgotten instead of moving the marker to a different box at the old cell. */
export function retainRecentDrop(current: RecentDrop | null, boxes: readonly Box[]): RecentDrop | null {
  return current && boxes.some(box => box.id === current.boxId) ? current : null;
}
export function recentDropView(current: RecentDrop | null, boxes: readonly Box[]): RecentDropView | null {
  const box = current && boxes.find(box => box.id === current.boxId);
  return current && box ? { ...current, row: box.row, col: box.col, label: `直近の投入：${current.actor === 'player' ? '自分' : '敵'}` } : null;
}
export function recentDropLegendHtml(): string {
  return '<p class="recent-drop-note">下角の印＝直近の投入（黄◆ 自分 / 紫■ 敵）。印は投入した側。丸いコア＝現在の自箱／菱形＝敵箱／四角＝中立箱です。白い角枠は次戦への持越し候補です。</p>';
}
const recentAria = / · 直近の投入：(自分|敵)/g;
/** A separate static lower-left pixel, leaving carry corners, targets and hit outlines intact. */
export function renderRecentDrop(board: HTMLElement, current: RecentDrop | null, boxes: readonly Box[]): void {
  for (const cell of board.querySelectorAll<HTMLElement>('[data-recent-drop]')) {
    cell.removeAttribute('data-recent-drop');
    cell.setAttribute('aria-label', (cell.getAttribute('aria-label') ?? '').replace(recentAria, ''));
  }
  const view = recentDropView(current, boxes);
  if (!view) return;
  const cell = board.querySelector<HTMLElement>(`[data-cell-row="${view.row}"][data-cell-col="${view.col}"]`);
  if (!cell) return;
  cell.setAttribute('data-recent-drop', view.actor);
  cell.setAttribute('aria-label', `${(cell.getAttribute('aria-label') ?? '').replace(recentAria, '')} · ${view.label}`);
}

export type ContributionKind = 'axis' | 'shape' | 'reflection' | 'board' | 'item' | 'fixed' | 'fallback' | 'heal';
export interface DamageContribution {
  readonly kind: Exclude<ContributionKind, 'heal'>;
  readonly label: string;
  readonly target: Actor;
  readonly axis?: Axis;
  readonly count: number;
  readonly damage: number;
  readonly actual: number;
  readonly overkill: number;
}
export interface HealContribution {
  readonly kind: 'heal';
  readonly label: string;
  readonly target: Actor;
  readonly count: number;
  readonly actual: number;
  readonly nominal: number;
  readonly capped: number;
}
export interface ActionBreakdown {
  readonly actor: Actor;
  readonly turn: number;
  readonly label: string;
  readonly rows: readonly (DamageContribution | HealContribution)[];
  readonly lost: Readonly<Record<Actor, number>>;
  readonly healed: Readonly<Record<Actor, number>>;
}
const axes: Readonly<Record<Axis, string>> = { vertical: '縦', horizontal: '横', 'diagonal-down': '右下斜め', 'diagonal-up': '右上斜め' };
const sources: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.values(skillCatalog).map(s=>[s.id,s.name])),
  ...Object.fromEntries(Object.values(kitBoardCatalog).map(s=>[s.id,s.name])),
  health: 'ヘルス', 'corner-strike': '角打ち', 'square-strike': '四角打ち',
  poison:'どく・手番終了',thorn:'トゲ・能動投入','blue-transformation': '青の反射', ember: '火種・自己コスト', 'pain-shared': '列消去',
  'healing-potion': '回復ポーション', 'magic-bullet': '魔法弾', 'boss-fixed': 'ボス固定攻撃',
  nigirin: '敵の回復', 'enemy-pattern': '敵の回復',
};
function damageKind(source: string): Exclude<ContributionKind, 'axis' | 'heal' | 'fallback'> {
  if (source === 'blue-transformation') return 'reflection';
  if (skillCatalog[source as NormalSkillId]?.kind==='shape') return 'shape';
  if (source === 'ember' || source === 'pain-shared'||kitBoardCatalog[source as BoardSkillId]) return 'board';
  if (source === 'poison'||source==='thorn'||source === 'boss-fixed') return 'fixed';
  return 'item';
}
function actionLabel(events: readonly BattleEvent[]): string {
  if (events.some(event => event.type === 'board-skill')) return '盤面スキル';
  if (events.some(event => event.type === 'instant-skill')) return '使い切りスキル';
  if (events.some(event => event.type === 'turn-start')) return events.some(event => event.type === 'drop') ? '手番開始の追加投入' : '手番開始';
  if (events.some(event => event.type === 'drop')) return '投入';
  if (events.some(event => event.type === 'enemy-box-changed'&&event.boxType==='poison')) return 'どく付与';
  if (events.some(event => event.type === 'enemy-box-changed'&&event.boxType==='absolute-zero')) return '絶対零度';
  if (events.some(event => event.type === 'enemy-box-changed'&&event.boxType==='neutral')) return '中立化';
  if (events.some(event => event.type === 'drop'&&event.box.owner==='neutral'&&event.box.type==='rubble')) return 'ガレキ落下';
  if (events.some(event => event.type === 'enemy-box-changed')) return '凍結';
  if (events.some(event => event.type === 'enemy-wait')) return '待機';
  if (events.some(event => event.type === 'transformation')) return '変化';
  if (events.some(event => event.type === 'heal')) return '回復';
  return '行動';
}
/**
 * Read only accepted, committed resolution.events. No previews, shape matching, damage formula,
 * RNG or core transition is called. HP below zero is excluded from actual loss; heal nominal
 * amount and Blue reflection stay independent, including full-HP zero-heal activations.
 */
export function actionBreakdown(resolution: Resolution, turn: number): ActionBreakdown {
  const rows: (DamageContribution | HealContribution)[] = [];
  const lost = { player: 0, enemy: 0 }, healed = { player: 0, enemy: 0 };
  for (const event of resolution.events) {
    if (event.type === 'heal') {
      const actual = event.amount, nominal = event.requestedAmount;
      const label = `${sources[event.source] ?? event.source}${(event.source === 'health' || event.source === 'rescue-kit') ? '・形' : ''}`;
      const index = rows.findIndex(row => row.kind === 'heal' && row.target === event.target && row.label === label);
      const old = rows[index];
      const row: HealContribution = { kind: 'heal', label, target: event.target, count: 1, actual, nominal, capped: Math.max(0, nominal - actual) };
      rows[index < 0 ? rows.length : index] = old?.kind === 'heal' ? { ...row, count: old.count + 1, actual: old.actual + actual, nominal: old.nominal + nominal, capped: old.capped + row.capped } : row;
      healed[event.target] += actual;
    } else if (event.type === 'attack' || event.type === 'damage' || event.type === 'instant-kill'||event.type==='type-damage') {
      const actual = Math.max(0, Math.max(0, event.hpBefore) - Math.max(0, event.hpAfter));
      const overkill = event.type === 'attack' ? event.overkill : Math.max(0, event.damage - actual);
      const kind = event.type === 'attack' ? 'axis' : event.type === 'instant-kill' ? 'fallback' : damageKind(event.source);
      const label = event.type === 'attack' ? `${axes[event.axis]}軸` : event.type === 'instant-kill' ? '投入不能の代替攻撃' : `${sources[event.source] ?? event.source}${kind === 'shape' ? '・形' : ''}`;
      const index = rows.findIndex(row => row.kind === kind && row.target === event.target && row.label === label);
      const old = rows[index];
      const row: DamageContribution = { kind, label, target: event.target, ...(event.type === 'attack' ? { axis: event.axis } : {}), count: 1, damage: event.damage, actual, overkill };
      rows[index < 0 ? rows.length : index] = old && old.kind !== 'heal' ? { ...row, count: old.count + 1, damage: old.damage + event.damage, actual: old.actual + actual, overkill: old.overkill + overkill } : row;
      lost[event.target] += actual;
    }
  }
  return { actor: resolution.actor, turn, label: actionLabel(resolution.events), rows, lost, healed };
}
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const targetName = (target: Actor) => target === 'player' ? '自分' : '敵';
export function actionBreakdownHtml(view: ActionBreakdown | null, actor?: Actor): string {
  if (!view) return `<section class="skill-card action-breakdown"><h3>直前の1行動${actor ? ` · ${targetName(actor)}` : ''}</h3><p>未記録。この画面で次に解決した行動から表示します。</p></section>`;
  const rows = view.rows.map(row => `<li data-contribution="${row.kind}"><span>${escape(row.label)}${row.count > 1 ? ` ×${row.count}` : ''} → ${targetName(row.target)}</span><strong>${row.kind === 'heal' ? `実回復 ＋${row.actual}` : `実HP減少 −${row.actual}`}</strong><small>${row.kind === 'heal' ? `名目 ${row.nominal} / 上限で未回復 ${row.capped}` : `ダメージ値 ${row.damage} / 超過 ${row.overkill}`}</small></li>`).join('');
  return `<section class="skill-card action-breakdown"><h3>直前の1行動 · ${targetName(view.actor)}の${view.label}</h3><p>${view.turn}手目 · 実HP減少：敵 ${view.lost.enemy} / 自分 ${view.lost.player}${view.healed.player || view.healed.enemy ? ` · 実回復：自分 ${view.healed.player} / 敵 ${view.healed.enemy}` : ''}</p>${rows ? `<ul>${rows}</ul><p class="action-breakdown-note">軸・形・反射は別集計。超過は残りHPを上回った分です。名目回復は実回復と異なり青の反射にも使われます。</p>` : '<p>この行動のHP変化はありません。</p>'}</section>`;
}

export type LastActionBreakdowns = Readonly<Record<Actor, ActionBreakdown | null>>;
export function emptyActionBreakdowns(): LastActionBreakdowns { return { player: null, enemy: null }; }
/** Each actor retains one completed gameplay action, never a turn/run cumulative total.
 * Empty turn-start/gauge bookkeeping is not an action; an actual bonus/ordinary drop is,
 * including a zero-damage drop. Explicit wait/transform/skill actions still replace the record.
 */
export function recordActionBreakdown(previous: LastActionBreakdowns, resolution: Resolution, turn: number): LastActionBreakdowns {
  if (resolution.events.every(event => event.type === 'turn-start' || event.type === 'gauge')) return previous;
  return { ...previous, [resolution.actor]: actionBreakdown(resolution, turn) };
}
export function lastActionBreakdownsHtml(previous: LastActionBreakdowns): string {
  return '<div class="last-action-breakdowns"><p class="action-breakdowns-scope">自分・敵それぞれ最後の1行動だけです。累計ではありません。投入やHP効果のない開始処理は除き赤の追加投入は別の1行動として記録します。次の戦闘・再開始・保存からの再開では未記録に戻ります。</p>'
    + actionBreakdownHtml(previous.player, 'player') + actionBreakdownHtml(previous.enemy, 'enemy') + '</div>';
}

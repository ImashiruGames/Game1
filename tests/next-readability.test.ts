import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actionBreakdown, actionBreakdownHtml, emptyActionBreakdowns, recordActionBreakdown, lastActionBreakdownsHtml, observeRecentDrop, recentDropView, renderRecentDrop, retainRecentDrop, recentDropLegendHtml } from '../src/next/ui/battleReadability.ts';
import { consumableDetailsHtml, consumableUseView } from '../src/next/ui/consumableReadability.ts';
import { shapeFeedbackForEvent, shapeFeedbackHtml } from '../src/next/ui/shapeFeedback.ts';
import type { Actor, BattleEvent, Box, Link, Resolution, SkillInstance } from '../src/next/core/types.ts';
const box = (id: string, row = 7, col = 0, owner: Box['owner'] = 'player'): Box => ({ id, row, col, owner, type: 'normal', status: 'normal' });
const drop = (id: string, actor: Actor = 'player', row = 7, col = 0): BattleEvent => ({ type: 'drop', actor, box: box(id, row, col, actor), candidateId: `ceiling:${col}:0`, spawn: { row: 0, col }, landing: { row, col }, path: [] });
const resolution = (events: readonly BattleEvent[], actor: Actor = 'player', links: readonly Link[] = []): Resolution => ({ actor, originBoxId: null, links, enemyPlannedAction: null, events });
function deepFreeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
interface Trace { name: string; events: BattleEvent[]; links: Link[]; coreStateBefore: { boxes: Box[] }; coreStateAfter: { boxes: Box[] } }
const traces = deepFreeze((JSON.parse(readFileSync(new URL('./fixtures/readability-events.json', import.meta.url), 'utf8')) as { records: Trace[] }).records);

test('recent marker starts absent, follows only the latest drop ID and keeps insertion source after conversion', () => {
  let recent = observeRecentDrop(null, drop('a'));
  assert.deepEqual(recent, { boxId: 'a', actor: 'player' });
  assert.equal(recentDropView(null, [box('old')]), null);
  recent = observeRecentDrop(recent, drop('b', 'enemy', 6, 2));
  assert.deepEqual(recentDropView(recent, [box('a'), box('b', 5, 2, 'player')]), { boxId: 'b', actor: 'enemy', row: 5, col: 2, label: '直近の投入：敵' });
  assert.equal(observeRecentDrop(recent, { type: 'boxes-converted', actor: 'player', boxIds: ['b'], from: 'enemy', to: 'player' }), recent);
  assert.equal(retainRecentDrop(recent, [box('a'), box('different', 5, 2)]), null);
  assert.equal(observeRecentDrop(recent, { type: 'row-cleared', row: 5, boxIds: ['b'], playerCount: 1, enemyCount: 0, neutralCount: 0 }), null);
  assert.match(recentDropLegendHtml(), /白い角枠/);
});

test('repeated fake-DOM marker render preserves target/carry/hit state and removes only its own aria text', () => {
  const attrs = new Map<string, string>([['aria-label', '8行1列 自箱 · 次戦へ持越し候補']]);
  const classes = new Set(['cell', 'carry-candidate', 'row-target', 'hit']);
  const cell = { setAttribute: (k: string, v: string) => attrs.set(k, v), getAttribute: (k: string) => attrs.get(k) ?? null, removeAttribute: (k: string) => attrs.delete(k), classList: classes };
  let query = '';
  const board = { querySelectorAll: () => attrs.has('data-recent-drop') ? [cell] : [], querySelector: (value: string) => { query = value; return cell; } };
  const snapshot = deepFreeze([box('a')]);
  renderRecentDrop(board as unknown as HTMLElement, { boxId: 'a', actor: 'player' }, snapshot);
  renderRecentDrop(board as unknown as HTMLElement, { boxId: 'a', actor: 'player' }, snapshot);
  assert.equal(attrs.get('aria-label'), '8行1列 自箱 · 次戦へ持越し候補 · 直近の投入：自分');
  assert.equal(query, '[data-cell-row="7"][data-cell-col="0"]');
  assert.equal(attrs.get('data-recent-drop'), 'player');
  renderRecentDrop(board as unknown as HTMLElement, null, snapshot);
  assert.equal(attrs.has('data-recent-drop'), false);
  assert.equal(attrs.get('aria-label'), '8行1列 自箱 · 次戦へ持越し候補');
  assert.deepEqual([...classes], ['cell', 'carry-candidate', 'row-target', 'hit']);
});

test('recorded full-HP Blue event keeps zero actual healing, nominal15, reflection15 and horizontal4 separate', () => {
  const record = traces[0]!, input = resolution(record.events, 'player', record.links), before = JSON.stringify(input);
  const view = actionBreakdown(deepFreeze(input), 1);
  assert.deepEqual(view.rows.map(row => [row.kind, row.actual]), [['heal', 0], ['reflection', 15], ['axis', 4]]);
  const heal = view.rows[0]!; assert.equal(heal.kind, 'heal'); if (heal.kind === 'heal') { assert.equal(heal.nominal, 15); assert.equal(heal.capped, 15); }
  assert.deepEqual(view.lost, { player: 0, enemy: 19 }); assert.deepEqual(view.healed, { player: 0, enemy: 0 });
  const html = actionBreakdownHtml(view); assert.match(html, /実回復 ＋0/); assert.match(html, /名目 15 \/ 上限で未回復 15/); assert.match(html, /アオイの反射/); assert.match(html, /横軸/);
  assert.equal(JSON.stringify(input), before);
});

test('all archived real event traces remain unchanged and totals use only emitted HP events', () => {
  const before = JSON.stringify(traces);
  for (const record of traces) {
    const actor = record.events.find(event => event.type === 'drop')?.actor ?? 'player';
    const view = actionBreakdown(resolution(record.events, actor, record.links), 1);
    for (const target of ['player', 'enemy'] as const) {
      const loss = record.events.reduce((n, event) => n + ((event.type === 'damage' || event.type === 'attack' || event.type === 'instant-kill') && event.target === target ? Math.max(0, Math.max(0, event.hpBefore) - Math.max(0, event.hpAfter)) : 0), 0);
      assert.equal(view.lost[target], loss, record.name);
    }
  }
  assert.equal(JSON.stringify(traces), before);
});

test('one action groups repeated axes but keeps four axes distinct and never claims overkill as actual HP loss', () => {
  const events: BattleEvent[] = [
    { type: 'attack', actor: 'enemy', target: 'player', axis: 'vertical', linkCount: 3, tier: 3, damage: 3, hpBefore: 10, hpAfter: 7, overkill: 0 },
    { type: 'attack', actor: 'enemy', target: 'player', axis: 'horizontal', linkCount: 4, tier: 4, damage: 3, hpBefore: 7, hpAfter: 4, overkill: 0 },
    { type: 'attack', actor: 'enemy', target: 'player', axis: 'diagonal-down', linkCount: 5, tier: 5, damage: 5, hpBefore: 4, hpAfter: -1, overkill: 1 },
    { type: 'attack', actor: 'enemy', target: 'player', axis: 'diagonal-up', linkCount: 3, tier: 3, damage: 3, hpBefore: -1, hpAfter: -4, overkill: 3 },
    { type: 'attack', actor: 'enemy', target: 'player', axis: 'vertical', linkCount: 3, tier: 3, damage: 3, hpBefore: -4, hpAfter: -7, overkill: 3 },
  ];
  const input = deepFreeze(resolution(events, 'enemy')), view = actionBreakdown(input, 8);
  assert.deepEqual(view.rows.map(row => row.kind === 'axis' && [row.axis, row.count, row.damage, row.actual, row.overkill]), [['vertical', 2, 6, 3, 3], ['horizontal', 1, 3, 3, 0], ['diagonal-down', 1, 5, 4, 1], ['diagonal-up', 1, 3, 0, 3]]);
  assert.equal(view.lost.player, 10); assert.match(actionBreakdownHtml(view), /敵の行動/);
});

test('shape damage, reflection using the same shape IDs, self-cost and heal cap each get their own row', () => {
  const events: BattleEvent[] = [
    { type: 'damage', actor: 'player', target: 'enemy', source: 'corner-strike', damage: 6, hpBefore: 4, hpAfter: -2, shapeBoxIds: ['a', 'b', 'c'] },
    { type: 'damage', actor: 'player', target: 'enemy', source: 'blue-transformation', damage: 15, hpBefore: -2, hpAfter: -17, shapeBoxIds: ['a', 'b', 'c'] },
    { type: 'damage', actor: 'player', target: 'player', source: 'ember', damage: 3, hpBefore: 30, hpAfter: 27 },
    { type: 'heal', actor: 'player', target: 'player', source: 'healing-potion', amount: 3, requestedAmount: 8, hpBefore: 27, hpAfter: 30 },
  ];
  const view = actionBreakdown(deepFreeze(resolution(events)), 9);
  assert.deepEqual(view.rows.map(row => [row.kind, row.actual]), [['shape', 4], ['reflection', 0], ['board', 3], ['heal', 3]]);
  assert.equal(view.rows[0]!.kind !== 'heal' && view.rows[0]!.overkill, 2);
  assert.equal(view.rows[1]!.kind !== 'heal' && view.rows[1]!.overkill, 15);
  assert.deepEqual(view.lost, { player: 3, enemy: 4 }); assert.deepEqual(view.healed, { player: 3, enemy: 0 });
});

test('empty/zero-hit actions show no invented axes and fresh restore has no fabricated summary', () => {
  assert.match(actionBreakdownHtml(null), /次に解決した行動/);
  const view = actionBreakdown(resolution([{ type: 'enemy-wait', actor: 'enemy' }], 'enemy'), 2);
  assert.equal(view.rows.length, 0); assert.equal(view.label, '待機'); assert.match(actionBreakdownHtml(view), /HP変化はありません/);
  const fake: Link = { axis: 'vertical', count: 5, tier: 5, boxIds: ['old'] };
  assert.equal(actionBreakdown(resolution([], 'player', [fake]), 1).rows.length, 0);
});

const consumable = (uses: number | null = 1): SkillInstance => ({ id: 'healing-potion', rank: 1, uses });
test('consumable text reads real free-slot uses and says the slot opens after the final use', () => {
  const skill = deepFreeze(consumable()), before = JSON.stringify(skill), view = consumableUseView(skill, 1)!;
  assert.equal(view.uses, 1); assert.equal(view.opensSlot, true); assert.match(view.actionHint, /残1回 · 1手消費 · 自由2が空く/);
  assert.match(view.details, /使用後は自由2が空き/); assert.match(view.confirmLabel, /残1回/); assert.match(consumableDetailsHtml(skill, 1), /残り1回/);
  assert.equal(JSON.stringify(skill), before);
  const remaining = consumableUseView(consumable(2), 0)!;
  assert.equal(remaining.opensSlot, false); assert.match(remaining.actionHint, /使用後は残1回/); assert.doesNotMatch(remaining.details, /空き/);
});
test('unlimited Health/Grow, empty post-use slots and invalid counts never receive a consumable warning', () => {
  for (const skill of [null, undefined, { id: 'health', rank: 1, uses: null }, { id: 'grow-fire', rank: 2, uses: null }] as const) assert.equal(consumableUseView(skill, 0), null);
  assert.equal(consumableUseView(consumable(), -1), null); assert.equal(consumableUseView(consumable(), 2), null);
  for (const uses of [null, -1, NaN, 1.5]) assert.equal(consumableUseView(consumable(uses), 0), null);
  assert.match(consumableUseView(consumable(0), 0)!.actionHint, /使用できません/);
});

test('Health header uses exact five plus cells and does not announce its Blue reflection as a second activation', () => {
  const record = traces[0]!, heal = record.events.find(event => event.type === 'heal')!, reflection = record.events.find(event => event.type === 'damage')!;
  const before = JSON.stringify(record), view = shapeFeedbackForEvent(heal, record.coreStateAfter.boxes)!;
  assert.equal(view.shortName, 'ヘルス'); assert.equal(view.rows, 3); assert.equal(view.columns, 3);
  assert.deepEqual(view.filled, [false, true, false, true, true, true, false, true, false]);
  assert.equal(view.detail, '自分・5箱の十字（名目15）'); assert.equal(shapeFeedbackForEvent(reflection, record.coreStateAfter.boxes), null);
  const html = shapeFeedbackHtml(view); assert.equal((html.match(/class="filled"/g) ?? []).length, 5); assert.match(html, /--shape-cols:3/); assert.equal(shapeFeedbackHtml(null), '');
  assert.equal(JSON.stringify(record), before);
});
test('L sigil preserves all four actual rotations and square stays a true2x2', () => {
  const corners = [[[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 1], [1, 0], [1, 1]]];
  for (const points of corners) {
    const boxes = deepFreeze(points.map(([row, col], i) => box(String(i), row! + 4, col! + 2)));
    const event: BattleEvent = deepFreeze({ type: 'damage', actor: 'player', target: 'enemy', source: 'corner-strike', damage: 6, hpBefore: 30, hpAfter: 24, shapeBoxIds: boxes.map(box => box.id) });
    const view = shapeFeedbackForEvent(event, boxes)!;
    assert.equal(view.shortName, '角打ち'); assert.equal(view.filled.filter(Boolean).length, 3);
    assert.deepEqual(view.filled, [0, 1, 2, 3].map(i => points.some(([row, col]) => row === Math.floor(i / 2) && col === i % 2)));
  }
  const boxes = [box('a', 4, 2), box('b', 4, 3), box('c', 5, 2), box('d', 5, 3)];
  const event: BattleEvent = { type: 'damage', actor: 'player', target: 'enemy', source: 'square-strike', damage: 9, hpBefore: 30, hpAfter: 21, shapeBoxIds: boxes.map(box => box.id) };
  assert.deepEqual(shapeFeedbackForEvent(event, boxes)!.filled, [true, true, true, true]);
});
test('sigil never invents missing IDs, geometry, incidental axis shapes or a potion Health activation', () => {
  const event: BattleEvent = { type: 'heal', actor: 'player', target: 'player', source: 'health', amount: 0, requestedAmount: 15, hpBefore: 30, hpAfter: 30, shapeBoxIds: ['a', 'b', 'c', 'd', 'e'] };
  assert.equal(shapeFeedbackForEvent(event, []), null);
  assert.equal(shapeFeedbackForEvent(event, [box('a'), box('b'), box('c'), box('d'), box('e')]), null);
  assert.equal(shapeFeedbackForEvent({ ...event, source: 'healing-potion' }, []), null);
  assert.equal(shapeFeedbackForEvent(drop('a'), []), null);
});

test('one completed resolution per actor remains available after the opponent responds and resets with no history', () => {
  const initial = deepFreeze(emptyActionBreakdowns());
  const self = recordActionBreakdown(initial, resolution(traces[0]!.events), 1);
  const both = recordActionBreakdown(deepFreeze(self), resolution(traces[2]!.events, 'enemy'), 2);
  assert.equal(both.player, self.player); assert.equal(both.enemy!.actor, 'enemy'); assert.equal(both.player!.lost.enemy, 19);
  assert.equal(initial.player, null); assert.equal(initial.enemy, null);
  const nextSelf = recordActionBreakdown(both, resolution([drop('zero-damage')]), 3);
  assert.equal(nextSelf.player!.lost.enemy, 0); assert.equal(nextSelf.enemy, both.enemy);
  const html = lastActionBreakdownsHtml(both); assert.match(html, /累計ではありません/); assert.match(html, /自分の投入/); assert.match(html, /敵の投入/);
  const reset = lastActionBreakdownsHtml(emptyActionBreakdowns()); assert.equal((reset.match(/未記録。この画面/g) ?? []).length, 2);
});

test('empty turn-start/gauge bookkeeping retains the same history but real zero-damage drops replace it', () => {
  const previous = deepFreeze(recordActionBreakdown(emptyActionBreakdowns(), resolution(traces[0]!.events), 1));
  for (const events of [[], [{ type: 'turn-start', remainingStarts: 0, skipped: true }], [{ type: 'gauge', before: 3, after: 4, amount: 1, source: 'turn' }], [{ type: 'turn-start', remainingStarts: 1, skipped: true }, { type: 'gauge', before: 3, after: 4, amount: 1, source: 'turn' }]] as const) {
    assert.equal(recordActionBreakdown(previous, resolution(events), 3), previous);
  }
  const bonus = recordActionBreakdown(previous, resolution([{ type: 'turn-start', remainingStarts: 1, skipped: false }, drop('bonus')]), 3);
  assert.equal(bonus.player!.label, '手番開始の追加投入'); assert.equal(bonus.player!.lost.enemy, 0);
  const ordinary = recordActionBreakdown(previous, resolution([drop('ordinary')]), 3);
  assert.equal(ordinary.player!.label, '投入'); assert.equal(ordinary.player!.lost.enemy, 0);
  const explicitWait = recordActionBreakdown(previous, resolution([{ type: 'enemy-wait', actor: 'enemy' }], 'enemy'), 2);
  assert.equal(explicitWait.enemy!.label, '待機');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, battleFixtures, createBattle, createCharacterBattleConfig } from '../src/core/index.ts';
import type { BattleState, Resolution } from '../src/core/index.ts';
import { activeDropPose, damageLabelAnchor, effectForEvent, effectTiming, feedbackText, feedbackAnchor } from '../src/ui/battlePresentation.ts';

function resolveFixture(id: string, character: 'blue' | 'red', col: number) {
  const state = createBattle(createCharacterBattleConfig(character, 'marujiro', battleFixtures.find(fixture => fixture.id === id)!));
  const result = applyAction(state, { type: 'drop', candidateId: `ceiling:${col}:0` });
  assert.ok(result.resolution);
  return { state, result, resolution: result.resolution };
}

test('Health lights exactly the five recorded shape boxes before the horizontal link', () => {
  const { resolution } = resolveFixture('health-plus', 'blue', 0);
  const effects = resolution.events.map(event => effectForEvent(event, resolution)).filter(effect => effect !== null);
  assert.deepEqual(effects.map(effect => effect.kind), ['shape', 'link']);
  const heal = resolution.events.find(event => event.type === 'heal')!;
  assert.equal(heal.type, 'heal');
  assert.deepEqual(effects[0]!.boxIds, heal.shapeBoxIds);
  assert.equal(effects[0]!.boxIds.length, 5);
  assert.equal(effects[1]!.boxIds.length, 3);
  assert.equal(effects[1]!.feedback?.amount, 4);
});

test('Grow Fire effects follow event order and use actual 7 then 5 damage', () => {
  const { resolution } = resolveFixture('grow-fire', 'red', 1);
  const hits = resolution.events.filter(event => event.type === 'attack');
  const effects = hits.map(event => effectForEvent(event, resolution)!);
  assert.deepEqual(hits.map(event => event.axis), ['vertical', 'horizontal']);
  assert.deepEqual(effects.map(effect => effect.feedback?.amount), [7, 5]);
  for (let i = 0; i < hits.length; i += 1) assert.deepEqual(effects[i]!.boxIds, resolution.links.find(link => link.axis === hits[i]!.axis)!.boxIds);
  assert.notDeepEqual(effects[0]!.boxIds, effects[1]!.boxIds);
  const growth = resolution.events.find(event => event.type === 'link-growth')!;
  assert.equal(effectForEvent(growth, resolution), null);
});

test('ordinary enemy healing anchors green feedback without spurious plus or link highlight', () => {
  const event = { type: 'heal', actor: 'enemy', target: 'enemy', source: 'nigirin', amount: 10, requestedAmount: 10, hpBefore: 10, hpAfter: 20 } as const;
  const effect = effectForEvent(event, { actor: 'enemy', originBoxId: null, links: [], enemyPlannedAction: 'heal', events: [event] })!;
  assert.equal(effect.kind, 'heal');
  assert.deepEqual(effect.boxIds, []);
  assert.deepEqual(feedbackText(effect.feedback!), { text: '10回復', color: '#8cf3ac', stroke: '#082015' });
  const anchor = feedbackAnchor({ boxes: [] }, effect, { left: 70, top: 60, cell: 40, width: 464, height: 552 }, 100, 30);
  assert.equal(anchor.x, 348);
  assert.equal(anchor.y, 51);
});

test('presentation pose retains pre-cleanup positions and does not mutate the battle', () => {
  const { state, resolution } = resolveFixture('health-plus', 'blue', 0);
  const odd = { ...state, boxes: state.boxes.map(box => ({ ...box, row: 0 })) };
  const pose = activeDropPose(odd, resolution);
  assert.deepEqual(pose.boxes.slice(0, -1), odd.boxes);
  const drop = resolution.events.find(event => event.type === 'drop')!;
  assert.deepEqual(pose.boxes.at(-1), drop.box);
  assert.equal(pose.result, null);
  assert.equal(odd.boxes.length, state.boxes.length);
});

const geometry = { left: 70, top: 60, cell: 40, width: 464, height: 552 };
const boxes: BattleState['boxes'] = [{ id: 'a', row: 3, col: 1 }, { id: 'b', row: 3, col: 3 }, { id: 'other', row: 0, col: 9 }].map(box => ({ ...box, owner: 'player', type: 'normal', status: 'normal' }));
test('damage label anchors above only the current link bounds', () => {
  assert.deepEqual(damageLabelAnchor({ boxes }, ['a', 'b'], geometry, 120, 30), { x: 170, y: 171 });
});
test('damage label clamps top and lateral edges inside the canvas', () => {
  for (const col of [-20, 20]) {
    const anchor = damageLabelAnchor({ boxes: [{ ...boxes[0]!, row: 0, col }] }, ['a'], { ...geometry, top: 0 }, 120, 30);
    assert.ok(anchor.x >= 68 && anchor.x <= 396);
    assert.equal(anchor.y, 38);
  }
});
test('missing geometry still produces finite safe feedback coordinates', () => {
  const anchor = damageLabelAnchor({ boxes: [] }, [], geometry, 120, 30);
  assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
});
test('reduced motion retains readable ordered feedback but never floats it', () => {
  assert.equal(effectTiming(true).float, 0);
  assert.equal(effectTiming(true).lead, 0);
  assert.ok(effectTiming(true).hold >= 150);
  assert.ok(effectTiming(true).hold < effectTiming(false).hold);
  assert.ok(effectTiming(false).float > 0);
});

test('an attack without matching recorded geometry does not fabricate a link', () => {
  const { resolution } = resolveFixture('grow-fire', 'red', 1);
  const event = resolution.events.find(event => event.type === 'attack')!;
  assert.equal(effectForEvent(event, { ...resolution, links: [] } as Resolution), null);
});


test('healing text uses actual recovery, including cap-limited and zero healing', () => {
  for (const amount of [0, 3, 15]) {
    const event = { type: 'heal', actor: 'player', target: 'player', source: 'health', amount, requestedAmount: 15, hpBefore: 30 - amount, hpAfter: 30, shapeBoxIds: ['plus'] } as const;
    const effect = effectForEvent(event, { actor: 'player', originBoxId: 'plus', links: [], enemyPlannedAction: null, events: [event] })!;
    assert.equal(feedbackText(effect.feedback!).text, `${amount}回復`);
    assert.deepEqual(effect.boxIds, ['plus']);
  }
});

test('Blue nominal reflection uses its own damage label and the triggering shape IDs', () => {
  const event = { type: 'damage', actor: 'player', target: 'enemy', source: 'blue-transformation', damage: 15, hpBefore: 60, hpAfter: 45, shapeBoxIds: ['a', 'b'] } as const;
  const effect = effectForEvent(event, { actor: 'player', originBoxId: 'a', links: [], enemyPlannedAction: null, events: [event] })!;
  assert.equal(feedbackText(effect.feedback!).text, '15ダメージ'); assert.deepEqual(effect.boxIds, ['a', 'b']);
});

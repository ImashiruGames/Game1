import test from 'node:test';
import assert from 'node:assert/strict';
import { readabilityReviewCases, readabilityReviewFixture } from '../src/next/ui/readabilityReviewFixture.ts';
import type { ReadabilityReviewCase } from '../src/next/ui/readabilityReviewFixture.ts';
import { createBattle, applyAction } from '../src/next/core/index.ts';
import { prepareTrialSetup } from '../src/next/config.ts';
import { shapeFeedbackForEvent } from '../src/next/ui/shapeFeedback.ts';
import { actionBreakdown } from '../src/next/ui/battleReadability.ts';
import { consumableUseView } from '../src/next/ui/consumableReadability.ts';

test('five explicit review fixtures stay stage1/seed1/6x8 and do not change normal/default configuration', () => {
  const normalArgs = { character: 'blue', firstEnemy: 'marujiro', seed: 1, mode: 'manual', stage: 1, fixture: 'normal', route: 'boss-loop' } as const;
  const normal = JSON.stringify(prepareTrialSetup(normalArgs));
  assert.equal(readabilityReviewCases.length, 5);
  for (const item of readabilityReviewCases) {
    assert.match(item.button, /^検証用：/);
    const setup = readabilityReviewFixture(item.id), state = createBattle(setup.config);
    assert.equal(setup.options.run!.startStage, 1); assert.equal(setup.config.seed, 1);
    assert.equal(setup.config.board.width, 6); assert.equal(setup.config.board.height, 8);
    assert.equal(setup.config.strategy!.transformation, 'manual-charge');
    assert.equal(state.build!.fixed.id, 'health'); assert.equal(state.build!.fixed.uses, null); assert.equal(state.build!.slots.length, 2);
    assert.equal(state.hp.enemy.current, 60); assert.equal(state.hp.enemy.max, 60);
    assert.equal(state.rngState, 1); assert.equal(state.transformation, null);
    assert.deepEqual(readabilityReviewFixture(item.id), setup);
  }
  assert.equal(JSON.stringify(prepareTrialSetup(normalArgs)), normal);
  assert.throws(() => readabilityReviewFixture('normal' as ReadabilityReviewCase), /Unknown/);
});

test('actual potion and bullet fixtures consume free2 once, preserve free1 Corner, and have exact normal-core outcomes', () => {
  for (const kind of ['consumable-potion', 'consumable-bullet'] as const) {
    const state = createBattle(readabilityReviewFixture(kind).config), before = JSON.stringify(state);
    assert.equal(state.hp.player.current, 10); assert.equal(state.hp.player.max, 30); assert.equal(state.boxes.length, 0);
    assert.equal(state.build!.slots[0]!.id, 'corner-strike');
    assert.equal(consumableUseView(state.build!.slots[1], 1)!.actionHint, '残1回 · 1手消費 · 自由2が空く');
    const result = applyAction(state, { type: 'instant-skill', slot: 1 });
    assert.ok(result.accepted); assert.equal(result.state.build!.slots[1], null); assert.equal(result.state.build!.slots[0]!.id, 'corner-strike');
    assert.equal(result.state.actor, 'enemy'); assert.equal(result.state.turn, 2); assert.equal(result.state.rngState, state.rngState);
    assert.equal(JSON.stringify(state), before);
    if (kind === 'consumable-potion') {
      assert.equal(result.state.hp.player.current, 15); assert.equal(result.state.hp.enemy.current, 60);
      const heal = result.resolution!.events.find(event => event.type === 'heal')!;
      assert.equal(heal.amount, 5); assert.equal(heal.requestedAmount, 5);
    } else {
      assert.equal(result.state.hp.player.current, 10); assert.equal(result.state.hp.enemy.current, 46);
      const damage = result.resolution!.events.find(event => event.type === 'damage')!; assert.equal(damage.damage, 14);
    }
    assert.equal(result.resolution!.events.filter(event => event.type === 'instant-skill').length, 1);
  }
});

test('actual full-HP Health review: manual Blue then column2 yields plus5, actual0, nominal15, reflection15 and vertical4', () => {
  const state = createBattle(readabilityReviewFixture('health').config);
  assert.equal(state.hp.player.current, 30); assert.equal(state.gauge, 80);
  const transformed = applyAction(state, { type: 'transform' }); assert.ok(transformed.accepted); assert.equal(transformed.state.gauge, 0);
  assert.equal(transformed.state.turn, 1); assert.equal(transformed.state.rngState, state.rngState);
  const result = applyAction(transformed.state, { type: 'drop', candidateId: 'ceiling:1:0' }); assert.ok(result.accepted);
  const heal = result.resolution!.events.find(event => event.type === 'heal')!;
  const reflection = result.resolution!.events.find(event => event.type === 'damage' && event.source === 'blue-transformation')!;
  const attack = result.resolution!.events.find(event => event.type === 'attack')!;
  assert.equal(heal.amount, 0); assert.equal(heal.requestedAmount, 15); assert.equal(heal.shapeBoxIds!.length, 5);
  assert.equal(reflection.type === 'damage' && reflection.damage, 15);
  assert.equal(attack.axis, 'vertical'); assert.equal(attack.linkCount, 3); assert.equal(attack.damage, 4);
  const shape = shapeFeedbackForEvent(heal, result.state.boxes)!;
  assert.deepEqual(shape.filled, [false, true, false, true, true, true, false, true, false]);
  assert.equal(result.state.hp.enemy.current, 41); assert.equal(result.state.hp.player.current, 30);
  assert.deepEqual(actionBreakdown(result.resolution!, 1).rows.map(row => [row.kind, row.actual]), [['heal', 0], ['reflection', 15], ['axis', 4]]);
});

test('actual Corner and Square review fixtures activate only the requested shape with truthful sigils', () => {
  for (const kind of ['corner', 'square'] as const) {
    const state = createBattle(readabilityReviewFixture(kind).config);
    assert.equal(state.build!.slots[0]!.id, kind === 'corner' ? 'corner-strike' : 'square-strike'); assert.equal(state.build!.slots[1], null);
    const result = applyAction(state, { type: 'drop', candidateId: kind === 'corner' ? 'ceiling:1:0' : 'ceiling:2:0' }); assert.ok(result.accepted);
    const damages = result.resolution!.events.filter(event => event.type === 'damage');
    assert.equal(damages.length, 1); assert.equal(damages[0]!.source, kind === 'corner' ? 'corner-strike' : 'square-strike');
    assert.equal(damages[0]!.damage, kind === 'corner' ? 3 : 5);
    assert.equal(result.resolution!.events.filter(event => event.type === 'heal' || event.type === 'attack').length, 0);
    const shape = shapeFeedbackForEvent(damages[0]!, result.state.boxes)!;
    assert.deepEqual(shape.filled, kind === 'corner' ? [true, false, true, true] : [true, true, true, true]);
    assert.equal(result.state.hp.enemy.current, kind === 'corner' ? 57 : 55);
  }
});


test('review fixture controls are isolated from normal and lookalike routes',async()=>{const {isReadabilityReviewRoute}=await import('../src/next/ui/readabilityReviewFixture.ts');for(const p of ['/night-qa','/night-qa/'])assert.equal(isReadabilityReviewRoute(p),true);for(const p of ['/next/','/','/lab/','/audio-asset-preview/','/night-qa-other/'])assert.equal(isReadabilityReviewRoute(p),false);});

import { createHash } from 'node:crypto';
import { applyAction, battleFixtures, createBattle, createCharacterBattleConfig, getAvailableBoardSkills, getDropOptions, instantSlots, needsTurnStart } from '../../src/lab/engine/index.ts';
import type { BattleAction, BattleConfig } from '../../src/lab/engine/index.ts';
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function parityDigest(config: BattleConfig): string {
  // Compare gameplay with the frozen reference while retaining its historical display name.
  config = { ...config, title: config.title.replaceAll('アオイ', '青').replaceAll('アカリ', '赤'), description: config.description.replaceAll('アオイの変化', '青の変化').replaceAll('アカリの変化', '赤の変化').replaceAll('アオイ', '青の子').replaceAll('アカリ', '赤の子').replaceAll('ルビィ', '赤の子') };
  let state = createBattle(config); const trace: unknown[] = [state];
  for (let step = 0; step < 24 && !state.result; step += 1) {
    let action: BattleAction;
    const skills = getAvailableBoardSkills(state); const drops = getDropOptions(state).filter(option => option.available); const instant = instantSlots(state);
    if (needsTurnStart(state)) action = { type: 'start-turn' };
    else if (state.actor === 'enemy') action = { type: 'enemy' };
    else if (instant.length) action = { type: 'instant-skill', slot: instant[0]! };
    else if (skills.length && (step % 4 === 0 || !drops.length)) action = { type: 'board-skill', skillId: skills[0]!, ...(skills[0] === 'pain-shared' ? { row: step % state.config.board.height } : {}) };
    else if (drops.length) action = { type: 'drop', candidateId: drops[step % drops.length]!.id };
    else action = { type: 'skip' };
    const result = applyAction(state, action); trace.push({ action, result }); state = result.state;
    if (!result.accepted) throw new Error(`Parity trace rejected ${config.id}`);
  }
  return createHash('sha256').update(JSON.stringify(canonical(trace))).digest('hex');
}
export function parityCases(): Array<{ id: string; hash: string }> {
  return battleFixtures.flatMap(fixture => (['blue', 'red'] as const).flatMap(character => [1, 7, 42].map(seed => ({
    id: `${fixture.id}/${character}/${seed}`, hash: parityDigest(createCharacterBattleConfig(character, 'marujiro', { ...fixture, seed })),
  }))));
}

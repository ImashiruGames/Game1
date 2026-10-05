import { freeze } from './immutable.ts';
import type { BattleConfig, CharacterId, EnemyId, NormalSkillId } from './types.ts';
export type AttackTable = Readonly<Record<3 | 4 | 5, number>>;
export interface EnemyBalance { readonly maxHp: number; readonly attacks: AttackTable; readonly healEveryOwnTurns?: number; readonly healAmount?: number }
export interface GameTuning {
  readonly board: { readonly painPerBox: number; readonly emberCost: number; readonly emberConversions: number };
  readonly gauge: { readonly turnGain: number; readonly linkPerBox: number; readonly damagePerHp: number; readonly limits: Readonly<Record<CharacterId, { readonly cost: number; readonly cap: number }>> };
  readonly transformation: { readonly minimumLink: number; readonly redBonusStarts: number };
  readonly links: { readonly growFireGrowth: number };
  readonly skills: Readonly<Record<NormalSkillId, readonly [number, number]>>;
  readonly enemies: Readonly<Record<EnemyId, EnemyBalance>>;
  readonly progression: { readonly hpPerStage: number };
  readonly rewards: { readonly choices: number; readonly threePower: number; readonly largeFourPower: number; readonly largeFivePower: number };
}
/** 日本語: ver1.0の既定値。変更用コピーはcreateTuningで作り、戦闘設定へ注入する。
 * English: Version1.0 defaults are immutable; create overrides and inject them through BattleConfig. */
export const defaultTuning: GameTuning = freeze({
  board: { painPerBox: 2, emberCost: 3, emberConversions: 2 },
  gauge: { turnGain: 1, linkPerBox: 4, damagePerHp: 1, limits: { blue: { cost: 80, cap: 120 }, red: { cost: 100, cap: 150 } } },
  transformation: { minimumLink: 6, redBonusStarts: 2 },
  links: { growFireGrowth: 1 },
  skills: { health: [15, 20], 'grow-fire': [3, 5], charge: [2, 3], 'first-guard': [2, 3], 'horizontal-slash': [2, 4], 'diagonal-shot': [2, 3], 'corner-strike': [3, 5], 'square-strike': [5, 8], 'healing-potion': [5, 10], 'magic-bullet': [2, 3] },
  enemies: {
    marujiro: { maxHp: 60, attacks: { 3: 2, 4: 4, 5: 6 } },
    hikikizan: { maxHp: 30, attacks: { 3: 3, 4: 10, 5: 15 } },
    nigirin: { maxHp: 30, attacks: { 3: 2, 4: 4, 5: 6 }, healEveryOwnTurns: 5, healAmount: 10 },
    merarun: { maxHp: 30, attacks: { 3: 3, 4: 6, 5: 9 } },
  },
  progression: { hpPerStage: 10 },
  rewards: { choices: 3, threePower: 1, largeFourPower: 1, largeFivePower: 2 },
});
type EnemyPatch = Partial<Omit<EnemyBalance, 'attacks'>> & { attacks?: Partial<AttackTable> };
export interface TuningOverrides {
  readonly board?: Partial<GameTuning['board']>;
  readonly gauge?: Partial<Omit<GameTuning['gauge'], 'limits'>> & { limits?: Partial<Record<CharacterId, Partial<GameTuning['gauge']['limits'][CharacterId]>>> };
  readonly transformation?: Partial<GameTuning['transformation']>;
  readonly links?: Partial<GameTuning['links']>;
  readonly skills?: Partial<GameTuning['skills']>;
  readonly enemies?: Partial<Record<EnemyId, EnemyPatch>>;
  readonly progression?: Partial<GameTuning['progression']>;
  readonly rewards?: Partial<GameTuning['rewards']>;
}
/** Explicit typed merging keeps small overrides readable; this is data, not a scripting engine. */
export function createTuning(overrides: TuningOverrides = {}): GameTuning {
  const enemies = Object.fromEntries((Object.keys(defaultTuning.enemies) as EnemyId[]).map(id => [id, { ...defaultTuning.enemies[id], ...overrides.enemies?.[id], attacks: { ...defaultTuning.enemies[id].attacks, ...overrides.enemies?.[id]?.attacks } }])) as Record<EnemyId, EnemyBalance>;
  const tuning: GameTuning = {
    board: { ...defaultTuning.board, ...overrides.board },
    gauge: { ...defaultTuning.gauge, ...overrides.gauge, limits: { blue: { ...defaultTuning.gauge.limits.blue, ...overrides.gauge?.limits?.blue }, red: { ...defaultTuning.gauge.limits.red, ...overrides.gauge?.limits?.red } } },
    transformation: { ...defaultTuning.transformation, ...overrides.transformation },
    links: { ...defaultTuning.links, ...overrides.links },
    skills: { ...defaultTuning.skills, ...overrides.skills }, enemies,
    progression: { ...defaultTuning.progression, ...overrides.progression }, rewards: { ...defaultTuning.rewards, ...overrides.rewards },
  };
  validateTuning(tuning); return freeze(structuredClone(tuning));
}
export function tuningOf(config: Pick<BattleConfig, 'tuning'>): GameTuning { return config.tuning ?? defaultTuning; }
export function validateTuning(tuning: GameTuning): void {
  const integer = (value: number, minimum = 0) => { if (!Number.isSafeInteger(value) || value < minimum) throw new Error('Tuning values must be safe nonnegative integers'); };
  const record = (value: unknown, name: string) => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Missing tuning record: ${name}`); };
  record(tuning, 'root');
  for (const name of ['board', 'gauge', 'transformation', 'links', 'skills', 'enemies', 'progression', 'rewards'] as const) record(tuning[name], name);
  record(tuning.gauge.limits, 'gauge.limits');
  for (const key of ['painPerBox', 'emberCost', 'emberConversions'] as const) integer(tuning.board[key]);
  for (const value of [tuning.gauge.turnGain, tuning.gauge.linkPerBox, tuning.gauge.damagePerHp]) integer(value);
  for (const character of ['blue', 'red'] as const) { const limits = tuning.gauge.limits[character]; record(limits, `gauge.limits.${character}`); integer(limits.cost, 1); integer(limits.cap, limits.cost); }
  integer(tuning.transformation.minimumLink, 3); integer(tuning.transformation.redBonusStarts, 1);
  integer(tuning.links.growFireGrowth);
  for (const id of Object.keys(defaultTuning.skills) as NormalSkillId[]) { const values = tuning.skills[id]; if (!Array.isArray(values) || values.length !== 2) throw new Error('Every skill needs base and plus tuning'); integer(values[0]); integer(values[1]); }
  for (const id of Object.keys(defaultTuning.enemies) as EnemyId[]) {
    const enemy = tuning.enemies[id]; record(enemy, `enemies.${id}`); record(enemy.attacks, `enemies.${id}.attacks`); integer(enemy.maxHp, 1);
    for (const tier of [3, 4, 5] as const) integer(enemy.attacks[tier]);
    if (enemy.healEveryOwnTurns !== undefined) { integer(enemy.healEveryOwnTurns, 1); integer(enemy.healAmount!); }
  }
  integer(tuning.progression.hpPerStage); integer(tuning.rewards.choices, 1);
  for (const value of [tuning.rewards.threePower, tuning.rewards.largeFourPower, tuning.rewards.largeFivePower]) integer(value);
}

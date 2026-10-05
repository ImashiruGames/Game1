import { freeze } from './immutable.ts';
import type { BattleConfig, CharacterId, EnemyId, NormalSkillId, ExpansionSkillId, TrophySkillId } from './types.ts';
export type AttackTable = Readonly<Record<3 | 4 | 5, number>>;
export interface EnemyBalance { readonly maxHp: number; readonly attacks: AttackTable; readonly healEveryOwnTurns?: number; readonly healAmount?: number }
export interface GameTuning {
  readonly board: { readonly painPerBox: number; readonly emberCost: number; readonly emberConversions: number };
  readonly gauge: { readonly turnGain: number; readonly linkPerBox: number; readonly damagePerHp: number; readonly bands?: Readonly<Record<3 | 4 | 5 | 'sixPlus', number>>; readonly limits: Readonly<Record<CharacterId, { readonly cost: number; readonly cap: number }>> };
  readonly transformation: { readonly minimumLink: number; readonly redBonusStarts: number };
  readonly links: { readonly growFireGrowth: number };
  readonly skills: Readonly<Record<Exclude<NormalSkillId,'poison-craft'|ExpansionSkillId|TrophySkillId>, readonly [number, number]> & Partial<Record<ExpansionSkillId|TrophySkillId, readonly [number,number]>>>;
  readonly enemies: Readonly<Record<EnemyId, EnemyBalance>>;
  readonly bosses: { readonly speedPulseEvery: number; readonly speedPulseDamage: number; readonly motherThresholdPercent: number; readonly motherPulseDamage: number };
  readonly progression: { readonly hpPerStage: number; readonly loopLength: number; readonly hpMultiplierStep: number; readonly attackPerLoop: number; readonly fixedDamagePerLoop: number };
  readonly rewards: { readonly choices: number; readonly threePower: number; readonly largeFourPower: number; readonly largeFivePower: number; readonly immediateHeal: number; readonly maxHp: number; readonly fourPower: number; readonly fivePower: number };
}
/** 日本語: ver1.0の既定値。変更用コピーはcreateTuningで作り、戦闘設定へ注入する。
 * English: Version1.0 defaults are immutable; create overrides and inject them through BattleConfig. */
export const defaultTuning: GameTuning = freeze({
  board: { painPerBox: 2, emberCost: 3, emberConversions: 2 },
  gauge: { turnGain: 1, linkPerBox: 4, damagePerHp: 1, limits: { blue: { cost: 80, cap: 120 }, red: { cost: 100, cap: 150 } } },
  transformation: { minimumLink: 6, redBonusStarts: 2 },
  links: { growFireGrowth: 1 },
  skills: { 'heavy-swing':[50,100], 'rescue-kit':[10,10], 'clear-column':[3,5], 'pincer-strike':[3,5], 'twin-diagonal':[4,6], 'square-conduit':[2,3], 'venom-edge':[3,5], 'frost-edge':[3,5], 'exact-four':[3,5], 'shiny-relay':[3,5], 't-strike':[6,9], 'zigzag-strike':[6,9], 'cup-strike':[8,12], 'diamond-strike':[7,10], 'cross-strike':[9,13], 'full-power':[2,3], foundation:[1,2], 'snake-line':[4,6], 'edge-strike':[2,3], siege:[1,2], crossfire:[2,3], 'last-stand':[3,5], 'iron-wall':[1,2], capacitor:[12,20], solvent:[2,4], health: [15, 20], 'grow-fire': [3, 5], charge: [2, 3], 'first-guard': [2, 3], 'horizontal-slash': [2, 4], 'diagonal-shot': [2, 3], 'corner-strike': [3, 5], 'square-strike': [5, 8], 'healing-potion': [5, 10], 'magic-bullet': [2, 3] },
  enemies: {
    devilmon: { maxHp: 48, attacks: { 3: 4, 4: 8, 5: 12 } },
    shashark: { maxHp: 52, attacks: { 3: 4, 4: 12, 5: 20 } },
    // 日本語: 深層（51階〜）。4リンク以上が極端に重い。English: Deep floors; very heavy 4+ links.
    biribiriman: { maxHp: 40, attacks: { 3: 3, 4: 15, 5: 25 } },
    hyokuru: { maxHp: 35, attacks: { 3: 5, 4: 7, 5: 13 } },
    hanabell: { maxHp: 70, attacks: { 3: 4, 4: 6, 5: 12 } },
    'zeroguard-x': { maxHp: 150, attacks: { 3: 4, 4: 6, 5: 16 } },
    hoshimimi: { maxHp: 45, attacks: { 3: 3, 4: 7, 5: 11 } },
    mokousagi: { maxHp: 90, attacks: { 3: 2, 4: 5, 5: 9 } },
    hinobou: { maxHp: 40, attacks: { 3: 4, 4: 8, 5: 14 } },
    'twin-core': { maxHp: 42, attacks: { 3: 4, 4: 5, 5: 7 } },
    'needle-core': { maxHp: 25, attacks: { 3: 2, 4: 6, 5: 13 } },
    'frost-core': { maxHp: 36, attacks: { 3: 3, 4: 5, 5: 8 } },
    'thorn-core': { maxHp: 40, attacks: { 3: 2, 4: 4, 5: 7 } },
    'rime-crown': { maxHp: 48, attacks: { 3: 3, 4: 6, 5: 9 } },
    'briar-wheel': { maxHp: 52, attacks: { 3: 3, 4: 5, 5: 8 } },

    marujiro: { maxHp: 60, attacks: { 3: 2, 4: 4, 5: 6 } },
    hikikizan: { maxHp: 30, attacks: { 3: 3, 4: 10, 5: 15 } },
    nigirin: { maxHp: 30, attacks: { 3: 2, 4: 4, 5: 6 }, healEveryOwnTurns: 5, healAmount: 10 },
    merarun: { maxHp: 30, attacks: { 3: 3, 4: 6, 5: 9 } },
    'speed-core': { maxHp: 50, attacks: { 3: 6, 4: 7, 5: 9 } },
    'mother-core': { maxHp: 150, attacks: { 3: 5, 4: 8, 5: 12 } },
  },
  bosses: { speedPulseEvery: 5, speedPulseDamage: 3, motherThresholdPercent: 20, motherPulseDamage: 5 },
  progression: { hpPerStage: 10, loopLength: 50, hpMultiplierStep: 2, attackPerLoop: 2, fixedDamagePerLoop: 1 },
  rewards: { choices: 3, threePower: 1, largeFourPower: 1, largeFivePower: 2, immediateHeal: 10, maxHp: 5, fourPower: 2, fivePower: 3 },
});
type EnemyPatch = Partial<Omit<EnemyBalance, 'attacks'>> & { attacks?: Partial<AttackTable> };
export interface TuningOverrides {
  readonly board?: Partial<GameTuning['board']>;
  readonly gauge?: Partial<Omit<GameTuning['gauge'], 'limits'>> & { limits?: Partial<Record<CharacterId, Partial<GameTuning['gauge']['limits'][CharacterId]>>> };
  readonly transformation?: Partial<GameTuning['transformation']>;
  readonly links?: Partial<GameTuning['links']>;
  readonly skills?: Partial<GameTuning['skills']>;
  readonly enemies?: Partial<Record<EnemyId, EnemyPatch>>;
  readonly bosses?: Partial<GameTuning['bosses']>;
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
    bosses: { ...defaultTuning.bosses, ...overrides.bosses },
    progression: { ...defaultTuning.progression, ...overrides.progression }, rewards: { ...defaultTuning.rewards, ...overrides.rewards },
  };
  validateTuning(tuning); return freeze(structuredClone(tuning));
}
export function tuningOf(config: Pick<BattleConfig, 'tuning'>): GameTuning { return config.tuning ?? defaultTuning; }
export function validateTuning(tuning: GameTuning): void {
  const integer = (value: number, minimum = 0) => { if (!Number.isSafeInteger(value) || value < minimum) throw new Error('Tuning values must be safe nonnegative integers'); };
  const record = (value: unknown, name: string) => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Missing tuning record: ${name}`); };
  record(tuning, 'root');
  for (const name of ['board', 'gauge', 'transformation', 'links', 'skills', 'enemies', 'bosses', 'progression', 'rewards'] as const) record(tuning[name], name);
  record(tuning.gauge.limits, 'gauge.limits');
  for (const key of ['painPerBox', 'emberCost', 'emberConversions'] as const) integer(tuning.board[key]);
  for (const value of [tuning.gauge.turnGain, tuning.gauge.linkPerBox, tuning.gauge.damagePerHp]) integer(value);
  for (const character of ['blue', 'red'] as const) { const limits = tuning.gauge.limits[character]; record(limits, `gauge.limits.${character}`); integer(limits.cost, 1); integer(limits.cap, limits.cost); }
  if (tuning.gauge.bands) for (const key of [3, 4, 5, 'sixPlus'] as const) integer(tuning.gauge.bands[key]);
  integer(tuning.transformation.minimumLink, 3); integer(tuning.transformation.redBonusStarts, 1);
  integer(tuning.links.growFireGrowth);
  for (const id of Object.keys(defaultTuning.skills) as Exclude<NormalSkillId,'poison-craft'>[]) { const values = tuning.skills[id]; if (values === undefined && !['health','grow-fire','charge','first-guard','horizontal-slash','diagonal-shot','corner-strike','square-strike','healing-potion','magic-bullet'].includes(id)) continue; if (!Array.isArray(values) || values.length !== 2) throw new Error('Every skill needs base and plus tuning'); integer(values[0]); integer(values[1]); }
  for (const id of Object.keys(defaultTuning.enemies) as EnemyId[]) {
    const enemy = tuning.enemies[id];
    // 日本語: 旧セーブの完全な調整表には追加敵がない。既存6体の欠落は許容しない。
    // English: Old full tuning snapshots lack added IDs, but must retain every original enemy.
    if (!enemy && ['devilmon','shashark','twin-core','needle-core','frost-core','thorn-core','rime-crown','briar-wheel','biribiriman','hyokuru','hanabell','zeroguard-x','hoshimimi','mokousagi','hinobou'].includes(id)) continue;
    record(enemy, `enemies.${id}`); record(enemy.attacks, `enemies.${id}.attacks`); integer(enemy.maxHp, 1);
    for (const tier of [3, 4, 5] as const) integer(enemy.attacks[tier]);
    if (enemy.healEveryOwnTurns !== undefined) { integer(enemy.healEveryOwnTurns, 1); integer(enemy.healAmount!); }
  }
  integer(tuning.bosses.speedPulseEvery, 1); integer(tuning.bosses.speedPulseDamage); integer(tuning.bosses.motherPulseDamage);
  integer(tuning.bosses.motherThresholdPercent, 1); if (tuning.bosses.motherThresholdPercent > 100) throw new Error('Boss HP threshold must be at most100');
  if(tuning.progression.loopLength!==50)throw new Error('This boss route requires50 stages per loop'); integer(tuning.progression.hpMultiplierStep); integer(tuning.progression.attackPerLoop); integer(tuning.progression.fixedDamagePerLoop);
  integer(tuning.progression.hpPerStage); integer(tuning.rewards.choices, 1);
  for (const value of [tuning.rewards.threePower, tuning.rewards.largeFourPower, tuning.rewards.largeFivePower, tuning.rewards.immediateHeal, tuning.rewards.maxHp, tuning.rewards.fourPower, tuning.rewards.fivePower]) integer(value);
}

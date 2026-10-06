import { defaultTuning, tuningOf } from './tuning.ts';
import type { GameTuning } from './tuning.ts';
import { freeze } from './immutable.ts';
import type { BattleConfig, BoardDefinition, Box, CharacterId, EnemyDefinition, EnemyId, Owner, PlayerSkillLoadout, PlayerBuild, NormalSkillId } from './types.ts';

/** 日本語: これは検証用の仮バランス。盤面・HP・攻撃表を判定コードと分離する。
 * English: These are provisional test values; board, HP, and attack data stay outside rules code. */
export const defaultConfig: BattleConfig = freeze({
  id: 'standard', title: '基本の対戦', description: '6 × 8の共通盤面。3つ以上のリンクで攻撃します。数値は検証用です。',
  board: { width: 6, height: 8, gravity: 'down', terrain: [], invalidCells: [] },
  initialBoxes: [],
  combatants: {
    player: { maxHp: 30, initialHp: 30, attacks: { 3: 4, 4: 7, 5: 11 } },
    enemy: { maxHp: 30, initialHp: 30, attacks: { 3: 3, 4: 6, 5: 9 } },
  },
  firstActor: 'player', seed: 1, enemyPattern: [{ type: 'drop' }],
});

const box = (row: number, col: number, owner: Owner = 'player'): Box => ({
  id: `fixture:${row}:${col}`, row, col, owner, type: 'normal', status: 'normal',
});
const rectangle = (width: number, height: number): BoardDefinition => ({ width, height, gravity: 'down', terrain: [], invalidCells: [] });

const labBuild = (character: CharacterId, first: NormalSkillId | null = null, second: NormalSkillId | null = null): PlayerBuild => ({
  fixed: { id: character === 'blue' ? 'health' : 'grow-fire', rank: 1, uses: null },
  slots: [first ? { id: first, rank: 1, uses: first === 'healing-potion' || first === 'magic-bullet' ? 1 : null } : null, second ? { id: second, rank: 1, uses: second === 'healing-potion' || second === 'magic-bullet' ? 1 : null } : null],
  power: { 3: 0, 4: 0, 5: 0 },
});
/** 日本語: 小さな安定配置で例外ルールを再現する。初期箱を宙に浮かせない。
 * English: Small, gravity-stable fixtures make edge rules reproducible without floating boxes. */
export const battleFixtures: readonly BattleConfig[] = freeze([
  defaultConfig,
  {
    ...defaultConfig, id: 'internal-ceilings', title: '内部の天井',
    description: '浮いた固定地形の下面にも落下マークができます。箱は地形を通り抜けません。',
    board: { ...defaultConfig.board, terrain: [{ row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 }] },
  },
  {
    ...defaultConfig, id: 'cross-attack', title: '縦横リンクとオーバーキル',
    description: '中央へ投入すると縦・横の順に2回攻撃。敵HPが0になっても後続攻撃は続きます。',
    board: rectangle(3, 3),
    initialBoxes: [box(0, 0), box(0, 2), box(1, 0, 'neutral'), box(1, 1), box(1, 2, 'neutral'),
      box(2, 0, 'neutral'), box(2, 1), box(2, 2, 'neutral')],
    combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 4 } },
  },
  {
    ...defaultConfig, id: 'last-drop-win', title: '最後の1マスで勝利',
    description: '中央が最後の投入先。敵を倒せば勝利し、投入不能の敵攻撃は起きません。',
    board: rectangle(3, 1), initialBoxes: [box(0, 0), box(0, 2)],
    combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 4 } },
  },
  {
    ...defaultConfig, id: 'blocked-player', title: '投入不能と盤面スキル',
    description: '通常投入はできません。盤面スキルがあれば選べます。両方ない設定だけスキップし、投入不能の敵は代替攻撃を使います。',
    board: rectangle(3, 1), initialBoxes: [box(0, 0), box(0, 1, 'enemy'), box(0, 2, 'neutral')],
  },
  {
    ...defaultConfig, id: 'enemy-attack', title: '敵の攻撃表',
    description: '敵が先攻で3リンクを作ります。選択した敵自身の攻撃表を使います。',
    board: rectangle(3, 1), initialBoxes: [box(0, 0, 'enemy'), box(0, 2, 'enemy')], firstActor: 'enemy',
  },
  {
    ...defaultConfig, id: 'health-plus', title: '青：ヘルスの＋形',
    description: '青の子で左端へ投入すると、5個の＋形でHPを15回復。その後に横3リンクで攻撃します。',
    board: rectangle(3, 4),
    initialBoxes: [box(1, 1), box(2, 1), box(2, 2), box(3, 0, 'neutral'), box(3, 1), box(3, 2, 'neutral')],
    combatants: { ...defaultConfig.combatants, player: { ...defaultConfig.combatants.player, initialHp: 10 } },
  },
  {
    ...defaultConfig, id: 'grow-fire', title: '赤：グローファイア',
    description: 'ルビィで中央へ投入すると縦3リンクで火力＋3の攻撃。火力が1成長し、続く横3リンクにも反映されます。',
    board: rectangle(3, 4),
    initialBoxes: [box(1, 0), box(1, 2), box(2, 0, 'neutral'), box(2, 1), box(2, 2, 'neutral'),
      box(3, 0, 'neutral'), box(3, 1), box(3, 2, 'neutral')],
  },
  {
    ...defaultConfig, id: 'transform-blue', title: '青：変化直前・縦6',
    description: '青の子・ゲージ56。中央へ投入し、縦6の攻撃後に80へ到達して変化します。',
    board: rectangle(3, 8), initialBoxes: [3, 4, 5, 6, 7].map(row => box(row, 1)), initialGauge: 56,
  },
  {
    ...defaultConfig, id: 'transform-red', title: '赤：変化直前・縦6',
    description: 'ルビィ・ゲージ76。中央へ投入し、攻撃後に変化。次の自分の手番から追加投入します。',
    board: rectangle(3, 8), initialBoxes: [3, 4, 5, 6, 7].map(row => box(row, 1)), initialGauge: 76,
  },
  {
    ...defaultConfig, id: 'transformed-health', title: '変化後の青：満タンのヘルス',
    description: '青の変化中・HP満タン。左端で＋形を作ると、実回復0でも予定量15のダメージを与えます。',
    board: rectangle(3, 4), initialBoxes: [box(1, 1), box(2, 1), box(2, 2), box(3, 0, 'neutral'), box(3, 1), box(3, 2, 'neutral')],
    initialTransformation: { character: 'blue', scope: 'stage' },
  },
  {
    ...defaultConfig, id: 'transformed-red', title: '変化後の赤：追加投入2回',
    description: '赤の変化中で開始。最初に無料の能動投入を行い、その後も通常の1手を使えます。',
    initialTransformation: { character: 'red', scope: 'run', remainingStarts: 2 },
  },
  {
    ...defaultConfig, id: 'reward-lab', title: '報酬：1手で撃破', characterId: 'blue',
    description: '3列目へ投入して敵を倒すと、3択報酬で停止します。選ぶかスキップして次の敵へ進みます。',
    initialBoxes: [box(7, 0), box(7, 1)], initialBuild: labBuild('blue'),
    combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 1 } },
  },
  {
    ...defaultConfig, id: 'reward-replace', title: '報酬：自由枠の入れ替え', characterId: 'blue',
    description: '自由枠が埋まった状態。3列目で撃破し、新しい通常スキルを選ぶと入れ替え先を選べます。',
    initialBoxes: [box(7, 0), box(7, 1)], initialBuild: labBuild('blue', 'charge', 'first-guard'),
    combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 1 } },
  },
  {
    ...defaultConfig, id: 'consumable-lab', title: '消耗品：ポーションと魔法弾', characterId: 'blue',
    description: '自由枠に1回限りの回復と魔法弾を装備。使用で1手を使い、その枠が空きます。',
    initialBuild: labBuild('blue', 'healing-potion', 'magic-bullet'),
    combatants: { ...defaultConfig.combatants, player: { ...defaultConfig.combatants.player, initialHp: 20 } },
  },
  {
    ...defaultConfig, id: 'shape-skills-lab', title: '形スキル：Lと2×2', characterId: 'blue',
    description: '左端へ投入して2×2を完成。角打ちと四角打ちが1回ずつ、順に発動します。',
    board: rectangle(3, 3), initialBuild: labBuild('blue', 'corner-strike', 'square-strike'),
    initialBoxes: [box(0, 1), box(1, 0), box(1, 1), box(2, 0, 'neutral'), box(2, 1, 'neutral'), box(2, 2, 'neutral')],
  },
  {
    ...defaultConfig, id: 'bonus-reward-lab', title: '赤：追加投入で撃破と報酬', characterId: 'red',
    description: '最初の追加投入で撃破。報酬を選ぶまで次の敵も次の追加投入も始まりません。',
    board: rectangle(1, 3), initialBoxes: [box(1, 0), box(2, 0)], initialBuild: labBuild('red'),
    initialTransformation: { character: 'red', scope: 'run', remainingStarts: 2 },
    combatants: { ...defaultConfig.combatants, enemy: { ...defaultConfig.combatants.enemy, initialHp: 1 } },
  },
]);


/** 日本語: キャラ能力は明示した時だけ有効。既存の検証設定はスキルなし。
 * English: Character abilities are opt-in; legacy fixture configs remain skill-free. */
export const characterSkills: Readonly<Record<CharacterId, PlayerSkillLoadout>> = freeze({
  blue: { boardSkills: ['pain-shared'], shapeSkills: ['health'], linkSkills: [] },
  red: { boardSkills: ['ember'], shapeSkills: [], linkSkills: ['grow-fire'] },
});
export const enemyDefinitions: Readonly<Record<EnemyId, EnemyDefinition>> = freeze({
  marujiro: { id: 'marujiro', label: 'マルジロ', ...defaultTuning.enemies.marujiro },
  hikikizan: { id: 'hikikizan', label: 'ヒキキザン', ...defaultTuning.enemies.hikikizan },
  nigirin: { id: 'nigirin', label: 'ニギリン', ...defaultTuning.enemies.nigirin },
  merarun: { id: 'merarun', label: 'メラルン', ...defaultTuning.enemies.merarun },
});
export function getEnemyDefinition(id: EnemyId, tuning: GameTuning = defaultTuning): EnemyDefinition { return freeze({ id, label: enemyDefinitions[id].label, ...tuning.enemies[id], attacks: { ...tuning.enemies[id].attacks } }); }
export const enemyRoster: readonly EnemyId[] = freeze(['marujiro', 'hikikizan', 'nigirin', 'merarun']);

/** Apply named enemy stats without hiding the independently configurable player stats. */
export function createCharacterBattleConfig(characterId: CharacterId, enemyId: EnemyId,
  baseConfig: BattleConfig = defaultConfig): BattleConfig {
  const enemy = getEnemyDefinition(enemyId, tuningOf(baseConfig));
  // Keep explicit loadouts and player stats when preparing a later stage.
  const base = structuredClone(baseConfig);
  return freeze({ ...base, characterId, enemyId,
    initialBuild: base.initialBuild ? { ...base.initialBuild, fixed: { id: characterId === 'blue' ? 'health' : 'grow-fire', rank: base.initialBuild.fixed.rank, uses: null }, slots: base.initialBuild.slots.map(skill => skill?.id === (characterId === 'blue' ? 'health' : 'grow-fire') ? null : skill) as unknown as PlayerBuild['slots'] } : undefined,
    initialTransformation: base.initialTransformation?.character === characterId ? base.initialTransformation : undefined,
    combatants: { ...base.combatants, enemy: { maxHp: enemy.maxHp, initialHp: enemy.maxHp, attacks: { ...enemy.attacks } } },
    enemyPattern: [{ type: 'drop' }],
  });
}

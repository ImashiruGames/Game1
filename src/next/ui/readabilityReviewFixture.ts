import { prepareTrialSetup } from '../config.ts';
import { createPlayerBuild, createSkill } from '../core/playerBuild.ts';
import type { BattleConfig, Box, PlayerBuild } from '../core/types.ts';
import type { BattleControllerOptions } from '../app/BattleController.ts';

/** Optional explicit buttons on /night-qa/ only. Never a default/new-run configuration. */
export const readabilityReviewCases = [
  { id: 'consumable-potion', button: '検証用：自由2の回復ポーション', instructions: '詳細から自由2を選び残り1回と使用後の空きを確認します。' },
  { id: 'consumable-bullet', button: '検証用：自由2の魔法弾', instructions: '詳細から自由2を選び残り1回と使用後の空きを確認します。' },
  { id: 'health', button: '検証用：満HPヘルスと青反射', instructions: '先に「変化する」次に2列目へ投入。実回復0・名目15・青反射15・縦3の4ダメージを確認します。' },
  { id: 'corner', button: '検証用：3箱L字の角打ち', instructions: '2列目へ投入。角打ち3ダメージと3箱L字の表示を確認します。' },
  { id: 'square', button: '検証用：2×2の四角打ち', instructions: '3列目へ投入。四角打ち5ダメージと2×2の表示を確認します。' },
] as const;
export type ReadabilityReviewCase = typeof readabilityReviewCases[number]['id'];
const box = (row: number, col: number, owner: Box['owner'] = 'player'): Box => ({ id: `readability-fixture:${row}:${col}`, row, col, owner, type: 'normal', status: 'normal' });

/** Returns an ordinary valid starting setup only: no storage, RNG execution, DOM or engine changes. */
export function readabilityReviewFixture(kind: ReadabilityReviewCase): { config: BattleConfig; options: BattleControllerOptions } {
  if (!readabilityReviewCases.some(item => item.id === kind)) throw new Error('Unknown readability review fixture');
  const setup = prepareTrialSetup({ character: 'blue', firstEnemy: 'marujiro', seed: 1, mode: 'manual', stage: 1, fixture: 'normal', route: 'boss-loop' });
  const item = kind === 'consumable-potion' ? 'healing-potion' : kind === 'consumable-bullet' ? 'magic-bullet' : null;
  const build: PlayerBuild = {
    ...createPlayerBuild('blue'),
    slots: item ? [createSkill('corner-strike'), createSkill(item)]
      : kind === 'corner' ? [createSkill('corner-strike'), null]
        : kind === 'square' ? [createSkill('square-strike'), null] : [null, null],
  };
  const initialBoxes: readonly Box[] = kind === 'health'
    ? [box(6, 1), box(6, 0), box(6, 2), box(7, 1), box(7, 0, 'neutral'), box(7, 2, 'neutral')]
    : kind === 'corner' ? [box(7, 1), box(7, 2)]
      : kind === 'square' ? [box(7, 1), box(7, 2), box(6, 1)] : [];
  return { ...setup, config: {
    ...setup.config,
    id: `readability-review-${kind}`,
    title: readabilityReviewCases.find(item => item.id === kind)!.button,
    initialBuild: build,
    initialBoxes,
    initialGauge: kind === 'health' ? 80 : 0,
    combatants: { ...setup.config.combatants, player: { ...setup.config.combatants.player, maxHp: 30, initialHp: item ? 10 : 30 }, enemy: { ...setup.config.combatants.enemy, maxHp: 60, initialHp: 60 } },
  } };
}

export function isReadabilityReviewRoute(path:string):boolean{return ['night-qa','energy-qa'].some(route=>path===`/${route}`||path.startsWith(`/${route}/`));}

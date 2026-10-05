import { prepareTrialSetup } from '../config.ts';
import type { BattleConfig, Box } from '../core/types.ts';
import type { BattleControllerOptions } from '../app/BattleController.ts';

/** Explicit /night-qa/ buttons only; never used by normal/new-run setup. Row labels are 1-based. */
export const rowProjectionReviewCases = [
  { id: 'barriers', row: 3, button: '検証用：地形と無効マスの落下', instructions: '4行目を選択。消去後は3行目の自箱・敵箱・中立箱が4行目へ。5行目の地形・無効マスを越えず、最下段は動きません。' },
  { id: 'reconnect', row: 6, button: '検証用：敵箱の再接続', instructions: '7行目の中立箱を選択。消去後は4列目の敵箱が6～8行目で縦3に接続しますが、受動落下では攻撃しません。' },
] as const;
export type RowProjectionReviewCase = typeof rowProjectionReviewCases[number]['id'];

const box = (id: string, row: number, col: number, owner: Box['owner']): Box => ({
  id: `row-review:${id}`, row, col, owner, type: 'normal', status: 'normal',
});

/** 日本語: 明示的な検証用初期配置だけ。English: Ordinary valid setup data; no state or storage changes. */
export function rowProjectionReviewFixture(kind: RowProjectionReviewCase): { config: BattleConfig; options: BattleControllerOptions } {
  const item = rowProjectionReviewCases.find(candidate => candidate.id === kind);
  if (!item) throw new Error('Unknown row projection review fixture');
  const setup = prepareTrialSetup({ character: 'blue', firstEnemy: 'marujiro', seed: 1, mode: 'manual', stage: 1, fixture: 'normal', route: 'boss-loop' });
  const initialBoxes: readonly Box[] = kind === 'barriers' ? [
    box('terrain-player', 2, 0, 'player'), box('terrain-removed', 3, 0, 'enemy'), box('terrain-bottom', 7, 0, 'neutral'),
    box('invalid-enemy', 2, 1, 'enemy'), box('invalid-removed', 3, 1, 'neutral'), box('invalid-bottom', 7, 1, 'player'),
    box('open-neutral', 2, 2, 'neutral'), box('open-removed', 3, 2, 'player'),
    ...[4, 5, 6, 7].map(row => box(`open-support-${row}`, row, 2, 'neutral')),
  ] : [
    box('reconnect-upper', 4, 3, 'enemy'), box('reconnect-middle', 5, 3, 'enemy'),
    box('reconnect-removed', 6, 3, 'neutral'), box('reconnect-bottom', 7, 3, 'enemy'),
  ];
  return { ...setup, config: { ...setup.config,
    id: `row-projection-review-${kind}`, title: item.button, description: item.instructions,
    board: kind === 'barriers' ? { ...setup.config.board, terrain: [{ row: 4, col: 0 }], invalidCells: [{ row: 4, col: 1 }] } : setup.config.board,
    initialBoxes,
  } };
}

import { carryTopPlayerRow } from '../app/BattleRun.ts';
import type { BattleState, Box } from '../core/types.ts';

export interface CarryPreview {
  readonly candidates: readonly Box[];
  readonly sourceRow: number | null;
  readonly label: string;
  readonly explanation: string;
}

/** Read the real carry rule, then map settled IDs back to their current cells. */
export function carryPreview(state: BattleState, hasNextStage = true): CarryPreview {
  if (!hasNextStage) return { candidates: [], sourceRow: null, label: '最終階 · 持越しなし', explanation: '50階をクリアするとラン終了です。次の戦闘への持越しはありません。' };
  const ids = new Set(carryTopPlayerRow(state).map(box => box.id));
  const candidates = state.boxes.filter(box => ids.has(box.id));
  const sourceRow = candidates[0]?.row ?? null;
  return {
    candidates, sourceRow,
    label: `角枠＝持越し候補 ${candidates.length}箱`,
    explanation: 'いま最も上にある自箱を含む横1行の自箱だけが候補です。奪った自箱も含みます。撃破時に確定し同じ列のまま次戦で重力落下します。各列の最上箱を集めるルールではありません。',
  };
}

/** Adds quiet corners without replacing hit, target, ghost, or click attributes. */
export function renderCarryPreview(board: HTMLElement, state: BattleState, hasNextStage = true): void {
  const view = carryPreview(state, hasNextStage);
  for (const cell of board.querySelectorAll<HTMLElement>('.carry-candidate')) {
    cell.classList.remove('carry-candidate');
    cell.setAttribute('aria-label', (cell.getAttribute('aria-label') ?? '').replace(' · 次戦へ持越し候補', ''));
  }
  for (const box of view.candidates) {
    const cell = board.querySelector<HTMLElement>(`[data-cell-row="${box.row}"][data-cell-col="${box.col}"]`);
    if (!cell) continue;
    cell.classList.add('carry-candidate');
    const base=(cell.getAttribute('aria-label')||`${box.row+1}行${box.col+1}列 自箱`).replace(' · 次戦へ持越し候補','');
    cell.setAttribute('aria-label', `${base} · 次戦へ持越し候補`);
  }
  const host = board.parentElement;
  if (!host) return;
  let legend = host.querySelector<HTMLElement>('.carry-legend');
  if (!legend) { legend = board.ownerDocument.createElement('p'); legend.className = 'carry-legend'; host.append(legend); }
  legend.textContent = view.label;
  legend.title = view.explanation;
  legend.setAttribute('aria-label', `${view.label}。${view.explanation}`);
}

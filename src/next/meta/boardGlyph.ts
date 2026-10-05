import type {BoardSkillId} from '../core/types.ts';

// 日本語: 盤面スキルの対象形と効果を、5×4の小さな盤で図解する。表示専用で、ルール判定には使わない。
// English: A presentation-only 5×4 diagram of each board skill's target shape and effect. Never used for rules.

type Owner = 'own' | 'enemy' | 'any';
type Effect = 'remove' | 'convert' | 'frozen' | 'poison' | 'deadly' | 'thorn' | 'shiny' | 'rubble' | 'normal' | 'brand';
interface Glyph { cells: Array<[col: number, row: number]>; owner: Owner; effect: Effect; label: string; note?: 'row' | 'random' | 'next' | 'hp' }

const g = (cells: Array<[number, number]>, owner: Owner, effect: Effect, label: string, note?: Glyph['note']): Glyph => ({cells, owner, effect, label, ...(note ? {note} : {})});

// 日本語: 列0〜4、行0（上）〜3（下）。English: columns 0–4, rows 0 (top) to 3 (bottom).
const glyphs: Record<BoardSkillId, Glyph> = {
  'pain-shared': g([[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], 'any', 'remove', '横一列を消去', 'row'),
  ember: g([[1, 1], [3, 2], [0, 3]], 'enemy', 'convert', '敵箱をランダムに占領', 'random'),
  'imashiru-insight': g([[2, 0]], 'own', 'shiny', '次の投入を輝きに', 'next'),
  'imashiru-focus': g([[2, 2]], 'own', 'shiny', '自箱1個を輝きへ'),
  'imashiru-polish': g([[1, 2], [2, 2]], 'own', 'shiny', '横2個を輝きへ'),
  'imashiru-reset': g([[2, 2]], 'any', 'normal', '1個を通常へ戻す'),
  'mint-observe': g([[1, 1], [1, 2], [2, 2]], 'any', 'remove', 'L形3箱を消す'),
  'mint-diagonal': g([[1, 1], [2, 2], [3, 3]], 'any', 'remove', '斜め3箱を消す'),
  'mint-frame': g([[1, 1], [2, 1], [1, 2], [2, 2]], 'any', 'remove', '2×2を消す'),
  'rose-slice': g([[1, 2], [2, 2], [3, 2]], 'any', 'remove', '横3箱を消す'),
  'rose-longcut': g([[0, 2], [1, 2], [2, 2], [3, 2]], 'any', 'remove', '横4箱を消す'),
  'rose-twincut': g([[2, 1], [2, 2]], 'any', 'remove', '縦2箱を消す'),
  'blue-crosscut': g([[2, 0], [1, 1], [2, 1], [3, 1], [2, 2]], 'any', 'remove', '十字5箱を消す'),
  'blue-plumb': g([[2, 1], [2, 2], [2, 3]], 'any', 'remove', '縦3箱を消す'),
  'blue-freeze': g([[2, 2]], 'enemy', 'frozen', '敵箱1個を凍結'),
  'silver-freeze': g([[2, 1], [2, 2]], 'enemy', 'frozen', '列の上から2個を凍結'),
  'silver-frostbind': g([[1, 1], [2, 2]], 'enemy', 'frozen', '斜め2個を凍結'),
  'silver-thornwall': g([[1, 3], [2, 3]], 'own', 'thorn', '自箱2個をトゲへ'),
  'amber-convert': g([[2, 2]], 'enemy', 'convert', '敵箱1個を占領'),
  'amber-squarepress': g([[1, 2], [2, 2], [1, 3], [2, 3]], 'enemy', 'convert', '2×2の敵箱を占領'),
  'amber-rubble': g([[2, 2]], 'enemy', 'rubble', '敵箱1個をガレキへ'),
  'red-capture': g([[2, 2]], 'enemy', 'convert', 'HPを払い1個占領', 'hp'),
  'red-frontline': g([[1, 2], [2, 2]], 'enemy', 'convert', 'HPを払い横2個を占領', 'hp'),
  'red-brand': g([[2, 2]], 'enemy', 'brand', 'HPを払い占領してトゲへ', 'hp'),
  'violet-poison': g([[2, 2]], 'enemy', 'poison', '敵箱1個をどくへ'),
  'violet-sting': g([[1, 2], [2, 2]], 'enemy', 'poison', '横2個をどくへ'),
  'violet-venom': g([[2, 2]], 'enemy', 'deadly', 'どくをげきどくへ'),
};

const CELL = 14, GAP = 3, PAD = 6, COLS = 5, ROWS = 4;
const W = PAD * 2 + COLS * CELL + (COLS - 1) * GAP, H = PAD * 2 + ROWS * CELL + (ROWS - 1) * GAP;
const xy = (c: number, r: number) => [PAD + c * (CELL + GAP), PAD + r * (CELL + GAP)] as const;

function mark(effect: Effect, x: number, y: number): string {
  const cx = x + CELL / 2, cy = y + CELL / 2;
  switch (effect) {
    case 'remove': return `<path class="bg-x" d="M${cx - 3.5} ${cy - 3.5}l7 7M${cx + 3.5} ${cy - 3.5}l-7 7"/>`;
    case 'frozen': return `<path class="bg-ice" d="M${cx} ${cy - 4.5}v9M${cx - 3.9} ${cy - 2.25}l7.8 4.5M${cx - 3.9} ${cy + 2.25}l7.8-4.5"/>`;
    case 'poison': return `<path class="bg-venom" d="M${cx} ${cy - 4.5}c2.6 3.2 3.6 4.6 3.6 6.1a3.6 3.6 0 0 1-7.2 0c0-1.5 1-2.9 3.6-6.1z"/>`;
    case 'deadly': return `<path class="bg-venom is-deadly" d="M${cx - 2} ${cy - 4.5}c2 2.6 2.8 3.6 2.8 4.8a2.8 2.8 0 0 1-5.6 0c0-1.2.8-2.2 2.8-4.8zM${cx + 2.4} ${cy - 1.5}c1.6 2 2.2 2.8 2.2 3.8a2.2 2.2 0 0 1-4.4 0c0-1 .6-1.8 2.2-3.8z"/>`;
    case 'thorn': case 'brand': return `<path class="bg-thorn" d="M${x + 2} ${y + CELL - 2}l2.4-6 2.4 6 2.4-6 2.4 6"/>`;
    case 'shiny': return `<path class="bg-shine" d="M${cx} ${cy - 5}l1.4 3.6 3.6 1.4-3.6 1.4L${cx} ${cy + 5}l-1.4-3.6-3.6-1.4 3.6-1.4z"/>`;
    case 'rubble': return `<path class="bg-rubble" d="M${x + 3} ${y + 4}l3 3-1.5 3M${x + 6} ${y + 7}l4-2 1 4"/>`;
    case 'normal': return `<circle class="bg-reset" cx="${cx}" cy="${cy}" r="3.2"/>`;
    case 'convert': return '';
  }
}

/** 日本語: aria-hiddenのSVG。説明文は隣のテキストが担う。English: Decorative SVG; adjacent text carries the meaning. */
export function boardGlyph(id: BoardSkillId): string {
  const d = glyphs[id];
  if (!d) return '';
  const target = new Set(d.cells.map(([c, r]) => `${c},${r}`));
  let base = '', marks = '';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const [x, y] = xy(c, r);
    if (target.has(`${c},${r}`)) {
      const ownerClass = `bg-${d.owner}`;
      if (d.effect === 'convert' || d.effect === 'brand') {
        // 日本語: 斜めに分けて「敵→自分」を示す。English: Diagonal split shows enemy becoming own.
        base += `<rect class="bg-cell bg-enemy" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"/><path class="bg-own" d="M${x + CELL} ${y}v${CELL}h-${CELL}z"/><rect class="bg-outline" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"/>`;
      } else if (d.effect === 'remove') {
        base += `<rect class="bg-cell bg-target-remove" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"/>`;
      } else {
        base += `<rect class="bg-cell ${ownerClass} bg-target" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"/>`;
      }
      marks += mark(d.effect, x, y);
    } else {
      const filled = r >= 2 || (r === 1 && (c + r) % 2 === 0);
      base += `<rect class="bg-cell ${filled ? 'bg-idle' : 'bg-empty'}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"/>`;
    }
  }
  if (d.note === 'row') {
    const [, y] = xy(0, 2);
    marks += `<path class="bg-arrow" d="M${W - 2} ${y + CELL / 2}h-3m3 0-2-2m2 2-2 2"/>`;
  }
  if (d.note === 'next') {
    const [x] = xy(2, 0);
    marks += `<path class="bg-arrow" d="M${x + CELL / 2} 1v4m0 0-2-2m2 2 2-2"/>`;
  }
  const corner = `<path class="bg-corner" d="M1 6V1h5M${W - 6} 1h5v5M${W - 1} ${H - 6}v5h-5M6 ${H - 1}H1v-5"/>`;
  return `<svg class="board-glyph-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">${corner}${base}${marks}</svg>`;
}

export function boardGlyphLabel(id: BoardSkillId): string { return glyphs[id]?.label ?? ''; }
export function boardGlyphNote(id: BoardSkillId): Glyph['note'] | undefined { return glyphs[id]?.note; }

import { cornerPattern, plusPattern, squarePattern, tPattern, zigzagPattern, cupPattern, diamondPattern, crossPattern, rescueKitPattern } from './shapePatterns.ts';
import type { ShapePattern } from './shapePatterns.ts';
import { defaultTuning } from './tuning.ts';
import type { GameTuning } from './tuning.ts';
import { freeze } from './immutable.ts';
import type { NormalSkillId } from './types.ts';
export type SkillRewardAccess = 'shared' | 'starter-upgrade-only' | 'never' | 'trophy';
export interface SkillDefinition { readonly id: NormalSkillId; readonly name: string; readonly kind: 'shape' | 'link' | 'passive' | 'instant'; readonly pattern?: ShapePattern; readonly upgradeable?: boolean; readonly rewardAccess?: SkillRewardAccess }
export const skillCatalog: Readonly<Record<NormalSkillId, SkillDefinition>> = freeze({
  'rescue-kit': {id:'rescue-kit',name:'救急箱',kind:'shape',pattern:rescueKitPattern,rewardAccess:'trophy',upgradeable:false},
  'heavy-swing': {id:'heavy-swing',name:'大振り攻撃',kind:'link',rewardAccess:'trophy'},
  'clear-column': {id:'clear-column',name:'澄んだ支柱',kind:'link',rewardAccess:'trophy'},
  'pincer-strike': {id:'pincer-strike',name:'挟撃',kind:'link',rewardAccess:'trophy'},
  'twin-diagonal': {id:'twin-diagonal',name:'双斜線',kind:'link',rewardAccess:'trophy'},
  'square-conduit': {id:'square-conduit',name:'方陣連結',kind:'link',rewardAccess:'trophy'},
  'venom-edge': {id:'venom-edge',name:'毒際攻め',kind:'link',rewardAccess:'trophy'},
  'frost-edge': {id:'frost-edge',name:'氷際攻め',kind:'link',rewardAccess:'trophy'},
  'exact-four': {id:'exact-four',name:'四拍子',kind:'link',rewardAccess:'trophy'},
  'shiny-relay': {id:'shiny-relay',name:'輝き継ぎ',kind:'link',rewardAccess:'trophy'},
  't-strike':{id:'t-strike',name:'T字打ち',kind:'shape',pattern:tPattern},
  'zigzag-strike':{id:'zigzag-strike',name:'稲妻打ち',kind:'shape',pattern:zigzagPattern},
  'cup-strike':{id:'cup-strike',name:'コの字打ち',kind:'shape',pattern:cupPattern},
  'diamond-strike':{id:'diamond-strike',name:'ひし形打ち',kind:'shape',pattern:diamondPattern},
  'cross-strike':{id:'cross-strike',name:'X字打ち',kind:'shape',pattern:crossPattern},
  'full-power':{id:'full-power',name:'フルパワー',kind:'link'},
  foundation:{id:'foundation',name:'縁の下の力持ち',kind:'link'},
  'snake-line':{id:'snake-line',name:'長蛇の列',kind:'link'},
  'edge-strike':{id:'edge-strike',name:'端攻め',kind:'link'},
  siege:{id:'siege',name:'包囲攻撃',kind:'link'},
  crossfire:{id:'crossfire',name:'交差砲火',kind:'link'},
  'last-stand':{id:'last-stand',name:'背水の陣',kind:'link'},
  'iron-wall':{id:'iron-wall',name:'鉄壁',kind:'passive'},
  capacitor:{id:'capacitor',name:'充填カプセル',kind:'instant'},
  solvent:{id:'solvent',name:'浄化溶剤',kind:'instant'},
  'poison-craft':{id:'poison-craft',name:'毒盛り術',kind:'passive',rewardAccess:'never'},
  health: { id: 'health', name: 'ヘルス', kind: 'shape', pattern: plusPattern, rewardAccess: 'starter-upgrade-only' },
  'grow-fire': { id: 'grow-fire', name: '成長する火', kind: 'link' },
  charge: { id: 'charge', name: '蓄勢', kind: 'passive' },
  'first-guard': { id: 'first-guard', name: '初撃の守り', kind: 'passive' },
  'horizontal-slash': { id: 'horizontal-slash', name: '横薙ぎ', kind: 'link' },
  'diagonal-shot': { id: 'diagonal-shot', name: '斜め撃ち', kind: 'link' },
  'corner-strike': { id: 'corner-strike', name: '角打ち', kind: 'shape', pattern: cornerPattern },
  'square-strike': { id: 'square-strike', name: '四角打ち', kind: 'shape', pattern: squarePattern },
  'healing-potion': { id: 'healing-potion', name: '回復ポーション', kind: 'instant' },
  'magic-bullet': { id: 'magic-bullet', name: '魔法弾', kind: 'instant' },
});
export const characterTrophySkillIds = freeze({blue:'clear-column',red:'pincer-strike',mint:'twin-diagonal',amber:'square-conduit',violet:'venom-edge',silver:'frost-edge',rose:'exact-four',imashiru:'shiny-relay'} as const);
export const trophySkillIds = freeze(['heavy-swing','rescue-kit',...Object.values(characterTrophySkillIds)] as const);
/** Stable pre-expansion draw order for unversioned trial and saved runs. */
export const legacyNormalSkillIds: readonly NormalSkillId[] = ['poison-craft','health','grow-fire','charge','first-guard','horizontal-slash','diagonal-shot','corner-strike','square-strike','healing-potion','magic-bullet'];
export const normalSkillIds = [...legacyNormalSkillIds,...(Object.keys(skillCatalog) as NormalSkillId[]).filter(id=>!legacyNormalSkillIds.includes(id))];
export function skillName(id: NormalSkillId, rank: 1 | 2): string { return skillCatalog[id].name + (rank === 2 && skillCatalog[id].upgradeable !== false ? '＋' : ''); }
export function skillValue(id: NormalSkillId, rank: 1 | 2, tuning: GameTuning = defaultTuning): number { return id==='poison-craft'?1:(tuning.skills[id] ?? defaultTuning.skills[id])![rank - 1]!; }
export function skillDescription(id: NormalSkillId, rank: 1 | 2, tuning: GameTuning = defaultTuning): string {
  const n = skillValue(id, rank, tuning);
  switch (id) {
    case 'heavy-swing': return `5個以上の各リンクに現在の5リンク基礎火力×${n / 100}を加算（端数切捨て）`;
    case 'rescue-kit': return '上段は自箱・任意・自箱／下段は自箱3個でHP10回復・向き固定・強化なし';
    case 'clear-column': return `投入列に箱が3個以上あり全て自箱なら各リンク火力＋${n}`;
    case 'pincer-strike': return `投入箱と自箱で上下左右の敵箱1個を挟むと各リンク火力＋${n}（重複しない）`;
    case 'twin-diagonal': return `同時に両方の斜め3リンク以上が成立すると各リンク火力＋${n}`;
    case 'square-conduit': return `現在の自箱2×2に接続する各リンク火力＋${n}（1箱以上共有・重複しない）`;
    case 'venom-edge': return `投入箱の上下左右にどく・げきどくの敵箱があれば各リンク火力＋${n}（重複しない）`;
    case 'frost-edge': return `投入箱の上下左右にフローズン・絶対零度の敵箱があれば各リンク火力＋${n}（重複しない）`;
    case 'exact-four': return `ちょうど4個の各リンク火力＋${n}`;
    case 'shiny-relay': return `輝き箱2個以上を含む各リンク火力＋${n}（輝き倍率の前に加算）`;
    case 't-strike': return `自箱4個のT字で${n}ダメージ・回転可`;
    case 'zigzag-strike': return `自箱4個の稲妻形で${n}ダメージ・回転可（鏡像は別）`;
    case 'cup-strike': return `自箱5個のコの字で${n}ダメージ・回転可`;
    case 'diamond-strike': return `自箱4個のひし形で${n}ダメージ（中央は不要）`;
    case 'cross-strike': return `自箱5個のX字で${n}ダメージ`;
    case 'full-power': return `投入後HP満タンなら各リンク火力＋${n}`;
    case 'foundation': return `最下段の自箱1個につき各リンク火力＋${n}（内部足場は対象外）`;
    case 'snake-line': return `5個以上の各リンク火力＋${n}`;
    case 'edge-strike': return `左端か右端を含む各リンク火力＋${n}`;
    case 'siege': return `投入箱に上下左右で接する敵箱1個につき各リンク火力＋${n}`;
    case 'crossfire': return `同時に2軸以上の3リンクが成立すると各リンク火力＋${n}`;
    case 'last-stand': return `投入後HP半分以下なら各リンク火力＋${n}`;
    case 'iron-wall': return `現在の自箱2×2があれば敵の各リンク被害−${n}（毒・固定攻撃は対象外）`;
    case 'capacitor': return `ゲージ＋${n}（上限まで）・1回限り・1手消費`;
    case 'solvent': return `上・左から自箱のどく・もうどく・フローズンを最大${n}個ノーマルへ・1回限り・1手消費`;
    case 'poison-craft': return '現在の自箱2×2の数だけ自分が付与したどく・もうどく1箱あたりのダメージ＋1（常時・累積しない）';
    case 'health': return `＋形でHP${n}回復`;
    case 'grow-fire': return `縦3以上：3リンク火力＋${n}成長＋${tuning.links.growFireGrowth}`;
    case 'charge': return `手番終了のゲージ獲得を合計${n + tuning.gauge.turnGain}にする`;
    case 'first-guard': return `敵手番の最初のリンク被害−${n}`;
    case 'horizontal-slash': return `横3以上のリンク火力＋${n}`;
    case 'diagonal-shot': return `斜め3以上のリンク火力＋${n}`;
    case 'corner-strike': return `L形で${n}ダメージ・回転可`;
    case 'square-strike': return `2×2で${n}ダメージ・回転可`;
    case 'healing-potion': return `HP${n}回復・1回限り・1手消費`;
    case 'magic-bullet': return `現在の4リンク火力×${n}・1回限り・1手消費`;
  }
}

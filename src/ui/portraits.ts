/** 日本語: 元画像は切らず、表示枠側の拡大率と左右の基準点だけを個別に持つ。
 * English: Preserve full source images; framing is a cosmetic, per-character display choice. */
export const playerPortraits = {
  blue: {
    label: '青の子',
    alt: '青い髪のキャラクター。アイスを持った上半身',
    src: new URL('../assets/characters/blue.png', import.meta.url).href,
    height: '205%', anchorX: '44%', top: '2%',
  },
  red: {
    label: '赤の子',
    alt: '赤い髪のキャラクター。両手でアイスを持った上半身',
    src: new URL('../assets/characters/red.png', import.meta.url).href,
    height: '202%', anchorX: '50%', top: '2%',
  },
} as const;

export type PlayerPortraitId = keyof typeof playerPortraits;
export function resolvePlayerPortrait(id: string): PlayerPortraitId {
  return id === 'red' ? 'red' : 'blue';
}

export const monsterPortrait = {
  alt: 'メラルン。頭上の稲妻を含む全身',
  src: new URL('../assets/characters/merarun.png', import.meta.url).href,
} as const;

// 日本語: 追加の敵画像は提供された背景付き原本をそのまま使う。
// English: New enemy portraits retain the supplied source pixels and solid backgrounds.
export const enemyPortraits = {
  marujiro: { label: 'マルジロ', alt: 'マルジロ。高い甲羅を持つモンスター', src: new URL('../assets/characters/marujiro.png', import.meta.url).href },
  hikikizan: { label: 'ヒキキザン', alt: 'ヒキキザン。葉の剣を持つモンスター', src: new URL('../assets/characters/hikikizan.png', import.meta.url).href },
  nigirin: { label: 'ニギリン', alt: 'ニギリン。葉に包まれたおにぎりのモンスター', src: new URL('../assets/characters/nigirin.png', import.meta.url).href },
  merarun: { label: 'メラルン', ...monsterPortrait },
} as const;

/** User-provided transformation portraits are displayed whole without source-pixel editing. */
export const transformedPortraits = {
  blue: { ...playerPortraits.blue, alt: '変化した青の子。青髪のメイド姿', src: new URL('../assets/characters/blue-transformed.png', import.meta.url).href },
  red: { ...playerPortraits.red, alt: '変化した赤の子。赤髪のメイド姿', src: new URL('../assets/characters/red-transformed.png', import.meta.url).href },
} as const;

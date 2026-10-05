import { enemyPortraits as originals, playerPortraits as originalPlayers, transformedPortraits as originalTransformations } from '../ui/portraits.ts';
/** 日本語: nextの全身表示に説明を合わせ、旧版の表示用データは変更しない。
 * English: Full-body display in next uses full-body descriptions; legacy framing metadata stays unchanged. */
export const playerPortraits = {
  blue: { ...originalPlayers.blue, alt: '青い髪のキャラクター。アイスを持った座り姿の全身' },
  red: { ...originalPlayers.red, alt: '赤い髪のキャラクター。両手でアイスを持った座り姿の全身' },
} as const;
/** 日本語: 承認済みの透過WebPをnextだけで使い、旧PNGと旧版の参照は保つ。
 * English: Approved transparent portraits override only next; original PNGs remain for legacy routes. */
export const enemyPortraits = {
  ...originals,
  devilmon: {label:'デビルモン',alt:'紫の翼と角、星の印を持つデビルモン',src:new URL('./assets/monsters/devilmon-transparent.webp',import.meta.url).href},
  hyokuru: {label:'ヒョクル',alt:'青いマフラーを巻き、氷のそりに乗ったペンギン、ヒョクル',src:new URL('./assets/monsters/hyokuru-transparent.webp',import.meta.url).href},
  hanabell: {label:'ハナベル',alt:'桃色のつぼみと黄色い鐘、つるを持つ花、ハナベル',src:new URL('./assets/monsters/hanabell-transparent.webp',import.meta.url).href},
  'zeroguard-x': {label:'ゼロガード・X',alt:'黒い石の装甲と大盾を持つ巨人、ゼロガード・X',src:new URL('./assets/monsters/zeroguard-x-transparent.webp',import.meta.url).href},
  hoshimimi: {label:'ホシミミ',alt:'耳先に星を付けた紫のうさぎ、ホシミミ',src:new URL('./assets/monsters/hoshimimi-transparent.webp',import.meta.url).href},
  mokousagi: {label:'モコウサギ',alt:'クリーム色と桃色のもこもこうさぎ、モコウサギ',src:new URL('./assets/monsters/mokousagi-transparent.webp',import.meta.url).href},
  hinobou: {label:'ヒノボウ',alt:'頭と尾に炎をともしたオレンジの子、ヒノボウ',src:new URL('./assets/monsters/hinobou-transparent.webp',import.meta.url).href},
  'tutorial-star': {label:'チュートリアル星人',alt:'紫と白の歯のような姿をした練習相手、チュートリアル星人',src:new URL('./assets/monsters/tutorial-star.svg',import.meta.url).href},
  biribiriman: {label:'ビリビリマン',alt:'稲妻をまとった黄色い拳闘家、ビリビリマン',src:new URL('./assets/monsters/biribiriman-transparent.webp',import.meta.url).href},
  shashark: {label:'シャシャーク',alt:'青緑の水の輪をまとったサメ、シャシャーク',src:new URL('./assets/monsters/shashark-transparent.webp',import.meta.url).href},
  'twin-core': {label:'ツインコア',alt:'二つの核を持つツインコア',src:new URL('./assets/monsters/twin-core.webp',import.meta.url).href},
  'needle-core': {label:'ニードルコア',alt:'細長い槍状のニードルコア',src:new URL('./assets/monsters/needle-core.webp',import.meta.url).href},
  'frost-core': {label:'フロストコア',alt:'氷の結晶を持つフロストコア',src:new URL('./assets/monsters/frost-core.webp',import.meta.url).href},
  'thorn-core': {label:'ソーンコア',alt:'トゲを持つソーンコア',src:new URL('./assets/monsters/thorn-core.webp',import.meta.url).href},
  'rime-crown': {label:'ライムクラウン',alt:'氷の冠を持つライムクラウン',src:new URL('./assets/monsters/rime-crown.webp',import.meta.url).href},
  'briar-wheel': {label:'ブライアホイール',alt:'トゲの車輪型ブライアホイール',src:new URL('./assets/monsters/briar-wheel.webp',import.meta.url).href},
  marujiro: { ...originals.marujiro, src: new URL('./assets/marujiro-transparent.webp',import.meta.url).href },
  hikikizan: { ...originals.hikikizan, src: new URL('./assets/hikikizan-transparent.webp',import.meta.url).href },
  nigirin: { ...originals.nigirin, src: new URL('./assets/nigirin-transparent.webp',import.meta.url).href },
  'speed-core': { label: 'スピードコア', alt: '青紫の飛行コア型の中ボス、スピードコア', src: new URL('./assets/speed-core-transparent.webp',import.meta.url).href },
  'mother-core': { label: 'マザーコア', alt: '青紫の大型人型ボス、マザーコア', src: new URL('./assets/mother-core-transparent.webp',import.meta.url).href },
} as const;

/** 日本語: ユーザー採用の全身原画。旧変化後PNGは旧版のため保持する。
 * English: Use the approved full-body originals only in next; preserve legacy transformation PNGs. */
export const transformedPortraits = {
  blue: { ...originalTransformations.blue, alt: '変化した青の子。プリズムの賢者、全身', src: new URL('./assets/blue-transformed-prism-oracle.webp',import.meta.url).href },
  red: { ...originalTransformations.red, alt: '変化した赤の子。炎メイド、全身', src: new URL('./assets/red-transformed-solar-flame-maid.webp',import.meta.url).href },
} as const;

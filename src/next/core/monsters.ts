import { defaultTuning } from './tuning.ts';
import type { GameTuning } from './tuning.ts';
import { freeze } from './immutable.ts';
import type { EnemyId, EnemyDefinition } from './types.ts';
/** 日本語: モンスター定義は出現階層を持たない。English: Reusable monsters never own stage ranges. */
export const enemyDefinitions: Readonly<Record<EnemyId, EnemyDefinition>> = freeze({
  devilmon: { id:'devilmon', label:'デビルモン', ...defaultTuning.enemies.devilmon },
  shashark: { id:'shashark', label:'シャシャーク', ...defaultTuning.enemies.shashark },
  biribiriman: { id:'biribiriman', label:'ビリビリマン', ...defaultTuning.enemies.biribiriman },
  hyokuru: { id:'hyokuru', label:'ヒョクル', ...defaultTuning.enemies.hyokuru },
  hanabell: { id:'hanabell', label:'ハナベル', ...defaultTuning.enemies.hanabell },
  'zeroguard-x': { id:'zeroguard-x', label:'ゼロガード・X', ...defaultTuning.enemies['zeroguard-x'] },
  hoshimimi: { id:'hoshimimi', label:'ホシミミ', ...defaultTuning.enemies.hoshimimi },
  mokousagi: { id:'mokousagi', label:'モコウサギ', ...defaultTuning.enemies.mokousagi },
  hinobou: { id:'hinobou', label:'ヒノボウ', ...defaultTuning.enemies.hinobou },
  'tutorial-star': { id:'tutorial-star', label:'チュートリアル星人', ...defaultTuning.enemies['tutorial-star'] },
  'twin-core': { id:'twin-core', label:'ツインコア', ...defaultTuning.enemies['twin-core'] },
  'needle-core': { id:'needle-core', label:'ニードルコア', ...defaultTuning.enemies['needle-core'] },
  'frost-core': { id:'frost-core', label:'フロストコア', ...defaultTuning.enemies['frost-core'] },
  'thorn-core': { id:'thorn-core', label:'ソーンコア', ...defaultTuning.enemies['thorn-core'] },
  'rime-crown': { id:'rime-crown', label:'ライムクラウン', ...defaultTuning.enemies['rime-crown'] },
  'briar-wheel': { id:'briar-wheel', label:'ブライアホイール', ...defaultTuning.enemies['briar-wheel'] },
  marujiro: { id: 'marujiro', label: 'マルジロ', ...defaultTuning.enemies.marujiro },
  hikikizan: { id: 'hikikizan', label: 'ヒキキザン', ...defaultTuning.enemies.hikikizan },
  nigirin: { id: 'nigirin', label: 'ニギリン', ...defaultTuning.enemies.nigirin },
  merarun: { id: 'merarun', label: 'メラルン', ...defaultTuning.enemies.merarun },
  'speed-core': { id: 'speed-core', label: 'スピードコア', ...defaultTuning.enemies['speed-core'] },
  'mother-core': { id: 'mother-core', label: 'マザーコア', ...defaultTuning.enemies['mother-core'] },
});
export function getEnemyDefinition(id: EnemyId, tuning: GameTuning = defaultTuning): EnemyDefinition { return freeze({ id, label: enemyDefinitions[id].label, ...(tuning.enemies[id] ?? defaultTuning.enemies[id]), attacks: { ...(tuning.enemies[id] ?? defaultTuning.enemies[id]).attacks } }); }
export const enemyRoster: readonly EnemyId[] = freeze(Object.keys(enemyDefinitions) as EnemyId[]);


import { selectEncounter } from './encounters.ts';
import type { EncounterVersion } from './encounters.ts';
import { getEnemyDefinition } from '../core/definitions.ts';
import { defaultTuning } from '../core/tuning.ts';
import type { GameTuning } from '../core/tuning.ts';
import { freeze } from '../core/immutable.ts';
import type { EnemyId } from '../core/types.ts';

export const endlessRoster = ['marujiro', 'hikikizan', 'nigirin'] as const;
/** 日本語: 進行順と難度計算は戦闘・継承から独立。選択した開始点から循環する。
 * English: Route and difficulty are pure progression data, independent of combat or carry. */
export function endlessEncounter(stage: number, first: EnemyId = 'marujiro', tuning: GameTuning = defaultTuning): { enemyId: EnemyId; maxHp: number } {
  if (!Number.isSafeInteger(stage) || stage < 1) throw new Error('Stage must be a positive safe integer');
  const start = endlessRoster.indexOf(first as typeof endlessRoster[number]);
  // The standalone Merarun lab remains a one-enemy cycle when explicitly selected.
  const enemyId = start < 0 ? first : endlessRoster[(start + (stage - 1) % endlessRoster.length) % endlessRoster.length]!;
  const maxHp = getEnemyDefinition(enemyId, tuning).maxHp + (stage - 1) * tuning.progression.hpPerStage;
  if (!Number.isSafeInteger(maxHp)) throw new Error('Enemy HP exceeded exact integer range');
  return freeze({ enemyId, maxHp });
}

export interface LoopEncounter { readonly stage: number; readonly localStage: number; readonly loopIndex: number; readonly enemyId: EnemyId; readonly baseMaxHp: number; readonly firstLoopMaxHp: number; readonly maxHp: number; readonly hpMultiplier: number; readonly attacks: Readonly<Record<3|4|5,number>>; readonly fixedDamageBonus: number }
/** 日本語: 1周目の同じ位置へ倍率を適用。絶対ステージ成長を重ねない。
 * English: Scale the first-loop encounter at the same local stage; never double-count absolute stage growth. */
export function bossLoopEncounter(stage: number, first: EnemyId = 'marujiro', tuning: GameTuning = defaultTuning, selection?: {readonly version:EncounterVersion;readonly seed:number}): LoopEncounter {
  if(!Number.isSafeInteger(stage)||stage<1)throw new Error('Stage must be a positive safe integer');
  const rules=tuning.progression, loopIndex=Math.floor((stage-1)/rules.loopLength),localStage=(stage-1)%rules.loopLength+1;
  const start=Math.max(0,endlessRoster.indexOf(first as typeof endlessRoster[number]));
  const enemyId:EnemyId=selection?selectEncounter(stage,selection.seed,selection.version):localStage===25||localStage===40?'speed-core':localStage===50?'mother-core':endlessRoster[(start+localStage-1)%endlessRoster.length]!;
  const definition=getEnemyDefinition(enemyId,tuning);
  const firstLoopMaxHp=definition.maxHp+(localStage-1)*rules.hpPerStage;
  const hpMultiplier=1+loopIndex*rules.hpMultiplierStep;
  const maxHp=firstLoopMaxHp*hpMultiplier;
  const attacks={3:definition.attacks[3]+loopIndex*rules.attackPerLoop,4:definition.attacks[4]+loopIndex*rules.attackPerLoop,5:definition.attacks[5]+loopIndex*rules.attackPerLoop};
  const fixedDamageBonus=loopIndex*rules.fixedDamagePerLoop;
  if([firstLoopMaxHp,hpMultiplier,maxHp,fixedDamageBonus,...Object.values(attacks)].some(x=>!Number.isSafeInteger(x)))throw new Error('Loop stats exceeded exact integer range');
  return freeze({stage,localStage,loopIndex,enemyId,baseMaxHp:definition.maxHp,firstLoopMaxHp,maxHp,hpMultiplier,attacks,fixedDamageBonus});
}

import { createCharacterBattleConfig, defaultConfig, createTuning } from './core/index.ts';
import type { BattleConfig, CharacterId, EnemyId } from './core/types.ts';
/** 日本語: 今回の試作値を一箇所に集約。旧方式は引き続き選択可能。
 * English: Trial numbers are injected data; the original automatic strategy remains selectable. */
export const trialTuning = createTuning({ gauge: { bands: { 3: 2, 4: 4, 5: 6, sixPlus: 30 } }, rewards: { immediateHeal: 10, maxHp: 5, threePower: 1, fourPower: 2, fivePower: 3 } });
export function createTrialConfig(character: CharacterId = 'blue', enemy: EnemyId = 'marujiro', base: BattleConfig = defaultConfig, mode: 'manual' | 'automatic' = 'manual'): BattleConfig {
  const config = createCharacterBattleConfig(character, enemy, base);
  return { ...config, strategy: { transformation: mode === 'manual' ? 'manual-charge' : 'automatic-link', gauge: mode === 'manual' ? 'bands' : 'per-box' }, tuning: trialTuning };
}
export type TrialFixture = 'normal' | 'reward' | 'charged';
export function trialFixture(kind: TrialFixture, character: CharacterId, enemy: EnemyId, seed: number, mode: 'manual' | 'automatic'): BattleConfig {
  const base = { ...defaultConfig, seed };
  const config = createTrialConfig(character, enemy, base, mode);
  if (kind === 'charged') return { ...config, id: 'next-charged', title: 'ゲージ準備済み', initialGauge: character === 'blue' ? 80 : 100 };
  if (kind === 'reward') return { ...config, id: 'next-reward', title: '報酬直前', combatants: { ...config.combatants, player: { ...config.combatants.player, initialHp: 18 }, enemy: { ...config.combatants.enemy, initialHp: 1 } }, initialBoxes: [0, 1].map(col => ({ id: `fixture:${col}`, row: 7, col, owner: 'player', type: 'normal', status: 'normal' })) };
  return config;
}

import { bossLoopEncounter, endlessEncounter } from './app/progression.ts';
import type { BattleControllerOptions } from './app/BattleController.ts';
export type TrialSetupFixture = TrialFixture | 'speed-pulse' | 'mother-wait' | 'mother-double' | 'mother-critical';
export interface TrialSetup { readonly character:CharacterId;readonly firstEnemy:EnemyId;readonly seed:number;readonly mode:'manual'|'automatic';readonly stage:number;readonly fixture:TrialSetupFixture;readonly route:'standard'|'boss-loop';readonly encounterVersion?:'bands-v1'|'bands-v2'|'deep-v1'|'legacy-v0';readonly ending?:'clear50'|'deep100'|'legacy-endless' }
/** 日本語: 検証用ステージ/手番は開始設定でのみ指定。戦闘中の操作には混ぜない。
 * English: Test stage and phase seeds live only in setup, never in ordinary battle actions. */
export function prepareTrialSetup(setup:TrialSetup):{config:BattleConfig;options:BattleControllerOptions} {
  let stage=setup.stage;
  if(!Number.isSafeInteger(stage)||stage<1)throw new Error('ステージは1以上の整数にしてください');
  const local=(stage-1)%50+1;
  const bossFixture=setup.fixture.startsWith('speed-')||setup.fixture.startsWith('mother-');
  if(setup.fixture==='speed-pulse'&&local!==25&&local!==40)stage=25;
  if(setup.fixture.startsWith('mother-')&&local!==50)stage=50;
  const route=bossFixture?'boss-loop':setup.route;
  const ending=setup.ending??'clear50';
  if(ending!=='clear50'&&ending!=='deep100'&&ending!=='legacy-endless')throw new Error('ランの終了方式が不正です');
  if(ending==='clear50'&&stage>50)throw new Error('標準ランは50階で終了します。開始階は50以下にしてください');
  // 日本語: 深層は51〜100階の別ステージ。出現表は deep-v1 に固定。English: Deep is a separate 51–100 stage pinned to deep-v1.
  if(ending==='deep100'&&(stage<51||stage>100||route!=='boss-loop'))throw new Error('深層は51〜100階・ボス経路で開始してください');
  const encounterVersion=ending==='deep100'?'deep-v1':setup.encounterVersion==='legacy-v0'||ending==='legacy-endless'?undefined:setup.encounterVersion==='deep-v1'?'bands-v2':setup.encounterVersion??'bands-v2';
  const encounter=route==='boss-loop'?bossLoopEncounter(stage,setup.firstEnemy,trialTuning,encounterVersion?{version:encounterVersion,seed:setup.seed}:undefined):endlessEncounter(stage,setup.firstEnemy,trialTuning);
  const basic:TrialFixture=setup.fixture==='charged'||setup.fixture==='reward'?setup.fixture:'normal';
  const base=trialFixture(basic,setup.character,encounter.enemyId,setup.seed,setup.mode);
  const fixed='fixedDamageBonus'in encounter?encounter.fixedDamageBonus:0;
  const config:BattleConfig={...base,frozenRule:'half-melt-v1',enemyFixedDamageBonus:fixed,firstActor:bossFixture?'enemy':'player',initialEnemyTurnCount:setup.fixture==='speed-pulse'||setup.fixture==='mother-wait'?4:setup.fixture==='mother-double'?5:0,
    combatants:{...base.combatants,enemy:{...base.combatants.enemy,maxHp:encounter.maxHp,initialHp:basic==='reward'?1:setup.fixture==='mother-critical'?Math.max(1,Math.floor(encounter.maxHp*trialTuning.bosses.motherThresholdPercent/100)):encounter.maxHp,...('attacks'in encounter?{attacks:encounter.attacks}:{})}}};
  return {config,options:{run:{mode:'endless',rewards:true,rewardMode:'categories',...(route==='boss-loop'&&encounterVersion?{encounterVersion}:{}),route,startStage:stage,rotationStart:setup.firstEnemy,...(ending==='clear50'?{finishAtStage:50}:ending==='deep100'?{finishAtStage:100}:{})}}};
}

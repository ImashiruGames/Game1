// 日本語: UIはこの窓口だけを参照する。English: A compact public boundary for the UI and controller.
export type * from './types.ts';
export { createBattle, restartBattle, applyAction } from './battle.ts';
export { getDropOptions, generateDropCandidates, settleBoxes, isPlayable } from './board.ts';
export { calculateLinks } from './links.ts';
export { validateConfig } from './validation.ts';
export { defaultConfig, battleFixtures, characterSkills, enemyDefinitions, getEnemyDefinition, enemyRoster, createCharacterBattleConfig } from './definitions.ts';
export { getPlayerSkills, getAvailableBoardSkills, getRowSkillPreview, getEnemyIntent, findPlusShapes } from './skills.ts';

export { gaugeDefinition } from './gauge.ts';
export { needsTurnStart } from './turnLifecycle.ts';
export { carryTransformationState } from './transformations.ts';

export { createSkill, createPlayerBuild, buildSkills, skillRank, activeSkillValue, basePlayerPower, playerPower, acquireSkill, instantSlots } from './playerBuild.ts';
export { skillCatalog, normalSkillIds, skillName, skillValue, skillDescription } from './skillCatalog.ts';

export { defaultTuning, createTuning, tuningOf } from './tuning.ts';
export type { GameTuning, TuningOverrides } from './tuning.ts';

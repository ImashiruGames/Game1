import {violetProtected} from './characterRevision.ts';
import {isKitBoard,canUseKitBoard,resolveKitBoard} from './kitBoards.ts';
import {settleBoxTypes,resolvePoisonTurnEnd} from './boxTypes.ts';
import {starterFor} from '../meta/kits.ts';
import { createSkill } from './playerBuild.ts';
import { resolveEnemySequence } from './enemySequence.ts';
import { tuningOf } from './tuning.ts';
import { createPlayerBuild, instantSlots } from './playerBuild.ts';
import { resolveInstantSkill } from './instantSkills.ts';
import { resolveActiveDrop } from './activeDrop.ts';
import { getDropOptions } from './board.ts';
import { resolveBoardSkill } from './boardSkills.ts';
import { defaultConfig } from './definitions.ts';
import { applyHealingEffect } from './effectDispatcher.ts';
import { gainGauge, gaugeDefinition } from './gauge.ts';
import { freeze } from './immutable.ts';
import { sampleUniformIndex } from './random.ts';
import { getAvailableBoardSkills, getEnemyIntent, getRowSkillPreview } from './skills.ts';
import { completePlayerTurn, canManualTransform, activateManualTransformation } from './transformations.ts';
import { needsTurnStart, resolveTurnStart } from './turnLifecycle.ts';
import { validateConfig } from './validation.ts';
import type { ActionResult, BattleAction, BattleConfig, BattleEvent, BattleResult, BattleState,
  BattleTransition, DropOption, Link, RejectionReason } from './types.ts';

export function createBattle(config: BattleConfig = defaultConfig): BattleState {
  validateConfig(config);
  const snapshot = structuredClone(config);
  const gauge = gaugeDefinition(snapshot.characterId, tuningOf(snapshot));
  return freeze({
    config: snapshot, boxes: snapshot.initialBoxes,
    hp: { player: { current: snapshot.combatants.player.initialHp, max: snapshot.combatants.player.maxHp },
      enemy: { current: snapshot.combatants.enemy.initialHp, max: snapshot.combatants.enemy.maxHp } },
    ...(snapshot.enemyId === 'mother-core' ? { enemyPhase: { phase: 'normal' as const, completedTurns: snapshot.initialEnemyTurnCount ?? 0 } } : {}),
    actor: snapshot.firstActor, turn: 1, enemyPatternIndex: 0, enemyTurnCount: snapshot.initialEnemyTurnCount ?? 0, link3Growth: 0, rngState: snapshot.seed,
    build: snapshot.initialBuild ?? (snapshot.meta ? {fixed:createSkill(starterFor(snapshot)),slots:Array(snapshot.meta.slots).fill(null) as unknown as import('./types.ts').PlayerBuild['slots'],power:{3:0,4:0,5:0}} : snapshot.characterId && !snapshot.playerSkills ? createPlayerBuild(snapshot.characterId) : null),
    gauge: gauge ? snapshot.initialGauge ?? 0 : 0,
    transformation: (snapshot.initialTransformation?.character === snapshot.characterId||snapshot.initialTransformation?.character==='imashiru'&&snapshot.meta?.rosterId==='imashiru'||snapshot.meta?.kitVersion===2&&snapshot.initialTransformation?.character===snapshot.meta.rosterId) ? snapshot.initialTransformation ?? null : null,
    playerTurnStarted: false, nextBoxId: 1, result: null,
  });
}
/** A full restart restores original lab seeds, not the preceding run's carry. */
export function restartBattle(state: BattleState): BattleState { return createBattle(state.config); }
function reject(state: BattleState, reason: RejectionReason): ActionResult {
  return freeze({ accepted: false, state, reason, resolution: null });
}

/** 日本語: 判定境界は入力検証→合成した効果→整理→手番終了。描画や時間に依存しない。
 * English: Validate, compose effects, settle, then finish the turn; never depend on UI timing. */
export function applyAction(initial: BattleState, action: BattleAction): ActionResult {
  if (initial.result) return reject(initial, 'battle-ended');
  if (!['drop', 'board-skill', 'skip', 'enemy', 'start-turn', 'instant-skill', 'transform'].includes(action.type)) return reject(initial, 'unknown-action');
  if ((initial.actor === 'player' && action.type === 'enemy') || (initial.actor === 'enemy' && action.type !== 'enemy')) return reject(initial, 'wrong-actor');
  if (action.type === 'start-turn' && !needsTurnStart(initial)) return reject(initial, 'turn-start-unavailable');
  if (action.type !== 'start-turn' && needsTurnStart(initial)) return reject(initial, 'turn-start-required');
  if (action.type === 'transform') {
    if (!canManualTransform(initial)) return reject(initial, 'transformation-unavailable');
    const step = activateManualTransformation(initial);
    return freeze({ accepted: true, state: step.state, resolution: { actor: 'player', originBoxId: null, links: [], enemyPlannedAction: null, events: step.events } });
  }
  const options = getDropOptions(initial);
  const legal = options.filter(option => option.available);
  let selected: DropOption | undefined;
  if (action.type === 'drop') {
    selected = options.find(option => option.id === action.candidateId);
    if (!selected) return reject(initial, 'unknown-candidate');
    if (!selected.available) return reject(initial, 'blocked-spawn');
  }
  if (action.type === 'board-skill') {
    if (!isKitBoard(action.skillId)&&!['pain-shared', 'ember','imashiru-insight'].includes(action.skillId)) return reject(initial, 'unknown-skill');
    if (!getAvailableBoardSkills(initial).includes(action.skillId)) return reject(initial, 'skill-unavailable');
    if(isKitBoard(action.skillId)&&(!action.target||!canUseKitBoard(initial,action.skillId,action.target)))return reject(initial,'invalid-row');
    if (action.skillId === 'pain-shared' && !getRowSkillPreview(initial, action.row!).valid) return reject(initial, 'invalid-row');
  }
  if (action.type === 'instant-skill' && !instantSlots(initial).includes(action.slot)) return reject(initial, 'instant-unavailable');
  if (action.type === 'skip') {
    if (legal.length) return reject(initial, 'legal-drop-exists');
    if (getAvailableBoardSkills(initial).length || instantSlots(initial).length) return reject(initial, 'board-skill-available');
  }
  let state = initial;
  const events: BattleEvent[] = [];
  let originBoxId: string | null = null;
  let links: readonly Link[] = [];
  let result: BattleResult | null = null;
  let activeOrigins: ReturnType<typeof resolveEnemySequence>['activeOrigins'] | undefined;
  const intent = action.type === 'enemy' ? getEnemyIntent(initial) : null;
  const accept = (step: BattleTransition) => { state = step.state; events.push(...step.events); };
  if (action.type === 'start-turn') {
    const step = resolveTurnStart(state);
    accept(step); originBoxId = step.originBoxId; links = step.links;
  } else if (action.type === 'instant-skill') accept(resolveInstantSkill(state, action.slot));
  else if (action.type === 'board-skill') accept(isKitBoard(action.skillId)?resolveKitBoard(state,action.skillId,action.target!):resolveBoardSkill(state, action.skillId, action.row));
  else if (action.type === 'skip') events.push({ type: 'skip', actor: 'player', reason: 'no-legal-drop' });
  else if (action.type === 'enemy') {
    state = { ...state, enemyPatternIndex: (state.enemyPatternIndex + 1) % state.config.enemyPattern.length, enemyTurnCount: state.enemyTurnCount + 1 };
    if (intent!.type === 'sequence') {
      const step = resolveEnemySequence(state, intent!); accept(step); activeOrigins=step.activeOrigins;
      const last=activeOrigins.at(-1); originBoxId=last?.originBoxId??null; links=last?.links??[];
      if (step.events.some(e=>e.type==='instant-kill')) result={winner:'enemy',reason:'enemy-blocked'};
    }
    else if (intent!.type === 'heal') accept(applyHealingEffect(state, 'enemy', intent!.amount, state.config.enemyId === 'nigirin' ? 'nigirin' : 'enemy-pattern'));
    else if (!legal.length&&violetProtected(state)) { events.push({type:'blocked',actor:'enemy',plannedAction:'drop'}); }
    else if (!legal.length) {
      events.push({ type: 'blocked', actor: 'enemy', plannedAction: 'drop' });
      events.push({ type: 'instant-kill', actor: 'enemy', target: 'player', damage: state.hp.player.current, hpBefore: state.hp.player.current, hpAfter: 0 });
      const loss = state.hp.player.current;
      state = { ...state, hp: { ...state.hp, player: { ...state.hp.player, current: 0 } } };
      accept(gainGauge(state, loss * tuningOf(state.config).gauge.damagePerHp, 'damage'));
      result = { winner: 'enemy', reason: 'enemy-blocked' };
    } else {
      const random = sampleUniformIndex(state.rngState, legal.length);
      state = { ...state, rngState: random.rngState };
      selected = legal[random.index]!;
    }
  }
  if (selected) {
    const step = resolveActiveDrop(state, selected);
    accept(step); originBoxId = step.originBoxId; links = step.links;
  }
  // 日本語: 追加投入も整理するが、通常行動の手番・終了充填は消費しない。
  // English: A bonus settles normally without consuming the ordinary action or its end-turn gain.
  if (action.type !== 'skip'){const settled=settleBoxTypes(state.config.board,state.boxes);state={...state,boxes:settled.boxes};if(settled.crushed.length)events.push({type:'rubble-crushed',boxIds:settled.crushed});}
  if (initial.actor === 'player' && action.type !== 'start-turn') accept(completePlayerTurn(state));
  if(action.type!=='start-turn')accept(resolvePoisonTurnEnd(state,initial.actor));
  if(initial.actor==='enemy'&&violetProtected(state)){state={...state,transformation:null};events.push({type:'transformation-ended',character:'violet'});}
  if (!result) {
    if (state.hp.player.current <= 0) result = { winner: 'enemy', reason: 'hp-zero' };
    else if (state.hp.enemy.current <= 0) result = { winner: 'player', reason: 'hp-zero' };
  }
  // A final bonus kill ends its old turn at the battle boundary, never granting a third active turn.
  if (result && state.transformation?.character === 'red' && state.transformation.remainingStarts === 0) {
    state = { ...state, transformation: null };
    events.push({ type: 'transformation-ended', character: 'red' });
  }
  if (result) events.push({ type: 'battle-end', result });
  const advances = !result && action.type !== 'start-turn';
  state = { ...state, result, actor: advances ? initial.actor === 'player' ? 'enemy' : 'player' : initial.actor,
    turn: advances ? initial.turn + 1 : initial.turn,
    playerTurnStarted: advances && initial.actor === 'enemy' ? false : state.playerTurnStarted };
  return freeze({ accepted: true, state, resolution: { actor: initial.actor, originBoxId, links, ...(activeOrigins ? { activeOrigins } : {}), enemyPlannedAction: intent?.type ?? null, events } });
}

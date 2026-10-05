import type { ExperimentAction } from '../boardActions.ts';
import type { ExperimentTuning } from '../tuning.ts';
import type { ExperimentRuntime, ExperimentEvent, ProposalId } from '../model.ts';
import type { GameTuning } from './tuning.ts';
/** 日本語: 表示座標ではなく、この整数座標を判定の正本にする。
 * English: Integer board coordinates, never rendered positions, are authoritative. */
export interface Cell { readonly row: number; readonly col: number }
export type Actor = 'player' | 'enemy';
export type Owner = Actor | 'neutral';
export type CharacterId = 'blue' | 'red';
export type EnemyId = 'marujiro' | 'hikikizan' | 'nigirin' | 'merarun';
export type BoardSkillId = 'pain-shared' | 'ember';
export type ShapeSkillId = 'health' | 'corner-strike' | 'square-strike';
export type LinkSkillId = 'grow-fire' | 'horizontal-slash' | 'diagonal-shot';
export type PassiveSkillId = 'charge' | 'first-guard';
export type InstantSkillId = 'healing-potion' | 'magic-bullet';
export type NormalSkillId = ShapeSkillId | LinkSkillId | PassiveSkillId | InstantSkillId;
export interface SkillInstance { readonly id: NormalSkillId; readonly rank: 1 | 2; readonly uses: number | null }
export interface PlayerBuild {
  readonly fixed: SkillInstance;
  readonly slots: readonly [SkillInstance | null, SkillInstance | null];
  readonly power: Readonly<Record<3 | 4 | 5, number>>;
}
export type Transformation = { readonly character: 'blue'; readonly scope: 'stage' }
  | { readonly character: 'red'; readonly scope: 'run'; readonly remainingStarts: number };
export interface PlayerSkillLoadout {
  readonly boardSkills: readonly BoardSkillId[];
  readonly shapeSkills: readonly ShapeSkillId[];
  readonly linkSkills: readonly LinkSkillId[];
}
export interface Box extends Cell {
  readonly id: string;
  readonly owner: Owner;
  readonly type: 'normal';
  readonly status: 'normal';
}
export interface BoardDefinition {
  readonly width: number;
  readonly height: number;
  readonly gravity: 'down';
  readonly terrain: readonly Cell[];
  readonly invalidCells: readonly Cell[];
}
export interface CombatantDefinition {
  readonly maxHp: number;
  readonly initialHp: number;
  readonly attacks: Readonly<Record<3 | 4 | 5, number>>;
}
export type EnemyIntent = { readonly type: 'drop' } | { readonly type: 'heal'; readonly amount: number };
export interface EnemyDefinition {
  readonly id: EnemyId;
  readonly label: string;
  readonly maxHp: number;
  readonly attacks: Readonly<Record<3 | 4 | 5, number>>;
  readonly healEveryOwnTurns?: number;
  readonly healAmount?: number;
}
export interface BattleConfig {
  readonly experiment?: ProposalId;
  readonly experimentTuning?: ExperimentTuning;
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly board: BoardDefinition;
  readonly initialBoxes: readonly Box[];
  readonly combatants: Readonly<Record<Actor, CombatantDefinition>>;
  readonly firstActor: Actor;
  readonly seed: number;
  readonly enemyPattern: readonly EnemyIntent[];
  /** Omitted character/loadout preserves the original skill-free fixtures. */
  readonly characterId?: CharacterId;
  readonly enemyId?: EnemyId;
  /** Explicit loadout overrides character defaults, including an empty loadout. */
  readonly playerSkills?: PlayerSkillLoadout;
  /** Explicit lab seeds; normal runs start at zero and untransformed. */
  readonly initialGauge?: number;
  readonly initialBuild?: PlayerBuild;
  /** Optional immutable balance override; omission preserves all prototype1.0 defaults. */
  readonly tuning?: GameTuning;
  readonly initialTransformation?: Transformation;
}
export interface Hp { readonly current: number; readonly max: number }
export interface BattleResult {
  readonly winner: Actor;
  readonly reason: 'hp-zero' | 'enemy-blocked';
}
export interface BattleState {
  readonly experiment?: ExperimentRuntime;
  readonly config: BattleConfig;
  readonly boxes: readonly Box[];
  readonly hp: Readonly<Record<Actor, Hp>>;
  readonly actor: Actor;
  /** Turns start at one; terminal actions do not advance to a fictional turn. */
  readonly turn: number;
  readonly enemyPatternIndex: number;
  /** Completed enemy actions, not global turn count. */
  readonly enemyTurnCount: number;
  /** Stage-local bonus to player 3-link power, earned after Grow Fire attacks. */
  readonly link3Growth: number;
  readonly gauge: number;
  readonly build: PlayerBuild | null;
  readonly transformation: Transformation | null;
  /** Consumed turn-start hook marker, independent of presentation/render count. */
  readonly playerTurnStarted: boolean;
  readonly rngState: number;
  readonly nextBoxId: number;
  readonly result: BattleResult | null;
}
export interface DropCandidate {
  readonly id: string;
  readonly spawn: Cell;
  readonly edge: Cell & { readonly side: 'top' };
  readonly segmentEndRow: number;
}
export interface DropOption extends DropCandidate {
  readonly available: boolean;
  readonly landing: Cell | null;
  readonly path: readonly Cell[];
}
export type Axis = 'vertical' | 'horizontal' | 'diagonal-down' | 'diagonal-up';
export interface Link {
  readonly axis: Axis;
  readonly count: number;
  readonly boxIds: readonly string[];
  readonly tier: 3 | 4 | 5 | null;
}
export interface PlusShape { readonly center: Cell; readonly boxIds: readonly string[] }
export interface RowSkillPreview {
  readonly valid: boolean;
  readonly row: number;
  readonly boxIds: readonly string[];
  readonly playerCount: number;
  readonly enemyCount: number;
  readonly neutralCount: number;
  readonly playerDamage: number;
  readonly enemyDamage: number;
}
export interface DropEvent {
  readonly type: 'drop';
  readonly actor: Actor;
  readonly box: Box;
  readonly candidateId: string;
  readonly spawn: Cell;
  readonly landing: Cell;
  readonly path: readonly Cell[];
}
export interface AttackEvent {
  readonly type: 'attack';
  readonly actor: Actor;
  readonly target: Actor;
  readonly axis: Axis;
  readonly linkCount: number;
  readonly tier: 3 | 4 | 5;
  readonly damage: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  /** Excess damage from this hit only. */
  readonly overkill: number;
  readonly skillId?: LinkSkillId;
}
export interface HealEvent {
  readonly type: 'heal';
  readonly actor: Actor;
  readonly target: Actor;
  readonly source: ProposalId | 'health' | 'nigirin' | 'enemy-pattern' | 'healing-potion';
  readonly amount: number;
  readonly requestedAmount: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly shapeBoxIds?: readonly string[];
}
export type BattleEvent = ExperimentEvent | DropEvent | AttackEvent | HealEvent
  | { readonly type: 'instant-skill'; readonly skillId: InstantSkillId; readonly rank: 1 | 2 }
  | { readonly type: 'gauge'; readonly before: number; readonly after: number; readonly amount: number; readonly source: 'link' | 'damage' | 'turn' }
  | { readonly type: 'transformation'; readonly character: CharacterId; readonly before: number; readonly after: number; readonly cost: number }
  | { readonly type: 'transformation-ended'; readonly character: CharacterId }
  | { readonly type: 'turn-start'; readonly remainingStarts: number; readonly skipped: boolean }
  | { readonly type: 'board-skill'; readonly actor: 'player'; readonly skillId: BoardSkillId; readonly row?: number }
  | { readonly type: 'row-cleared'; readonly row: number; readonly boxIds: readonly string[]; readonly playerCount: number; readonly enemyCount: number; readonly neutralCount: number }
  | { readonly type: 'damage'; readonly actor: 'player'; readonly target: Actor; readonly source: ProposalId | BoardSkillId | ShapeSkillId | InstantSkillId | 'blue-transformation'; readonly shapeBoxIds?: readonly string[]; readonly damage: number; readonly hpBefore: number; readonly hpAfter: number }
  | { readonly type: 'boxes-converted'; readonly actor: 'player'; readonly boxIds: readonly string[]; readonly from: 'enemy'; readonly to: 'player' }
  | { readonly type: 'link-growth'; readonly actor: 'player'; readonly skillId: 'grow-fire'; readonly amount: number; readonly before: number; readonly after: number }
  | { readonly type: 'skip'; readonly actor: 'player'; readonly reason: 'no-legal-drop' }
  | { readonly type: 'blocked'; readonly actor: 'enemy'; readonly plannedAction: 'drop' }
  | { readonly type: 'instant-kill'; readonly actor: 'enemy'; readonly target: 'player'; readonly damage: number; readonly hpBefore: number; readonly hpAfter: 0 }
  | { readonly type: 'battle-end'; readonly result: BattleResult };
export interface Resolution {
  readonly actor: Actor;
  readonly originBoxId: string | null;
  readonly links: readonly Link[];
  readonly enemyPlannedAction: EnemyIntent['type'] | null;
  readonly events: readonly BattleEvent[];
}
export type BattleAction = ExperimentAction | { readonly type: 'drop'; readonly candidateId: string }
  | { readonly type: 'board-skill'; readonly skillId: BoardSkillId; readonly row?: number }
  | { readonly type: 'skip' }
  | { readonly type: 'enemy' }
  | { readonly type: 'start-turn' }
  | { readonly type: 'instant-skill'; readonly slot: number };
export type RejectionReason = 'battle-ended' | 'wrong-actor' | 'unknown-candidate' | 'blocked-spawn' | 'legal-drop-exists'
  | 'experiment-unavailable' | 'board-skill-available' | 'unknown-skill' | 'skill-unavailable' | 'invalid-row' | 'unknown-action' | 'turn-start-required' | 'turn-start-unavailable' | 'instant-unavailable';
export interface ActionResult {
  readonly accepted: boolean;
  readonly state: BattleState;
  readonly reason?: RejectionReason;
  readonly resolution: Resolution | null;
}

/** A small composable core transition; only the action boundary freezes its full snapshot. */
export interface BattleTransition { readonly state: BattleState; readonly events: readonly BattleEvent[] }

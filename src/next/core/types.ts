import type {BoxType} from './boxTypes.ts';
import type { RunMeta } from '../meta/profile.ts';
import type { GameTuning } from './tuning.ts';
/** 日本語: 表示座標ではなく、この整数座標を判定の正本にする。
 * English: Integer board coordinates, never rendered positions, are authoritative. */
export interface Cell { readonly row: number; readonly col: number }
export type Actor = 'player' | 'enemy';
export type Owner = Actor | 'neutral';
export type CharacterId = 'blue' | 'red';
export type EnemyId = 'marujiro' | 'hikikizan' | 'nigirin' | 'merarun' | 'speed-core' | 'mother-core' | 'twin-core' | 'needle-core' | 'frost-core' | 'thorn-core' | 'rime-crown' | 'briar-wheel' | 'devilmon' | 'shashark' | 'biribiriman' | 'hyokuru' | 'hanabell' | 'zeroguard-x' | 'hoshimimi' | 'mokousagi' | 'hinobou' | 'tutorial-star';
export type BoardSkillId = 'blue-crosscut' | 'blue-plumb' | 'red-frontline' | 'red-brand' | 'mint-diagonal' | 'mint-frame' | 'amber-squarepress' | 'amber-rubble' | 'violet-venom' | 'violet-sting' | 'silver-frostbind' | 'silver-thornwall' | 'rose-longcut' | 'rose-twincut' | 'imashiru-polish' | 'imashiru-reset' | 'pain-shared' | 'ember' | 'imashiru-insight' | 'mint-observe' | 'rose-slice' | 'amber-convert' | 'violet-poison' | 'silver-freeze' | 'blue-freeze' | 'red-capture' | 'imashiru-focus';
export type ExpansionShapeId = 't-strike' | 'zigzag-strike' | 'cup-strike' | 'diamond-strike' | 'cross-strike';
export type ExpansionLinkId = 'full-power' | 'foundation' | 'snake-line' | 'edge-strike' | 'siege' | 'crossfire' | 'last-stand';
export type ExpansionSkillId = ExpansionShapeId | ExpansionLinkId | 'iron-wall' | 'capacitor' | 'solvent';
export type TrophyLinkId = 'heavy-swing' | 'clear-column' | 'pincer-strike' | 'twin-diagonal' | 'square-conduit' | 'venom-edge' | 'frost-edge' | 'exact-four' | 'shiny-relay';
export type TrophySkillId = TrophyLinkId | 'rescue-kit';
export type ShapeSkillId = 'combo-unit' | 'rescue-kit' | ExpansionShapeId | 'health' | 'corner-strike' | 'square-strike';
export type LinkSkillId = 'death-arrow' | TrophyLinkId | ExpansionLinkId | 'grow-fire' | 'horizontal-slash' | 'diagonal-shot';
export type PassiveSkillId = 'iron-wall' | 'charge' | 'first-guard' | 'poison-craft';
export type InstantSkillId = 'capacitor' | 'solvent' | 'healing-potion' | 'magic-bullet';
export type NormalSkillId = ShapeSkillId | LinkSkillId | PassiveSkillId | InstantSkillId;
export interface SkillInstance { readonly id: NormalSkillId; readonly rank: 1 | 2; readonly uses: number | null }
export interface PlayerBuild {
  readonly fixed: SkillInstance;
  readonly slots: readonly [SkillInstance | null, SkillInstance | null, ...(SkillInstance | null)[]];
  readonly power: Readonly<Record<3 | 4 | 5, number>>;
}
export type Transformation = { readonly character: 'blue'; readonly scope: 'stage' }
  | { readonly character: 'red'; readonly scope: 'run'; readonly remainingStarts: number }
  | { readonly character:'imashiru'; readonly scope:'turn' }
  | { readonly character:'mint'; readonly scope:'stage'; readonly remainingOwnTurns?:number }
  | { readonly character:'amber'; readonly scope:'turn'; readonly remainingOwnTurns?:number }
  | { readonly character:'violet'|'silver'|'rose'; readonly scope:'turn' };
export interface PlayerSkillLoadout {
  readonly boardSkills: readonly BoardSkillId[];
  readonly shapeSkills: readonly ShapeSkillId[];
  readonly linkSkills: readonly LinkSkillId[];
}
export interface Box extends Cell {
  readonly poisonSource?: Actor;
  /** Remaining settlements fixed by Toxic Erosion; removed when poison is cleared. */
  readonly poisonCountdown?: 1 | 2;
  readonly id: string;
  readonly owner: Owner;
  readonly type: BoxType;
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
export type EnemyStep = { readonly type: 'freeze'; readonly count: number } | { readonly type: 'drop'; readonly boxType?: 'thorn' | 'shiny' }
  | { readonly type: 'absolute-zero'; readonly count: number } | { readonly type: 'neutralize'; readonly count: number } | { readonly type: 'rubble-drop' } | { readonly type: 'fixed-damage'; readonly amount: number } | { readonly type: 'wait' };
export interface EnemyPhaseState { readonly phase: 'normal' | 'critical'; readonly completedTurns: number }
export type EnemyIntent = { readonly type: 'drop' } | { readonly type: 'heal'; readonly amount: number }
  | { readonly type: 'sequence'; readonly steps: readonly EnemyStep[]; readonly phase?: EnemyPhaseState['phase']; readonly phaseChanged?: boolean };
export interface EnemyDefinition {
  readonly id: EnemyId;
  readonly label: string;
  readonly maxHp: number;
  readonly attacks: Readonly<Record<3 | 4 | 5, number>>;
  readonly healEveryOwnTurns?: number;
  readonly healAmount?: number;
}
/** 日本語: 試作戦略は数値と分離。省略時は旧自動方式。
 * English: Strategy is separate from balance; omission preserves the automatic mode. */
export interface GameplayStrategy { readonly transformation: 'automatic-link' | 'manual-charge'; readonly gauge: 'per-box' | 'bands' }
export interface BattleConfig {
  readonly frozenRule?: 'half-melt-v1';
  /** 日本語: 新規ランのトゲ規則（自分の箱のトゲは無害・上下左右5%・斜め1%）。未指定の旧ランは従来どおり。 */
  readonly thornRule?: 'owner-safe-v2';
  /** Immutable departure snapshot; absent on legacy saves and fixtures. */
  readonly meta?: RunMeta;
  readonly strategy?: GameplayStrategy;
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
  /** Per-loop fixed-damage bonus, independent of HP and link power. */
  readonly enemyFixedDamageBonus?: number;
  /** Explicit loadout overrides character defaults, including an empty loadout. */
  readonly playerSkills?: PlayerSkillLoadout;
  /** Explicit lab seeds; normal runs start at zero and untransformed. */
  readonly initialGauge?: number;
  /** Test setup only; ordinary encounters start at zero own turns. */
  readonly initialEnemyTurnCount?: number;
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
  readonly comboStreak?:number;
  readonly comboActivated?:boolean;
  readonly barrier?: number;
  readonly shinyNextDrop?: boolean;
  readonly config: BattleConfig;
  readonly boxes: readonly Box[];
  readonly hp: Readonly<Record<Actor, Hp>>;
  readonly actor: Actor;
  /** Turns start at one; terminal actions do not advance to a fictional turn. */
  readonly turn: number;
  readonly enemyPatternIndex: number;
  /** Completed enemy actions, not global turn count. */
  readonly enemyTurnCount: number;
  /** Only HP-phase enemies need this runtime; legacy snapshots omit it. */
  readonly enemyPhase?: EnemyPhaseState;
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
  readonly source: 'rescue-kit' | 'health' | 'nigirin' | 'enemy-pattern' | 'healing-potion';
  readonly amount: number;
  readonly requestedAmount: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly shapeBoxIds?: readonly string[];
}
export type BattleEvent = {readonly type:'poison-vanished';readonly boxIds:readonly string[]} | { readonly type: 'enemy-box-changed'; readonly boxIds: readonly string[]; readonly boxType: 'frozen' | 'poison' | 'absolute-zero' | 'neutral' } | DropEvent | AttackEvent | HealEvent
  | { readonly type:'power-boost';readonly source?:'combo-unit';readonly tier:3|4|5;readonly amount:number;readonly boxIds:readonly string[] }
  | { readonly type: 'instant-skill'; readonly skillId: InstantSkillId; readonly rank: 1 | 2 }
  | { readonly type: 'gauge'; readonly before: number; readonly after: number; readonly amount: number; readonly source: 'link' | 'damage' | 'turn' }
  | { readonly type: 'transformation'; readonly character: CharacterId | 'imashiru'|'mint'|'amber'|'violet'|'silver'|'rose'; readonly before: number; readonly after: number; readonly cost: number }
  | { readonly type: 'transformation-ended'; readonly character: CharacterId | 'imashiru'|'mint'|'amber'|'violet'|'silver'|'rose' }
  | { readonly type: 'turn-start'; readonly remainingStarts: number; readonly skipped: boolean }
  | { readonly type: 'board-skill'; readonly actor: 'player'; readonly skillId: BoardSkillId; readonly row?: number }
  | { readonly type: 'row-cleared'; readonly row: number; readonly boxIds: readonly string[]; readonly playerCount: number; readonly enemyCount: number; readonly neutralCount: number }
  | { readonly type: 'damage'; readonly actor: Actor; readonly target: Actor; readonly source: BoardSkillId | ShapeSkillId | InstantSkillId | 'blue-transformation' | 'boss-fixed'; readonly shapeBoxIds?: readonly string[]; readonly damage: number; readonly hpBefore: number; readonly hpAfter: number }
  | { readonly type: 'boxes-converted'; readonly actor: 'player'; readonly boxIds: readonly string[]; readonly from: 'enemy'; readonly to: 'player' }
  | { readonly type:'kit-board-changed'; readonly boxIds:readonly string[]; readonly skillId?:BoardSkillId }
  | { readonly type:'barrier'; readonly before:number; readonly after:number }
  | { readonly type:'gauge-spent'; readonly before:number; readonly after:number; readonly amount:number }
  | { readonly type:'type-damage'; readonly actor:Actor; readonly target:Actor; readonly source:'poison'|'thorn'; readonly sourceBoxIds?:readonly string[]; readonly damage:number; readonly hpBefore:number; readonly hpAfter:number }
  | { readonly type:'boxes-thawed'; readonly boxIds:readonly string[] }
  | { readonly type:'rubble-crushed'; readonly boxIds:readonly string[] }
  | { readonly type:'boxes-shining'; readonly boxIds:readonly string[] }
  | { readonly type:'shiny-prepared' }
  | { readonly type: 'link-growth'; readonly actor: 'player'; readonly skillId: 'grow-fire'; readonly amount: number; readonly before: number; readonly after: number }
  | { readonly type: 'skip'; readonly actor: 'player'; readonly reason: 'no-legal-drop' }
  | { readonly type: 'blocked'; readonly actor: 'enemy'; readonly plannedAction: 'drop' }
  | { readonly type: 'instant-kill'; readonly actor: 'enemy'; readonly target: 'player'; readonly damage: number; readonly hpBefore: number; readonly hpAfter: 0 }
  | { readonly type: 'enemy-wait'; readonly actor: 'enemy' }
  | { readonly type: 'enemy-phase'; readonly phase: 'critical' }
  | { readonly type: 'battle-end'; readonly result: BattleResult };
export interface Resolution {
  readonly actor: Actor;
  readonly originBoxId: string | null;
  readonly links: readonly Link[];
  /** Every insertion in a multi-action turn keeps its own origin and attack geometry. */
  readonly activeOrigins?: readonly { readonly originBoxId: string; readonly links: readonly Link[] }[];
  readonly enemyPlannedAction: EnemyIntent['type'] | null;
  readonly events: readonly BattleEvent[];
}
export type BattleAction = { readonly type: 'drop'; readonly candidateId: string }
  | { readonly type: 'board-skill'; readonly skillId: BoardSkillId; readonly row?: number; readonly target?:{readonly row:number;readonly col:number;readonly orientation?:number} }
  | { readonly type: 'skip' }
  | { readonly type: 'enemy' }
  | { readonly type: 'start-turn' }
  | { readonly type: 'instant-skill'; readonly slot: number }
  | { readonly type: 'transform' };
export type RejectionReason = 'battle-ended' | 'wrong-actor' | 'unknown-candidate' | 'blocked-spawn' | 'legal-drop-exists'
  | 'board-skill-available' | 'unknown-skill' | 'skill-unavailable' | 'invalid-row' | 'unknown-action' | 'turn-start-required' | 'turn-start-unavailable' | 'instant-unavailable' | 'transformation-unavailable';
export interface ActionResult {
  readonly accepted: boolean;
  readonly state: BattleState;
  readonly reason?: RejectionReason;
  readonly resolution: Resolution | null;
}

/** A small composable core transition; only the action boundary freezes its full snapshot. */
export interface BattleTransition { readonly state: BattleState; readonly events: readonly BattleEvent[] }

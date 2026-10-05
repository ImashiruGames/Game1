import { applyAction, createBattle, getAvailableBoardSkills, getDropOptions, needsTurnStart, carryTransformationState, instantSlots, tuningOf } from '../core/index.ts';
import type { BattleAction, BattleConfig, BattleState, BoardSkillId, Resolution } from '../core/index.ts';
import { createNextStageConfig, createRunState, prepareEnemyOrder } from './BattleRun.ts';
import { endlessEncounter } from './progression.ts';
import { applyReward, generateRewardOffer, rewardSeed } from './rewards.ts';
import type { RewardId } from './rewards.ts';
import type { BattleRunOptions, BattleRunState } from './BattleRun.ts';
export type { BattleRunOptions, BattleRunState } from './BattleRun.ts';

export interface BattleControllerOptions {
  readonly run?: BattleRunOptions;
}

export interface BattleView {
  render(state: BattleState, resolving: boolean, run: BattleRunState | null): void;
  animate(resolution: Resolution, before: BattleState, after: BattleState, signal: AbortSignal): Promise<void>;
  animateStageTransition?(before: BattleState, after: BattleState, run: BattleRunState, signal: AbortSignal): Promise<void>;
  reset?(): void;
  reportError?(error: unknown): void;
}

/**
 * 日本語: Core を一度だけ実行し、その結果を描画する薄い進行役。
 * English: Commit each atomic core action once, then present its result.
 * Animation timing never participates in damage, random choices, or victory rules.
 */
export class BattleController {
  private state: BattleState;
  private initialConfig: BattleConfig;
  private options: BattleControllerOptions;
  private enemyOrder: ReturnType<typeof prepareEnemyOrder>;
  private run: BattleRunState | null;
  private view: BattleView;
  private resolving = false;
  private generation = 0;
  private animation = new AbortController();
  private destroyed = false;
  private rewardRng = 0;

  constructor(config: BattleConfig, view: BattleView, options: BattleControllerOptions = {}) {
    this.state = createBattle(config);
    this.initialConfig = this.state.config;
    this.options = this.copyOptions(options);
    this.enemyOrder = prepareEnemyOrder(this.state.config, this.options.run);
    this.run = this.enemyOrder ? createRunState(this.enemyOrder[0]!) : null;
    this.view = view;
    this.rewardRng = rewardSeed(config.seed);
  }

  get snapshot(): BattleState { return this.state; }
  get runSnapshot(): BattleRunState | null { return this.run; }
  get isResolving(): boolean { return this.resolving; }

  async start(): Promise<void> {
    if (this.destroyed || this.resolving) return;
    const generation = this.generation;
    this.emit();
    if (generation !== this.generation || this.destroyed) return;
    const next = this.automaticAction();
    if (next) await this.runSequence(next);
  }

  async drop(candidateId: string): Promise<boolean> {
    if (!this.canAct()) return false;
    return this.runSequence({ type: 'drop', candidateId });
  }

  async boardSkill(skillId: BoardSkillId, row?: number): Promise<boolean> {
    if (!this.canAct()) return false;
    return this.runSequence({ type: 'board-skill', skillId, row });
  }

  async instantSkill(slot: number): Promise<boolean> {
    if (!this.canAct()) return false;
    return this.runSequence({ type: 'instant-skill', slot });
  }

  async chooseReward(offerId: string, rewardId: RewardId | null, replacement?: number): Promise<boolean> {
    if (this.destroyed || this.resolving || this.run?.status !== 'reward' || this.run.offer?.id !== offerId || !this.state.build) return false;
    if (rewardId !== null && !this.run.offer.choices.includes(rewardId)) return false;
    const build = rewardId === null ? this.state.build : applyReward(this.state.build, rewardId, replacement, tuningOf(this.state.config));
    if (!build) return false;
    const generation = this.generation; const signal = this.animation.signal;
    this.resolving = true;
    this.state = Object.freeze({ ...this.state, build });
    this.run = Object.freeze({ ...this.run, status: 'transitioning', offer: undefined });
    this.emit();
    try {
      await this.advanceStage(generation, signal);
      if (!this.current(generation, signal)) return true;
      const next = this.automaticAction();
      if (next) await this.runSequence(next);
    } finally {
      if (this.current(generation, signal)) { this.resolving = false; this.emit(); }
    }
    return true;
  }

  async restart(config: BattleConfig = this.initialConfig, options: BattleControllerOptions = this.options): Promise<void> {
    if (this.destroyed) return;
    // 日本語: 不正な設定は現戦闘を壊す前に拒否する。English: Validate before replacing a live battle.
    const next = createBattle(config);
    const nextOptions = this.copyOptions(options);
    const nextOrder = prepareEnemyOrder(next.config, nextOptions.run);
    this.generation += 1;
    const generation = this.generation;
    this.animation.abort();
    // Abort listeners can synchronously issue a newer restart or dispose this controller.
    if (generation !== this.generation || this.destroyed) return;
    this.animation = new AbortController();
    this.state = next;
    this.initialConfig = next.config;
    this.options = nextOptions;
    this.rewardRng = rewardSeed(next.config.seed);
    this.enemyOrder = nextOrder;
    this.run = nextOrder ? createRunState(nextOrder[0]!) : null;
    this.resolving = false;
    this.present(() => this.view.reset?.());
    if (generation === this.generation && !this.destroyed) await this.start();
  }

  destroy(): void {
    this.destroyed = true;
    this.generation += 1;
    this.animation.abort();
    this.resolving = false;
  }

  private copyOptions(options: BattleControllerOptions): BattleControllerOptions {
    return Object.freeze(options.run ? { run: Object.freeze({
      ...(options.run.mode ? { mode: options.run.mode } : {}),
      ...(options.run.rewards === undefined ? {} : { rewards: options.run.rewards }),
      ...(options.run.enemyOrder ? { enemyOrder: Object.freeze([...options.run.enemyOrder]) } : {}),
    }) } : {});
  }

  private canAct(): boolean {
    return !this.destroyed && !this.resolving && !this.state.result && this.state.actor === 'player' && !needsTurnStart(this.state);
  }

  private report(error: unknown): void {
    // A failing error display must not prevent committed battle progress either.
    try { this.view.reportError?.(error); } catch { /* Presentation-only failure. */ }
  }

  private present(callback: () => void): void {
    try { callback(); } catch (error) { this.report(error); }
  }

  private emit(): void { this.present(() => this.view.render(this.state, this.resolving, this.run)); }

  private automaticAction(): BattleAction | null {
    if (this.state.result) return null;
    if (needsTurnStart(this.state)) return { type: 'start-turn' };
    if (this.state.actor === 'enemy') return { type: 'enemy' };
    // 日本語: 投入と盤面スキルが両方使えない時だけスキップする。
    // English: A blocked drop does not consume the player's available board-skill choice.
    return getDropOptions(this.state).some(option => option.available)
      || getAvailableBoardSkills(this.state).length > 0 || instantSlots(this.state).length > 0 ? null : { type: 'skip' };
  }

  private current(generation: number, signal: AbortSignal): boolean {
    return generation === this.generation && !signal.aborted && !this.destroyed;
  }

  private recordBattleEnd(): void {
    if (!this.run || !this.state.result) return;
    if (this.state.result.winner === 'enemy') { this.run = Object.freeze({ ...this.run, status: 'lost' }); return; }
    const defeatedCount = this.run.defeatedCount + 1;
    const continues = this.options.run?.mode === 'endless' || this.run.stage < this.enemyOrder!.length;
    if (continues && this.options.run?.rewards && this.state.build) {
      const result = generateRewardOffer(this.state.build, this.rewardRng, `reward:${this.generation}:${this.run.stage}:${defeatedCount}`, tuningOf(this.state.config));
      this.rewardRng = result.rngState;
      this.run = Object.freeze({ ...this.run, defeatedCount, status: 'reward', offer: result.offer });
    } else this.run = Object.freeze({ ...this.run, defeatedCount, status: continues ? 'transitioning' : 'cleared' });
  }

  private async advanceStage(generation: number, signal: AbortSignal): Promise<void> {
    if (!this.current(generation, signal) || !this.run || !this.enemyOrder || this.state.result?.winner !== 'player' || this.run.status !== 'transitioning') return;
    const before = this.state;
    const stage = this.run.stage + 1;
    const encounter = this.options.run?.mode === 'endless' ? endlessEncounter(stage, this.initialConfig.enemyId!, tuningOf(this.initialConfig)) : null;
    const enemyId = encounter?.enemyId ?? this.enemyOrder[stage - 1]!;
    const config = createNextStageConfig(this.initialConfig, before, enemyId, stage);
    const scaled = encounter ? { ...config, combatants: { ...config.combatants, enemy: { ...config.combatants.enemy, maxHp: encounter.maxHp, initialHp: encounter.maxHp } } } : config;
    const next = carryTransformationState(createBattle(scaled), before);
    this.state = next;
    this.run = Object.freeze({ ...this.run, stage, currentEnemyId: enemyId, status: 'transitioning' });
    this.emit();
    if (!this.current(generation, signal)) return;
    try {
      await this.view.animateStageTransition?.(before, next, this.run, signal);
    } catch (error) {
      if (!signal.aborted) this.report(error);
    }
    if (!this.current(generation, signal)) return;
    this.run = Object.freeze({ ...this.run!, status: 'active' });
  }

  private async runSequence(firstAction: BattleAction): Promise<boolean> {
    const generation = this.generation;
    const signal = this.animation.signal;
    this.resolving = true;
    this.emit();
    let action: BattleAction | null = firstAction;
    let accepted = false;

    try {
      while (action && this.current(generation, signal)) {
        const before = this.state;
        const outcome = applyAction(before, action);
        if (!outcome.accepted || !outcome.resolution) break;
        accepted = true;
        this.state = outcome.state;
        this.recordBattleEnd();
        try {
          await this.view.animate(outcome.resolution, before, this.state, signal);
        } catch (error) {
          // 日本語: 演出失敗でも確定済み行動は再実行しない。English: Never replay committed damage after a visual failure.
          if (!signal.aborted) this.report(error);
        }
        // 日本語: 再開始より前の非同期処理は新戦闘へ触れない。
        // English: A stale animation completion cannot unlock or advance a restarted battle.
        if (!this.current(generation, signal)) return accepted;
        this.emit();
        if (!this.current(generation, signal)) return accepted;
        if (this.run?.status === 'transitioning' && this.state.result?.winner === 'player') {
          await this.advanceStage(generation, signal);
          if (!this.current(generation, signal)) return accepted;
          this.emit();
          if (!this.current(generation, signal)) return accepted;
        }
        action = this.automaticAction();
      }
    } finally {
      if (this.current(generation, signal)) {
        this.resolving = false;
        this.emit();
      }
    }
    return accepted;
  }
}

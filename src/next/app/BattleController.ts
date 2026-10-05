import {newRunAchievements,trackRunAction} from './runAchievements.ts';
import type {RunAchievements} from './runAchievements.ts';
import { applyAction, createBattle, getAvailableBoardSkills, getDropOptions, needsTurnStart, carryTransformationState, instantSlots, tuningOf } from '../core/index.ts';
import type { BattleAction, BattleConfig, BattleState, BoardSkillId, Resolution } from '../core/index.ts';
import { createNextStageConfig, createRunState, prepareEnemyOrder } from './BattleRun.ts';
import { endlessEncounter, bossLoopEncounter } from './progression.ts';
import { applyRunReward, generateRewardOffer, rewardSeed, categoryOffer, generateCategoryOffer, isSkillReward } from './rewards.ts';
import { canReceiveSkillReward } from '../core/playerBuild.ts';
import type { RewardId, RewardCategory } from './rewards.ts';
import type { BattleRunOptions, BattleRunState } from './BattleRun.ts';
import { freeze } from '../core/immutable.ts';
import { isCheckpointBoundary, validateCheckpoint, canRetireCheckpoint, prepareRetiredCheckpoint } from './saveCheckpoint.ts';
import type { RunCheckpoint, PendingReward } from './saveCheckpoint.ts';
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
export interface PersistenceHooks {
  readonly beforeAction: () => void;
  readonly write: (checkpoint: RunCheckpoint) => void;
  readonly failed: (error: unknown) => void;
}

/**
 * 日本語: Core を一度だけ実行し、その結果を描画する薄い進行役。
 * English: Commit each atomic core action once, then present its result.
 * Animation timing never participates in damage, random choices, or victory rules.
 */
export class BattleController {
  protected state: BattleState;
  protected initialConfig: BattleConfig;
  private options: BattleControllerOptions;
  private enemyOrder: ReturnType<typeof prepareEnemyOrder>;
  protected run: BattleRunState | null;
  protected view: BattleView;
  protected resolving = false;
  private generation = 0;
  private animation = new AbortController();
  private destroyed = false;
  private rewardRng = 0;
  private runId: string = crypto.randomUUID();
  private persistence?: PersistenceHooks;
  private saveBlocked = false;
  private resumeReward?: PendingReward;
  private retryCheckpoint?: RunCheckpoint;
  private achievements?:RunAchievements;

  constructor(config: BattleConfig, view: BattleView, options: BattleControllerOptions = {}, persistence?: PersistenceHooks) {
    this.state = createBattle(config);
    if(config.meta?.balanceVersion===2)this.achievements={...newRunAchievements(),highestMaxHp:this.state.hp.player.max};
    this.initialConfig = this.state.config;
    this.options = this.copyOptions(options);
    this.enemyOrder = prepareEnemyOrder(this.state.config, this.options.run);
    this.run = this.enemyOrder ? createRunState(this.enemyOrder[0]!, this.options.run?.startStage) : null;
    this.view = view;
    this.rewardRng = rewardSeed(config.seed);
    this.persistence = persistence;
  }

  static restore(checkpoint: RunCheckpoint, view: BattleView, persistence?: PersistenceHooks): BattleController {
    validateCheckpoint(checkpoint);
    const data=freeze(structuredClone(checkpoint));
    const c=new BattleController(data.initialConfig,view,data.options,persistence);
    c.state=data.state;c.run=data.run;c.enemyOrder=data.enemyOrder;c.rewardRng=data.rewardRng;c.runId=data.runId;
    c.resumeReward=data.pendingReward;c.achievements=data.achievements;
    return c;
  }

  get persistenceBlocked():boolean{return this.saveBlocked;}
  exportCheckpoint(pendingReward:PendingReward|undefined=this.resumeReward):RunCheckpoint {
    if(this.resolving||!isCheckpointBoundary(this.state,this.run))throw new Error('自動行動の解決中は保存できません');
    return freeze(structuredClone({runId:this.runId,initialConfig:this.initialConfig,options:this.options,state:this.state,run:this.run,enemyOrder:this.enemyOrder,rewardRng:this.rewardRng,...(this.achievements?{achievements:this.achievements}:{}),...(pendingReward?{pendingReward}:{})}));
  }
  /** Retry persists the already computed stable result; it never replays an in-memory reward. */
  retrySave():boolean {
    if(this.destroyed||this.resolving)return false;
    if(!this.retryCheckpoint&&!isCheckpointBoundary(this.state,this.run)){this.failedSave(new Error('自動行動の途中で停止しています。「保存された状態へ戻る」から確定済みの操作を再開してください。'));return false;}
    const target=this.retryCheckpoint??this.exportCheckpoint();
    if(!this.persist(target))return false;
    const data=freeze(structuredClone(target));
    this.state=data.state;this.run=data.run;this.initialConfig=data.initialConfig;this.options=data.options;this.enemyOrder=data.enemyOrder;this.rewardRng=data.rewardRng;this.runId=data.runId;this.resumeReward=data.pendingReward;this.achievements=data.achievements;
    this.saveBlocked=false;this.emit();return true;
  }

  get snapshot(): BattleState { return this.state; }
  get runSnapshot(): BattleRunState | null { return this.run; }
  get runOrigin(): {seed:number;startStage:number;deep:boolean} {return {seed:this.initialConfig.seed,startStage:this.options.run?.startStage??1,deep:this.options.run?.encounterVersion==='deep-v2'};}
  get isResolving(): boolean { return this.resolving; }

  async start(): Promise<void> {
    if (this.destroyed || this.resolving || !this.beforeMutation()) return;
    const generation = this.generation;
    this.emit();
    if (generation !== this.generation || this.destroyed) return;
    if(this.resumeReward){const intent=this.resumeReward;await this.chooseReward(intent.offerId,intent.rewardId,intent.replacement);return;}
    if(this.run?.offer?.category==='heal'){await this.chooseReward(this.run.offer.id,'immediate-heal');return;}
    const next = this.automaticAction();
    if (next) await this.runSequence(next); else {this.finishBoundary();this.emit();}
  }

  /** Confirmed stable return: close the run durably before the profile receipt is credited. */
  retire(expected:RunCheckpoint):boolean {
    if(this.destroyed||this.resolving||this.saveBlocked||this.resumeReward)return false;
    const current=this.exportCheckpoint();
    if(!canRetireCheckpoint(current)||JSON.stringify(current)!==JSON.stringify(expected)||!this.beforeMutation())return false;
    const terminal=prepareRetiredCheckpoint(current);
    if(!this.persist(terminal))return false;
    this.run=terminal.run;this.emit();return true;
  }

  async drop(candidateId: string): Promise<boolean> {
    if (!this.canAct()) return false;
    return this.runSequence({ type: 'drop', candidateId });
  }

  async boardSkill(skillId: BoardSkillId, row?: number,target?:{row:number;col:number;orientation?:number}): Promise<boolean> {
    if (!this.canAct()) return false;
    return this.runSequence({ type: 'board-skill', skillId, row,...(target?{target}:{}) });
  }

  async instantSkill(slot: number): Promise<boolean> {
    if (!this.canAct()) return false;
    return this.runSequence({ type: 'instant-skill', slot });
  }

  async transform(): Promise<boolean> {
    if (!this.canAct()) return false;
    return this.runSequence({ type: 'transform' });
  }

  async chooseCategory(offerId: string, category: RewardCategory): Promise<boolean> {
    if (this.destroyed || this.resolving || this.run?.status !== 'reward' || this.run.offer?.id !== offerId || this.run.offer.category !== 'pending' || !this.state.build
      || !['heal', 'stats', 'skills'].includes(category)) return false;
    if(!this.beforeMutation())return false;
    const selected = generateCategoryOffer(this.state.build, this.rewardRng, offerId, category, tuningOf(this.state.config),this.initialConfig.meta?.pool);
    const nextRun=Object.freeze({ ...this.run, offer: selected.offer });
    const intent=category==='heal'?{offerId,rewardId:'immediate-heal' as const}:undefined;
    const checkpoint={...this.exportCheckpoint(intent),run:nextRun,rewardRng:selected.rngState};
    if(!this.persist(checkpoint))return false;
    this.rewardRng = selected.rngState;
    this.run = nextRun;
    this.resumeReward=intent;
    if (category === 'heal') return this.chooseReward(offerId, 'immediate-heal');
    this.emit();
    return true;
  }

  async chooseReward(offerId: string, rewardId: RewardId | null, replacement?: number): Promise<boolean> {
    if (this.destroyed || this.resolving || this.run?.status !== 'reward' || this.run.offer?.id !== offerId || !this.state.build) return false;
    if (this.run.offer.category === 'pending') return false;
    if(this.resumeReward&&(this.resumeReward.offerId!==offerId||this.resumeReward.rewardId!==rewardId||this.resumeReward.replacement!==replacement))return false;
    if (rewardId !== null && !this.run.offer.choices.includes(rewardId)) return false;
    // 日本語: 古い候補にも現在の資格を再適用。English: Stale offers never bypass current acquisition policy.
    if (rewardId !== null && isSkillReward(rewardId) && (!canReceiveSkillReward(this.state.build, rewardId)||(this.initialConfig.meta&&!this.initialConfig.meta.pool.includes(rewardId)))) return false;
    const rewarded = rewardId === null ? this.state : applyRunReward(this.state, rewardId, replacement);
    if (!rewarded) return false;
    if(!this.beforeMutation()||!this.persist(this.exportCheckpoint({offerId,rewardId,...(replacement===undefined?{}:{replacement})})))return false;
    const generation = this.generation; const signal = this.animation.signal;
    this.resolving = true;
    this.resumeReward={offerId,rewardId,...(replacement===undefined?{}:{replacement})};
    this.state = rewarded;
    if(this.achievements)this.achievements={...this.achievements,highestMaxHp:Math.max(this.achievements.highestMaxHp,rewarded.hp.player.max)};
    this.resumeReward=undefined;
    this.run = Object.freeze({ ...this.run, status: 'transitioning', offer: undefined });
    this.emit();
    try {
      await this.advanceStage(generation, signal);
      if (!this.current(generation, signal)) return true;
      const next = this.automaticAction();
      if (next) await this.runSequence(next);
    } finally {
      if (this.current(generation, signal)) { this.resolving = false; this.finishBoundary();this.emit(); }
    }
    return true;
  }

  async restart(config: BattleConfig = this.initialConfig, options: BattleControllerOptions = this.options): Promise<void> {
    if (this.destroyed || !this.beforeMutation()) return;
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
    this.runId=crypto.randomUUID();this.resumeReward=undefined;this.achievements=next.config.meta?.balanceVersion===2?{...newRunAchievements(),highestMaxHp:next.hp.player.max}:undefined;
    this.enemyOrder = nextOrder;
    this.run = nextOrder ? createRunState(nextOrder[0]!, nextOptions.run?.startStage) : null;
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
    if(options.run?.startStage!==undefined&&(!Number.isSafeInteger(options.run.startStage)||options.run.startStage<1))throw new Error('Invalid initial stage');
    if(options.run?.finishAtStage!==undefined&&(!Number.isSafeInteger(options.run.finishAtStage)||options.run.finishAtStage<1||(options.run.startStage??1)>options.run.finishAtStage))throw new Error('Invalid run finish stage');
    if(options.run?.encounterVersion!==undefined&&(!['bands-v1','bands-v2','deep-v2'].includes(options.run.encounterVersion)||options.run.route!=='boss-loop'))throw new Error('Invalid encounter version');
    if(options.run?.route!==undefined&&!['standard','boss-loop'].includes(options.run.route))throw new Error('Invalid run route');
    return Object.freeze(options.run ? { run: Object.freeze({
      ...(options.run.encounterVersion ? { encounterVersion:options.run.encounterVersion } : {}),
      ...(options.run.rotationStart ? { rotationStart: options.run.rotationStart } : {}),
      ...(options.run.route ? { route: options.run.route } : {}),
      ...(options.run.startStage === undefined ? {} : { startStage: options.run.startStage }),
      ...(options.run.finishAtStage === undefined ? {} : { finishAtStage: options.run.finishAtStage }),
      ...(options.run.mode ? { mode: options.run.mode } : {}),
      ...(options.run.rewards === undefined ? {} : { rewards: options.run.rewards }),
      ...(options.run.rewardMode ? { rewardMode: options.run.rewardMode } : {}),
      ...(options.run.enemyOrder ? { enemyOrder: Object.freeze([...options.run.enemyOrder]) } : {}),
    }) } : {});
  }

  private canAct(): boolean {
    return !this.destroyed && !this.resolving && !this.saveBlocked && this.run?.status!=='retired' && !this.state.result && this.state.actor === 'player' && !needsTurnStart(this.state);
  }

  private failedSave(error:unknown):void {this.saveBlocked=true;try{this.persistence?.failed(error);}catch{/* A broken message must not unlock gameplay. */}}
  private beforeMutation():boolean {if(this.saveBlocked)return false;try{this.persistence?.beforeAction();return true;}catch(error){this.failedSave(error);return false;}}
  private persist(checkpoint:RunCheckpoint):boolean {try{this.persistence?.write(checkpoint);this.retryCheckpoint=undefined;return true;}catch(error){this.retryCheckpoint=freeze(structuredClone(checkpoint));this.failedSave(error);return false;}}
  private finishBoundary():void {
    if(this.destroyed||this.resolving||this.saveBlocked||this.resumeReward||this.automaticAction()!==null||!isCheckpointBoundary(this.state,this.run))return;
    this.persist(this.exportCheckpoint());
  }

  private report(error: unknown): void {
    // A failing error display must not prevent committed battle progress either.
    try { this.view.reportError?.(error); } catch { /* Presentation-only failure. */ }
  }

  protected present(callback: () => void): void {
    try { callback(); } catch (error) { this.report(error); }
  }

  protected emit(): void { this.present(() => this.view.render(this.state, this.resolving||this.saveBlocked||!!this.resumeReward, this.run)); }

  protected automaticAction(): BattleAction | null {
    if (this.run?.status==='retired'||this.state.result) return null;
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
    const atFinish=this.options.run?.finishAtStage!==undefined&&this.run.stage>=this.options.run.finishAtStage;
    const continues = !atFinish&&(this.options.run?.mode === 'endless' || this.run.stage < this.enemyOrder!.length);
    if (continues && this.options.run?.rewards && this.state.build) {
      const id = `reward:${this.runId}:${this.run.stage}:${defeatedCount}`;
      const result = this.options.run?.rewardMode === 'categories' ? { offer: categoryOffer(id), rngState: this.rewardRng } : generateRewardOffer(this.state.build, this.rewardRng, id, tuningOf(this.state.config));
      this.rewardRng = result.rngState;
      this.run = Object.freeze({ ...this.run, defeatedCount, status: 'reward', offer: result.offer });
    } else this.run = Object.freeze({ ...this.run, defeatedCount, status: continues ? 'transitioning' : 'cleared' });
  }

  /** 日本語: 次の戦闘の設定を差し替える拡張点（既定は何もしない）。English: Extension point for the next stage's config; the default is identity. */
  protected prepareStage(config: BattleConfig, _stage: number): BattleConfig { return config; }

  private async advanceStage(generation: number, signal: AbortSignal): Promise<void> {
    if (!this.current(generation, signal) || !this.run || !this.enemyOrder || this.state.result?.winner !== 'player' || this.run.status !== 'transitioning') return;
    const before = this.state;
    const stage = this.run.stage + 1;
    const loop = this.options.run?.route === 'boss-loop' ? bossLoopEncounter(stage,this.options.run?.rotationStart ?? this.initialConfig.enemyId!,tuningOf(this.initialConfig),this.options.run.encounterVersion?{version:this.options.run.encounterVersion,seed:this.initialConfig.seed}:undefined) : null;
    const encounter = loop ?? (this.options.run?.mode === 'endless' ? endlessEncounter(stage, this.options.run?.rotationStart ?? this.initialConfig.enemyId!, tuningOf(this.initialConfig)) : null);
    const enemyId = encounter?.enemyId ?? this.enemyOrder[stage - 1]!;
    const config = createNextStageConfig(this.initialConfig, before, enemyId, stage);
    const scaled0 = encounter ? { ...config, combatants: { ...config.combatants, enemy: { ...config.combatants.enemy, maxHp: encounter.maxHp, initialHp: encounter.maxHp, ...(loop ? { attacks: loop.attacks } : {}) } }, ...(loop ? { enemyFixedDamageBonus: loop.fixedDamageBonus } : {}) } : config;
    const scaled = this.prepareStage(scaled0, stage);
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

  protected async runSequence(firstAction: BattleAction): Promise<boolean> {
    if(!this.beforeMutation())return false;
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
        if(this.achievements)this.achievements=trackRunAction(this.achievements,before,outcome.state,outcome.resolution,this.run?.stage??1);
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
        this.finishBoundary();
        this.emit();
      }
    }
    return accepted;
  }
}

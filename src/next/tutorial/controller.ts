// 日本語: チュートリアル専用の進行役。実際のコアと画面をそのまま使い、盤面の固定・敵の手・操作の制限だけを台本で与える。
// English: Tutorial controller. It runs the real core and UI; the script only fixes boards, enemy moves and allowed inputs.
import { BattleController } from '../app/BattleController.ts';
import type { BattleView } from '../app/BattleController.ts';
import { createBattle, getDropOptions, defaultConfig } from '../core/index.ts';
import type { BattleAction, BattleConfig, BoardSkillId } from '../core/index.ts';
import type { RewardCategory, RewardId } from '../app/rewards.ts';
import { sampleUniformIndex } from '../core/random.ts';
import { createTrialConfig } from '../config.ts';
import { ENEMY_MAX_HP, boxesFor, columnOf, scenes } from './scenes.ts';
import type { SceneName, SceneSpec } from './scenes.ts';
import { beats } from './script.ts';
import type { Beat } from './script.ts';

export interface TutorialPanel {
  readonly index: number;
  readonly total: number;
  readonly who: Beat['who'];
  readonly text: string;
  readonly expect: Beat['expect'];
  readonly highlight?: Beat['highlight'];
  readonly last: boolean;
  readonly canBack: boolean;
}

/** 日本語: 乱数列から「この列に置く」結果になる種を探す（敵の手を台本どおりにする）。 */
export function seedForColumn(legalIds: readonly string[], col: number, from = 0): number {
  const index = legalIds.indexOf(`ceiling:${col}:0`);
  if (index < 0) throw new Error(`敵が${col}列へ置けません`);
  for (let seed = from; seed < from + 100000; seed++) if (sampleUniformIndex(seed, legalIds.length).index === index) return seed;
  throw new Error('台本どおりの乱数が見つかりません');
}

export class TutorialController extends BattleController {
  private cursor = -1;
  private maxCursor = -1;
  private rewinding = false;
  private enemyQueue: string[] = [];
  private advanceResolver: (() => void) | null = null;
  private beat: Beat | null = null;
  private first: boolean;
  private finished = false;
  onPanel: (panel: TutorialPanel | null) => void = () => {};
  onFinish: () => void = () => {};

  constructor(view: BattleView, first: boolean) {
    const base = createTrialConfig('blue', 'tutorial-star', { ...defaultConfig, seed: 1 }, 'manual');
    const config: BattleConfig = { ...base, thornRule: 'owner-safe-v2' };
    super(config, view, { run: { mode: 'endless', rewards: true, rewardMode: 'categories', route: 'standard', startStage: 1, finishAtStage: 2, rotationStart: 'tutorial-star' } });
    this.first = first;
  }

  get panel(): TutorialPanel | null {
    const beat = this.beat;
    if (!beat || this.finished) return null;
    return { index: this.cursor, total: beats.length, who: beat.who, text: beat.text, expect: beat.expect, ...(beat.highlight ? { highlight: beat.highlight } : {}), last: this.cursor === beats.length - 1, canBack: this.canBack };
  }
  get done(): boolean { return this.finished; }
  /** 日本語: 何をさせたいか。UI側のロックとハイライトに使う。 */
  get expect(): Beat['expect'] | null { return this.beat && !this.finished ? this.beat.expect : null; }

  // --- 場面の固定 ---
  snap(name: SceneName): void {
    const spec: SceneSpec = scenes[name];
    const cur = this.state;
    const stage = this.run?.stage ?? 1;
    const playerHp = spec.playerHp === undefined || spec.playerHp === 'keep' ? cur.hp.player.current : spec.playerHp;
    const config: BattleConfig = {
      ...cur.config,
      initialBoxes: boxesFor(spec.player, spec.enemy),
      firstActor: spec.first ?? 'player',
      initialGauge: spec.gauge ?? 0,
      combatants: {
        player: { ...cur.config.combatants.player, maxHp: cur.hp.player.max, initialHp: Math.min(playerHp, cur.hp.player.max) },
        enemy: { ...cur.config.combatants.enemy, maxHp: ENEMY_MAX_HP[stage === 1 ? 1 : 2], initialHp: spec.enemyHp },
      },
    };
    this.state = { ...createBattle(config), build: cur.build };
    this.emit();
  }

  protected override prepareStage(config: BattleConfig, _stage: number): BattleConfig {
    // 日本語: 第2戦は空の盤面・星人HP25から。English: Battle two starts empty with the star at 25 HP.
    return { ...config, initialBoxes: [], initialGauge: 0, firstActor: 'player', combatants: { ...config.combatants, enemy: { ...config.combatants.enemy, maxHp: ENEMY_MAX_HP[2], initialHp: ENEMY_MAX_HP[2] } } };
  }

  // --- 敵の手 ---
  protected override automaticAction(): BattleAction | null {
    if (this.run?.status === 'retired' || this.state.result) return null;
    if (this.state.actor === 'enemy') {
      const move = this.enemyQueue.shift() ?? 'wait';
      if (move === 'wait') {
        // 日本語: 様子見＝敵は箱を置かずに手番を返す。English: "Waiting" hands the turn straight back.
        this.state = { ...this.state, actor: 'player', playerTurnStarted: false };
        return super.automaticAction();
      }
      const legal = getDropOptions(this.state).filter(option => option.available).map(option => option.id);
      this.state = { ...this.state, rngState: seedForColumn(legal, columnOf(move)) };
      return { type: 'enemy' };
    }
    return super.automaticAction();
  }

  // --- 操作の制限 ---
  private resolveExpect(): void { const r = this.advanceResolver; this.advanceResolver = null; r?.(); }
  override async drop(candidateId: string): Promise<boolean> {
    const e = this.expect;
    if (e?.kind !== 'drop' || candidateId !== `ceiling:${columnOf(e.col)}:0`) return false;
    const beat = this.beat!;
    this.enemyQueue = [...(beat.enemy ?? ['wait'])];
    const ok = await super.drop(candidateId);
    if (ok) this.resolveExpect();
    return ok;
  }
  override async boardSkill(skillId: BoardSkillId, row?: number, target?: { row: number; col: number; orientation?: number }): Promise<boolean> {
    const e = this.expect;
    if (e?.kind !== 'board' || row !== e.row) return false;
    this.enemyQueue = [...(this.beat!.enemy ?? ['wait'])];
    const ok = await super.boardSkill(skillId, row, target);
    if (ok) this.resolveExpect();
    return ok;
  }
  override async instantSkill(_slot: number): Promise<boolean> { return false; }
  override async transform(): Promise<boolean> {
    if (this.expect?.kind !== 'transform') return false;
    const ok = await super.transform();
    if (ok) this.resolveExpect();
    return ok;
  }
  override async chooseCategory(offerId: string, category: RewardCategory): Promise<boolean> {
    const e = this.expect;
    if (e?.kind !== 'category' || category !== e.category) return false;
    const ok = await super.chooseCategory(offerId, category);
    if (ok) this.resolveExpect();
    return ok;
  }
  override async chooseReward(offerId: string, rewardId: RewardId | null, replacement?: number): Promise<boolean> {
    if (this.expect?.kind !== 'reward') return false;
    const ok = await super.chooseReward(offerId, rewardId, replacement);
    if (ok) this.resolveExpect();
    return ok;
  }

  // --- 台本の進行 ---
  /** 日本語: 1つ前の台詞へ戻れるか。場面を切り替えた直後や、直前が操作の場面へは戻らない。 */
  get canBack(): boolean {
    const beat = this.beat;
    if (!beat || this.finished || this.cursor < 1 || this.resolving) return false;
    return beats[this.cursor - 1]!.expect.kind === 'tap' && !beat.scene && !beat.autoEnemy;
  }
  /** 日本語: 「戻る」。盤面は変えずに台詞だけ1つ戻す。 */
  back(): void {
    if (!this.canBack) return;
    this.rewinding = true;
    this.resolveExpect();
  }
  /** 日本語: 「つぎへ」。tap型の台詞だけを進める。 */
  tap(): void { if (this.expect?.kind === 'tap') this.resolveExpect(); }

  /** 日本語: 台本を最後まで実行する。途中でdestroyされたら静かに止まる。 */
  async play(): Promise<void> {
    await this.start();
    for (this.cursor = 0; this.cursor < beats.length && !this.destroyedFlag; this.cursor++) {
      const beat = beats[this.cursor]!;
      this.beat = beat;
      // 日本語: 戻ってから進み直す時は場面や敵の手をやり直さない。
      const fresh = this.cursor > this.maxCursor;
      this.maxCursor = Math.max(this.maxCursor, this.cursor);
      if (beat.scene && fresh) this.snap(beat.scene);
      if (beat.autoEnemy && fresh) {
        this.enemyQueue = [...beat.autoEnemy];
        const next = this.automaticAction();
        if (next) await this.runSequence(next);
      }
      this.onPanel(this.panel);
      await new Promise<void>(resolve => { this.advanceResolver = resolve; });
      if (this.destroyedFlag) return;
      if (this.rewinding) { this.rewinding = false; this.cursor -= 2; }
    }
    this.finished = true; this.beat = null;
    this.onPanel(null);
    this.onFinish();
  }
  get isFirstRun(): boolean { return this.first; }
  private destroyedFlag = false;
  override destroy(): void { this.destroyedFlag = true; super.destroy(); const r = this.advanceResolver; this.advanceResolver = null; r?.(); }
  /** 日本語: 描画のたびに現在の台詞を画面側へ知らせる。 */
  refreshPanel(): void { this.onPanel(this.panel); }
}

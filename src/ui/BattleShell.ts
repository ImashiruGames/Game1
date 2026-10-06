import { enemyIntentLabel } from './battlePresentation.ts';
import { element } from './dom.ts';
import { battleMarkup } from './battleMarkup.ts';
import { BattleSettings } from './BattleSettings.ts';
import { getAvailableBoardSkills, getDropOptions, getEnemyIntent, getPlayerSkills, getRowSkillPreview, gaugeDefinition, needsTurnStart, playerPower, skillRank, tuningOf } from '../core/index.ts';
import type { BattleRunState } from '../app/BattleController.ts';
import type { BattleConfig, BattleEvent, BattleState, BoardSkillId, DropOption } from '../core/index.ts';
import { LoadoutView } from './LoadoutView.ts';
import { RewardPanel } from './RewardPanel.ts';
import type { RewardId } from '../app/rewards.ts';
import { BattleLog } from './BattleLog.ts';
import { enemyPortraits, playerPortraits, transformedPortraits } from './portraits.ts';


/** 日本語: 将来枠は明確に無効化し、未実装の能力を選べるように見せない。
 * English: Reserved extension slots are visibly disabled, never pretend abilities. */
export class BattleShell {
  readonly boardHost: HTMLElement;
  private root: HTMLElement;
  private onDrop: (id: string) => void;
  private log: BattleLog;
  private lastDropSignature = '';
  private state?: BattleState;
  private busy = true;
  private settings: BattleSettings;
  private selectedRow: number | null = null;
  private activeSkill: BoardSkillId | null = null;
  private loadout!: LoadoutView;
  private rewards!: RewardPanel;
  private onInstant: (slot: number) => void = () => {};
  private onReward: (offerId: string, reward: RewardId | null, replacement?: number) => Promise<boolean> = async () => false;
  private onTargetMode: (mode: 'row' | 'confirm' | null) => void = () => {};
  private onSkill: (skill: BoardSkillId, row?: number) => void = () => {};
  private onRowPreview: (row: number | null) => void = () => {};

  constructor(root: HTMLElement, fixtures: readonly BattleConfig[], onDrop: (id: string) => void) {
    this.root = root;
    this.onDrop = onDrop;
    // 日本語: 戦闘の3カラムを優先し、補助情報はダイアログへ退避する。
    // English: Keep combat in three columns; secondary tools never grow the battlefield.
    root.innerHTML = battleMarkup();
    this.log = new BattleLog(root);
    this.settings = new BattleSettings(root, fixtures);
    this.loadout = new LoadoutView(element(root, '#normal-skills'), (slot, id) => {
      if (!this.busy && !this.targetingSkill && !this.state?.result && this.state?.actor === 'player' && this.state.build?.slots[slot]?.id === id) this.onInstant(slot);
    });
    this.rewards = new RewardPanel(element<HTMLDialogElement>(root, '#reward-dialog'), (id, reward, replacement) => this.onReward(id, reward, replacement));
    this.bindDialog('#open-log', '#log-dialog');
    this.bindDialog('#open-settings', '#settings-dialog', () => this.settings.beforeOpen());
    this.bindDialog('#open-drops', '#drops-dialog');
    element(root, '#open-skill').addEventListener('click', () => { if (this.activeSkill) this.cancelSkill(); else this.prepareSkill(); });
    element(root, '#cancel-skill').addEventListener('click', () => this.cancelSkill(true));
    element<HTMLSelectElement>(root, '#skill-row-select').addEventListener('change', () => {
      const value = element<HTMLSelectElement>(root, '#skill-row-select').value;
      this.hoverSkillRow(value === '' ? null : Number(value));
    });
    root.addEventListener('keydown', event => { if (event.key === 'Escape' && this.activeSkill) { event.preventDefault(); this.cancelSkill(true); } });
    element(root, '#confirm-skill').addEventListener('click', () => this.confirmSkill());
    this.boardHost = element(root, '#board-stage');
    this.updatePortrait('blue');
    this.reset();
  }

  /** 日本語: native dialog がフォーカス制御と Escape を担う。
   * English: Native dialogs provide focus containment, Escape, and focus restoration. */
  private bindDialog(triggerSelector: string, dialogSelector: string, beforeOpen?: () => boolean): void {
    const trigger = element<HTMLButtonElement>(this.root, triggerSelector);
    const dialog = element<HTMLDialogElement>(this.root, dialogSelector);
    trigger.addEventListener('click', () => {
      if (beforeOpen && !beforeOpen()) return;
      if (this.targetingSkill) this.cancelSkill();
      dialog.showModal();
      trigger.setAttribute('aria-expanded', 'true');
    });
    element(dialog, '.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => trigger.setAttribute('aria-expanded', 'false'));
    dialog.addEventListener('click', event => {
      // 日本語: 背景だけで閉じ、ダイアログの余白クリックでは閉じない。
      // English: Dismiss only a backdrop click, not padding within the dialog.
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  }

  /** 日本語: 選択フォームではなく、確定した戦闘のキャラクターに表示を合わせる。
   * English: Portraits follow committed battle identity, never unapplied form choices. */
  private updatePortrait(id: 'blue' | 'red', transformed = false): void {
    const portrait = transformed ? transformedPortraits[id] : playerPortraits[id];
    const image = element<HTMLImageElement>(this.root, '#player-portrait');
    if (image.src !== portrait.src) image.src = portrait.src;
    image.alt = portrait.alt;
    const stage = element(this.root, '#player-portrait-stage');
    stage.dataset.character = id;
    stage.dataset.transformed = String(transformed);
    stage.style.setProperty('--portrait-height', portrait.height);
    stage.style.setProperty('--portrait-anchor', portrait.anchorX);
    stage.style.setProperty('--portrait-top', portrait.top);
  }

  bindRestart(current: () => void, selected: (config: BattleConfig, continuous: boolean) => void | Promise<void>): void {
    element(this.root, '#result-restart').addEventListener('click', current);
    element(this.root, '#reward-restart').addEventListener('click', current);
    element(this.root, '#restart-current').addEventListener('click', current);
    this.settings.bindApply(selected);
  }

  bindSkills(useSkill: (skill: BoardSkillId, row?: number) => void, previewRow: (row: number | null) => void, targetMode: (mode: 'row' | 'confirm' | null) => void): void {
    this.onSkill = useSkill;
    this.onRowPreview = previewRow;
    this.onTargetMode = targetMode;
  }

  bindBuild(useInstant: (slot: number) => void, chooseReward: (offerId: string, reward: RewardId | null, replacement?: number) => Promise<boolean>): void {
    this.onInstant = useInstant; this.onReward = chooseReward;
  }

  private renderSkills(state: BattleState, resolving: boolean): void {
    const red = state.config.characterId === 'red';
    const enabled = getAvailableBoardSkills(state);
    const skills = getPlayerSkills(state.config);
    const id: BoardSkillId = red ? 'ember' : 'pain-shared';
    element<HTMLButtonElement>(this.root, '#open-skill').disabled = resolving || !!state.result || state.actor !== 'player' || !enabled.includes(id);
    element(this.root, '#board-skill-name').textContent = red ? 'ほむらの火種' : '痛みはお互いに';
    element(this.root, '#board-skill-summary').textContent = red ? `HP−${tuningOf(state.config).board.emberCost}・敵箱を最大${tuningOf(state.config).board.emberConversions}個変換` : '横一列を消去・相互ダメージ';
    element(this.root, '#growth-value').textContent = skillRank(state, 'grow-fire') ? `成長 +${state.link3Growth}` : '3枠';
    if (skills.boardSkills.length === 0) { element(this.root, '#board-skill-name').textContent = '盤面スキルなし'; element(this.root, '#board-skill-summary').textContent = 'この検証設定では使用しません'; }
    this.loadout.render(state, resolving || this.targetingSkill);

  }

  private renderTransformation(state: BattleState): void {
    const rules = gaugeDefinition(state.config.characterId, tuningOf(state.config));
    const gauge = element(this.root, '#transformation-gauge');
    const value = state.gauge;
    gauge.setAttribute('aria-valuemax', String(rules?.cap ?? 0));
    gauge.setAttribute('aria-valuenow', String(value));
    gauge.dataset.ready = String(!!rules && value >= rules.cost);
    element(this.root, '#gauge-number').textContent = String(value);
    element(this.root, '#gauge-fill').style.width = `${rules ? value / rules.cap * 100 : 0}%`;
    element(this.root, '#gauge-rule').textContent = rules ? `${rules.cost}で待機・${tuningOf(state.config).transformation.minimumLink}リンク以上` : 'この設定ではなし';
    const effect = state.transformation;
    element(this.root, '#transformation-status').textContent = effect?.character === 'blue' ? '変化中 · このステージ終了まで'
      : effect?.character === 'red' ? effect.remainingStarts === 0 ? '変化中 · この手番の行動終了まで' : `変化中 · 無料投入あと${effect.remainingStarts}手番`
      : '攻撃後に条件成立で自動発動';
  }

  get targetingSkill(): boolean { return this.activeSkill != null; }

  private prepareSkill(): boolean {
    const state = this.state;
    if (!state || this.busy || state.result || state.actor !== 'player') return false;
    const red = state.config.characterId === 'red';
    const skill = red ? 'ember' : 'pain-shared';
    if (!getAvailableBoardSkills(state).includes(skill)) return false;
    this.activeSkill = skill;
    this.selectedRow = null;
    element(this.root, '#skill-target').hidden = false;
    element(this.root, '.player-panel').dataset.targeting = 'true';
    element(this.root, '#open-skill').setAttribute('aria-expanded', 'true');
    element(this.root, '#skill-instruction').textContent = red ? `HPを${tuningOf(state.config).board.emberCost}消費して変換します` : '盤面の行をクリックして消去';
    const select = element<HTMLSelectElement>(this.root, '#skill-row-select');
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '行を選択';
    select.append(placeholder);
    element(this.root, '#skill-row-label').hidden = red;
    const confirm = element<HTMLButtonElement>(this.root, '#confirm-skill');
    confirm.disabled = !red;
    confirm.textContent = red ? '火種を使う' : 'この行を消す';
    if (red) {
      const count = state.boxes.filter(box => box.owner === 'enemy').length;
      element(this.root, '#skill-preview').textContent = state.hp.player.current <= tuningOf(state.config).board.emberCost ? '自分のHPが0になります。敗北し、箱の変換は行いません。' : `自分のHP ${state.hp.player.current} → ${state.hp.player.current - tuningOf(state.config).board.emberCost} / 敵箱 ${Math.min(tuningOf(state.config).board.emberConversions, count)}個を変換${count === 0 ? '（対象0個でも1手を消費します）' : '（重複なし）'}`;
    } else {
      for (let row = 0; row < state.config.board.height; row += 1) {
        const option = document.createElement('option');
        option.value = String(row);
        option.textContent = `${row + 1}行目`;
        select.append(option);
      }
      this.hoverSkillRow(null);
    }
    this.hover(null);
    this.updateTargetControls();
    this.onTargetMode(red ? 'confirm' : 'row');
    return true;
  }

  /** 日本語: ホバーは予告だけ。クリック時も、現在のモードと行を再検証する。
   * English: Hover only previews; every commit validates the current session and bounds. */
  hoverSkillRow(row: number | null): void {
    if (!this.state || this.busy || this.activeSkill !== 'pain-shared') return;
    const preview = row === null ? null : getRowSkillPreview(this.state, row);
    this.selectedRow = preview?.valid ? row : null;
    element<HTMLSelectElement>(this.root, '#skill-row-select').value = this.selectedRow === null ? '' : String(this.selectedRow);
    element<HTMLButtonElement>(this.root, '#confirm-skill').disabled = this.selectedRow === null;
    element(this.root, '#skill-preview').textContent = preview?.valid
      ? `${row! + 1}行目 · 敵に${preview.enemyDamage} / 自分に${preview.playerDamage}ダメージ。箱${preview.boxIds.length}個を消去${preview.boxIds.length === 0 ? '（空行でも1手を消費）' : ''}${preview.playerDamage >= this.state.hp.player.current ? '。この操作で敗北します' : ''}`
      : '消したい行にカーソルを合わせるか、下で選択';
    this.showRowPreview(this.selectedRow);
  }

  commitSkillRow(row: number): void {
    if (this.activeSkill !== 'pain-shared') return;
    this.hoverSkillRow(row);
    this.confirmSkill();
  }

  cancelSkill(restoreFocus = false): void {
    const wasActive = this.activeSkill != null;
    this.activeSkill = null;
    this.selectedRow = null;
    element(this.root, '#skill-target').hidden = true;
    element(this.root, '.player-panel').dataset.targeting = 'false';
    element(this.root, '#open-skill').setAttribute('aria-expanded', 'false');
    this.showRowPreview(null);
    if (wasActive) { this.onTargetMode(null); this.updateTargetControls(); }
    if (restoreFocus) element(this.root, '#open-skill').focus();
  }

  private updateTargetControls(): void {
    if (!this.state) return;
    element<HTMLButtonElement>(this.root, '#open-drops').disabled = this.targetingSkill;
    this.renderDropButtons(this.state, getDropOptions(this.state), this.busy);
    if (this.targetingSkill) element(this.root, '#action-hint').textContent = this.activeSkill === 'pain-shared' ? '消す行を選択中 · Escで取消' : '火種の使用を確認中 · Escで取消';
    else element(this.root, '#action-hint').textContent = '▼ を選んで箱を投入';
  }

  private showRowPreview(row: number | null): void {
    // 日本語: 任意の描画予告が失敗しても、選択・確認操作を壊さない。
    // English: Optional visual highlighting cannot block selection or confirmation.
    try { this.onRowPreview(row); } catch (error) { console.warn('Row preview unavailable; skill selection is still valid.', error); }
  }

  private confirmSkill(): void {
    const state = this.state;
    const skill = this.activeSkill;
    if (!state || !skill || this.busy || state.result || state.actor !== 'player') return;
    if (skill === 'pain-shared' && (this.selectedRow === null || !getRowSkillPreview(state, this.selectedRow).valid)) return;
    if (!getAvailableBoardSkills(state).includes(skill)) return;
    const row = skill === 'pain-shared' ? this.selectedRow! : undefined;
    // 日本語: コールバックより前に選択を閉じる。連打で同じ行動を二重送信しない。
    // English: End targeting before dispatch, preventing a second stale click from acting.
    this.cancelSkill();
    this.onSkill(skill, row);
  }

  get reducedMotion(): boolean {
    return element<HTMLInputElement>(this.root, '#reduce-motion').checked || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }


  reset(): void {
    this.log.reset();
    this.lastDropSignature = '';
    element(this.root, '#result-overlay').hidden = true;
    this.cancelSkill();
    this.rewards.close();
    this.log.add('戦闘開始', '天井辺の ▼ から、最初の箱を投入', 'system');
  }

  render(state: BattleState, resolving: boolean, run: BattleRunState | null = null): void {
    element(this.root, '#stage-label').textContent = run ? `STAGE ${String(run.stage).padStart(2, '0')}` : 'TEST BATTLE';
    element(this.root, '#run-status').textContent = run ? run.status === 'reward' ? '撃破報酬を選択中' : run.status === 'transitioning' ? '次の敵へ…' : run.status === 'lost' ? `連戦終了 · ${run.defeatedCount}体撃破` : run.status === 'cleared' ? `GAME CLEAR · ${run.defeatedCount}体撃破` : `${run.defeatedCount}体撃破 · HPと最上段の自箱を継承` : '単独戦の検証';
    this.state = state;
    this.busy = resolving;
    if (resolving || state.result || state.actor !== 'player') this.cancelSkill();
    this.updatePortrait(state.config.characterId === 'red' ? 'red' : 'blue', state.transformation !== null);
    element(this.root, '#player-name').textContent = state.config.characterId === 'red' ? 'ルビィ' : state.config.characterId === 'blue' ? '青の子' : 'あなた';
    const enemy = enemyPortraits[state.config.enemyId ?? 'merarun'];
    element(this.root, '#enemy-name').textContent = enemy.label;
    const enemyImage = element<HTMLImageElement>(this.root, '#enemy-portrait');
    if (enemyImage.src !== enemy.src) enemyImage.src = enemy.src;
    enemyImage.alt = enemy.alt;
    this.renderSkills(state, resolving || needsTurnStart(state));
    this.renderTransformation(state);
    this.rewards.render(state, run, resolving);
    const intent = getEnemyIntent(state);
    element(this.root, '#enemy-intent-title').textContent = enemyIntentLabel(intent);
    element(this.root, '#enemy-intent-description').textContent = `敵${state.enemyTurnCount + 1}手目 · ${intent.type === 'heal' ? 'HP上限まで回復' : 'ランダム投入'}`;
    element(this.root, '#blocked-intent-warning').hidden = intent.type !== 'drop';
    for (const actor of ['player', 'enemy'] as const) {
      const hp = state.hp[actor];
      const hpNode = element(this.root, `#${actor}-hp`);
      hpNode.textContent = `${Math.max(0, hp.current)} `;
      const maximum = document.createElement('i');
      maximum.textContent = `/ ${hp.max}`;
      hpNode.append(maximum);
      hpNode.title = hp.current < 0 ? `内部HP: ${hp.current}（オーバーキル ${-hp.current}）` : `HP ${hp.current}`;
      element(this.root, `#${actor}-hp-fill`).style.width = `${Math.max(0, Math.min(100, hp.current / hp.max * 100))}%`;
      const table = state.config.combatants[actor].attacks;
      element(this.root, `#${actor}-table`).textContent = `3リンク → ${actor === 'player' ? playerPower(state, 3) : table[3]}　4 → ${actor === 'player' ? playerPower(state, 4) : table[4]}　5+ → ${actor === 'player' ? playerPower(state, 5) : table[5]}`;
    }
    element(this.root, '#turn-number').textContent = String(state.turn).padStart(2, '0');
    element(this.root, '#turn-owner').textContent = state.result ? '戦闘終了' : resolving ? '解決中…' : state.actor === 'player' ? 'あなたの手番' : '敵の手番';
    element(this.root, '#board-dimensions').textContent = `${state.config.board.width} × ${state.config.board.height} · ↓ 重力`;
    const options = getDropOptions(state);
    const count = options.filter(option => option.available).length;
    element(this.root, '#legal-count').textContent = `${count} 箇所`;
    element(this.root, '#action-hint').textContent = state.result ? '戦闘終了。再開始できます' : resolving ? '行動を解決中…' : count === 0 ? getAvailableBoardSkills(state).length ? '投入不可。盤面スキルを選択' : '投入不可。手番をスキップ' : '▼ を選んで箱を投入';
    this.renderDropButtons(state, options, resolving);
    const overlay = element(this.root, '#result-overlay');
    overlay.hidden = !state.result || (state.result.winner === 'player' && (run?.status === 'transitioning' || run?.status === 'reward'));
    if (state.result) {
      const won = state.result.winner === 'player';
      element(this.root, '#result-kicker').textContent = won ? run?.status === 'cleared' ? 'GAME CLEAR' : 'VICTORY' : 'DEFEAT';
      element(this.root, '#result-title').textContent = won ? run?.status === 'cleared' ? '踏破' : '勝利' : '敗北';
      element(this.root, '#result-description').textContent = won ? run?.status === 'cleared' ? `試験用ルートの${run.defeatedCount}体を倒しました。` : '敵のHPが0になりました。'  : state.result.reason === 'enemy-blocked' ? '敵の通常投入が不能になり、即死相当の攻撃でHPが0になりました。' : 'あなたのHPが0になりました。ここで連戦終了です。';
      overlay.dataset.outcome = won ? 'win' : 'lose';
    }
  }

  private renderDropButtons(state: BattleState, options: readonly DropOption[], resolving: boolean): void {
    const signature = `${state.config.id}:${this.targetingSkill}:${resolving}:${state.result?.winner ?? ''}:${state.actor}:` + options.map(o => `${o.id}:${o.available}`).join('|');
    if (signature === this.lastDropSignature) return;
    this.lastDropSignature = signature;
    const target = element(this.root, '#drop-options');
    target.replaceChildren();
    for (const option of options) {
      const button = document.createElement('button');
      button.textContent = `${option.edge.col + 1}列 / ${option.edge.row + 1}行上辺${option.available ? ' ▼' : ' ×'}`;
      button.disabled = this.targetingSkill || resolving || !!state.result || state.actor !== 'player' || !option.available;
      button.setAttribute('aria-label', `${option.edge.col + 1}列、${option.edge.row + 1}行の天井辺。${option.available ? '投入する' : '出現マスが塞がれています'}`);
      button.addEventListener('click', () => {
        if (this.targetingSkill || this.busy || this.state?.result || this.state?.actor !== 'player') return;
        element<HTMLDialogElement>(this.root, '#drops-dialog').close();
        this.onDrop(option.id);
      });
      target.append(button);
    }
  }

  hover(option: DropOption | null): void {
    element(this.root, '#landing-hint').textContent = option?.landing ? `着地予測 ${option.landing.col + 1}列・${option.landing.row + 1}行` : '▼ で着地点を予測';
  }

  event(event: BattleEvent, turn: number): void { this.log.event(event, turn); }

  stageAdvanced(state: BattleState, run: BattleRunState): void {
    this.lastDropSignature = '';
    this.hover(null);
    this.cancelSkill();
    this.log.add(`STAGE ${run.stage} · ${enemyPortraits[state.config.enemyId ?? 'merarun'].label}`, `HP${state.hp.player.current}・箱${state.boxes.length}個を継承。成長はリセット`, 'system');
  }


}

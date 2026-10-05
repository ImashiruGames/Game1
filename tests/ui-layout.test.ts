import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { observeBoardViewport } from '../src/ui/boardViewport.ts';

// 日本語: DOM構造の退行とサイズ監視を検証。最終的な画面配置はブラウザーでも確認する。
// English: These are markup-contract and resize-observer tests, not rendered-browser assertions.
const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version as string;
const shell = readFileSync(new URL('../src/ui/BattleShell.ts', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../src/ui/BattleSettings.ts', import.meta.url), 'utf8');
const structure = readFileSync(new URL('../src/ui/battleMarkup.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/ui/BoardScene.ts', import.meta.url), 'utf8');
const markup = structure.split('return `')[1]!.split('`;')[0]!;

test('battle markup orders player status, shared board, and enemy status in three columns', () => {
  const player = markup.indexOf('class="status-panel player-panel"');
  const board = markup.indexOf('class="board-panel"');
  const enemy = markup.indexOf('class="status-panel enemy-panel"');
  assert.ok(player >= 0 && board > player && enemy > board);
  const playerPanel = markup.slice(player, board);
  for (const label of ['player-hp', '盤面スキル', '通常スキル', '変化ゲージ']) assert.ok(playerPanel.includes(label));
  assert.ok(markup.slice(enemy).includes('enemy-hp'));
  assert.ok(markup.slice(enemy).includes('次の行動'));
  assert.ok(markup.includes(`GAME1 · v${packageVersion}`));
  assert.ok(markup.includes('href="/docs/index.html"'));
  assert.equal(markup.includes('rules-card'), false);
  assert.equal(markup.includes('title-row'), false);
  assert.equal(markup.includes('extension-panel'), false);
});

test('optional utilities use labelled closed native dialogs and unique IDs', () => {
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const name of ['log', 'settings', 'drops']) {
    assert.ok(markup.includes(`aria-controls="${name}-dialog" aria-expanded="false"`));
    assert.match(markup, new RegExp(`<dialog id="${name}-dialog"[^>]+aria-labelledby="${name}-title"`));
    assert.doesNotMatch(markup, new RegExp(`<dialog id="${name}-dialog"[^>]*\\bopen(?:\\s|>)`));
  }
  assert.ok(shell.includes('dialog.showModal()'));
  assert.ok(shell.includes("dialog.addEventListener('close'"));
  assert.ok(settings.includes("generation === this.generation && dialog.open"));
  assert.ok(shell.includes("'#drops-dialog').close()"));
});

test('desktop layout uses viewport height and shrinking board row, with a narrow-screen fallback', () => {
  assert.ok(css.includes('height: 100dvh'));
  assert.ok(css.includes('grid-template-rows: 44px 80px minmax(0, 1fr)'));
  assert.ok(css.includes('grid-template-columns: minmax(202px, 240px) minmax(0, 1fr) minmax(202px, 240px)'));
  assert.ok(css.includes('grid-template-rows: minmax(0, 1fr)'));
  assert.ok(css.includes('@media (max-width: 800px)'));
  assert.ok(scene.includes('mode: Phaser.Scale.FIT'));
  assert.ok(scene.includes('observeBoardViewport(parent, () => game.scale.refresh())'));
  assert.ok(scene.includes('Phaser.Core.Events.DESTROY, stopObserving'));
});

test('board observer refreshes positive changed sizes only and disconnects on cleanup', () => {
  const host = {} as Element;
  let observed: Element | undefined;
  let callback: ResizeObserverCallback;
  let disconnected = 0;
  let refreshes = 0;
  class FakeObserver {
    constructor(fn: ResizeObserverCallback) { callback = fn; }
    observe(value: Element) { observed = value; }
    disconnect() { disconnected += 1; }
  }
  const stop = observeBoardViewport(host, () => { refreshes += 1; }, FakeObserver as unknown as typeof ResizeObserver);
  const emit = (width: number, height: number, target = host) => callback!([{ target, contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
  assert.equal(observed, host);
  emit(0, 0);
  emit(600, 0);
  emit(600, 520, {} as Element);
  assert.equal(refreshes, 0);
  emit(600, 520);
  assert.equal(refreshes, 1);
  emit(600, 520);
  assert.equal(refreshes, 1);
  emit(600, 440);
  emit(460, 440);
  assert.equal(refreshes, 3);
  stop();
  assert.equal(disconnected, 1);
});

test('portrait cards order name, untouched image framing, HP, and optional attack details', () => {
  const player = markup.slice(markup.indexOf('class="combatant player"'), markup.indexOf('class="player-loadout"'));
  const enemy = markup.slice(markup.indexOf('class="combatant enemy"'), markup.indexOf('class="intent-card"'));
  for (const [name, card] of [['player', player], ['enemy', enemy]] as const) {
    assert.ok(card.indexOf(`id="${name}-title"`) < card.indexOf('portrait-stage'));
    assert.ok(card.indexOf('portrait-stage') < card.indexOf(`id="${name}-hp"`));
    assert.ok(card.indexOf(`id="${name}-hp"`) < card.indexOf('<details class="attack-stat">'));
    assert.ok(card.includes('draggable="false"'));
  }
  assert.ok(css.includes('height: clamp(160px, 26.3dvh, 200px)'));
  assert.ok(css.includes('object-fit: contain'));
  assert.ok(css.includes('var(--portrait-anchor)'));
  assert.ok(markup.includes('id="portrait-select"'));
  const change = shell.split("private updatePortrait(id: 'blue' | 'red', transformed = false): void {")[1]!.split('\n  }')[0]!;
  assert.ok(change.includes('image.src = portrait.src'));
  assert.equal(change.includes('onDrop'), false);
  assert.equal(change.includes('restart'), false);
  assert.equal(change.includes('BattleConfig'), false);
});


test('battle animation space stays separate and all non-board controls move to enemy panel', () => {
  assert.ok(markup.indexOf('class="battle-stage-preview"') < markup.indexOf('<main id="main"'));
  const board = markup.slice(markup.indexOf('<section class="board-panel"'), markup.indexOf('class="status-panel enemy-panel"'));
  const enemy = markup.slice(markup.indexOf('class="status-panel enemy-panel"'), markup.indexOf('</main>'));
  assert.ok(board.includes('id="board-stage"'));
  for (const id of ['turn-number', 'turn-owner', 'board-dimensions', 'action-hint', 'legal-count', 'landing-hint', 'open-drops']) {
    assert.equal(board.includes(`id="${id}"`), false);
    assert.ok(enemy.includes(`id="${id}"`));
  }
  assert.ok(markup.includes('ドットアニメーションは未実装'));
});


test('baseline sidebar spacing reserves room for all controls without shrinking the portrait', () => {
  assert.ok(css.includes('flex-direction: column; gap: 8px; overflow-y: auto'));
  assert.ok(css.includes('background: var(--panel); padding: 10px'));
  assert.ok(css.includes('.slot-group { margin-top: 6px; }'));
  assert.ok(css.includes('height: clamp(160px, 26.3dvh, 200px)'));
  assert.ok(css.includes('grid-template-rows: 44px 80px minmax(0, 1fr)'));
});


test('skills expose labelled selection previews and committed character settings', () => {
  for (const id of ['open-skill', 'skill-target', 'skill-row-select', 'skill-preview', 'confirm-skill', 'cancel-skill', 'enemy-select', 'continuous-run']) assert.ok(markup.includes(`id="${id}"`));
  assert.ok(shell.includes('getRowSkillPreview(this.state, row)'));
  assert.equal(markup.includes('skill-dialog'), false);
  assert.ok(shell.includes("event.key === 'Escape'"));
  assert.ok(shell.includes('commitSkillRow(row: number)'));
  assert.ok(shell.includes('this.targetingSkill || this.busy'));
  assert.ok(css.includes('.player-panel[data-targeting=true] .passive-group'));
  assert.ok(scene.includes("this.skillMode === null"));
  assert.ok(shell.includes('state.hp.player.current <= tuningOf(state.config).board.emberCost'));
  assert.ok(shell.includes('対象0個でも1手を消費します'));
  assert.ok(shell.includes('空行でも1手を消費'));
  assert.ok(shell.includes('getEnemyIntent(state)'));
  assert.ok(settings.includes('await selected(configured'));
  assert.ok(shell.includes("run?.status === 'cleared'"));
  assert.equal(shell.includes('見た目だけ変更'), false);
  assert.ok(scene.includes('previewRow(row: number | null)'));
});

test('transformation gauge shows only the current numeric value inside, with cost outside and readiness colors', () => {
  assert.ok(markup.includes('role="meter" aria-label="変化ゲージ"'));
  assert.ok(markup.includes('<strong id="gauge-number">0</strong>'));
  assert.ok(shell.includes("'#gauge-number').textContent = String(value)"));
  assert.ok(shell.includes('value / rules.cap * 100'));
  assert.ok(shell.includes('value >= rules.cost'));
  assert.ok(css.includes('.transformation-gauge[data-ready=true] #gauge-fill'));
  assert.ok(css.includes('linear-gradient(90deg, #ea7480'));
  assert.ok(css.includes('.player-portrait[data-transformed=true] img'));
  assert.ok(scene.includes('if (!reduced) this.tweens.add({ targets: effect'));
  assert.ok(scene.includes("signal.addEventListener('abort', finish"));
});

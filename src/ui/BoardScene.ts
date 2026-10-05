import Phaser from 'phaser';
import { defaultTuning } from '../core/tuning.ts';
import { getDropOptions } from '../core/index.ts';
import type { BattleState, Box, DropOption, Resolution } from '../core/index.ts';
import { ownerTheme } from './theme.ts';
import { observeBoardViewport } from './boardViewport.ts';
import { feedbackAnchor, feedbackText, effectTiming } from './battlePresentation.ts';
import type { BattleEffect } from './battlePresentation.ts';

const WIDTH = 464;
const HEIGHT = 552;
const FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * 日本語: Phaser は整数座標を描画するだけ。合法性、リンク、HP は Core が決める。
 * English: Phaser translates core coordinates into pixels; it never decides game rules.
 */
export class BoardScene extends Phaser.Scene {
  private acceptingInput = false;
  private currentState?: BattleState;
  private skillMode: 'row' | 'confirm' | null = null;
  private effectLayer?: Phaser.GameObjects.Container;
  private layer?: Phaser.GameObjects.Container;
  private cell = 54;
  private left = 70;
  private top = 56;
  private selected: string | null = null;
  private targetRow: number | null = null;
  private rowOverlay?: Phaser.GameObjects.Graphics;
  private boardWidth = 0;
  private boardHeight = 0;
  private preview?: Phaser.GameObjects.Graphics;
  private onDrop: (id: string) => void;
  private onReady: () => void;
  private onHover: (option: DropOption | null) => void;
  private onTargetHover: (row: number | null) => void;
  private onTargetCommit: (row: number) => void;
  private cancelledAnimations = new Set<() => void>();

  constructor(onDrop: (id: string) => void, onReady: () => void, onHover: (option: DropOption | null) => void, onTargetHover: (row: number | null) => void, onTargetCommit: (row: number) => void) {
    super('BattleBoard');
    this.onDrop = onDrop;
    this.onReady = onReady;
    this.onHover = onHover;
    this.onTargetHover = onTargetHover;
    this.onTargetCommit = onTargetCommit;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#111c26');
    this.input.on('gameout', () => { if (this.skillMode === 'row') this.onTargetHover(null); });
    this.onReady();
  }

  draw(state: BattleState, acceptingInput: boolean): void {
    this.currentState = state;
    this.acceptingInput = acceptingInput;
    this.clearEffect();
    this.layer?.destroy(true);
    this.preview = undefined;
    this.rowOverlay = undefined;
    this.layer = this.add.container(0, 0);
    const { width, height, terrain, invalidCells } = state.config.board;
    this.boardWidth = width;
    this.boardHeight = height;
    this.cell = Math.min(54, (WIDTH - 96) / width, (HEIGHT - 100) / height);
    this.left = (WIDTH - width * this.cell) / 2;
    this.top = (HEIGHT - height * this.cell) / 2 + 8;
    const graphics = this.add.graphics();
    this.layer.add(graphics);
    const isCell = (cells: readonly { row: number; col: number }[], row: number, col: number) => cells.some(c => c.row === row && c.col === col);

    graphics.fillStyle(0x080e14, 1);
    graphics.fillRoundedRect(this.left - 8, this.top - 8, width * this.cell + 16, height * this.cell + 16, 8);
    for (let row = 0; row < height; row += 1) {
      for (let col = 0; col < width; col += 1) {
        const x = this.left + col * this.cell;
        const y = this.top + row * this.cell;
        const invalid = isCell(invalidCells, row, col);
        const solid = isCell(terrain, row, col);
        graphics.fillStyle(invalid ? 0x090e14 : solid ? 0x3a4551 : (row + col) % 2 ? 0x16232e : 0x182632);
        graphics.fillRect(x + 1, y + 1, this.cell - 2, this.cell - 2);
        if (solid) {
          graphics.lineStyle(1, 0x5b6672, 0.65);
          for (let offset = 7; offset < this.cell - 5; offset += 9) {
            graphics.lineBetween(x + offset, y + 5, x + 5, y + offset);
            graphics.lineBetween(x + this.cell - offset, y + this.cell - 5, x + this.cell - 5, y + this.cell - offset);
          }
        }
      }
    }
    // 日本語: 列番号と行番号は表示用。English: Labels do not replace the core's zero-based coordinates.
    for (let col = 0; col < width; col += 1) this.layer.add(this.add.text(this.left + (col + .5) * this.cell, this.top + height * this.cell + 23, String(col + 1), { fontFamily: FONT, fontSize: '12px', color: '#7c91a1' }).setOrigin(.5));
    for (let row = 0; row < height; row += 1) this.layer.add(this.add.text(this.left - 20, this.top + (row + .5) * this.cell, String(row + 1).padStart(2, '0'), { fontFamily: FONT, fontSize: '10px', color: '#526776' }).setOrigin(.5));

    for (const box of state.boxes) this.layer.add(this.makeBox(box));
    for (const option of getDropOptions(state)) this.drawMarker(option);
    if (this.skillMode === 'row' && acceptingInput) this.drawRowTargets();
    this.previewRow(this.targetRow);
  }

  /** 日本語: モード変更で投入の当たり判定を取り除く。Coreの手番は変えない。
   * English: Target mode replaces hit areas, not the committed battle turn. */
  setSkillMode(mode: 'row' | 'confirm' | null): void {
    this.skillMode = mode;
    this.targetRow = null;
    this.selected = null;
    if (this.currentState) this.draw(this.currentState, this.acceptingInput);
  }

  private drawRowTargets(): void {
    for (let row = 0; row < this.boardHeight; row += 1) {
      const zone = this.add.zone(this.left + this.boardWidth * this.cell / 2, this.top + (row + .5) * this.cell, this.boardWidth * this.cell, this.cell).setInteractive({ useHandCursor: true });
      this.layer?.add(zone);
      zone.on('pointerover', () => { if (this.skillMode === 'row' && this.acceptingInput) this.onTargetHover(row); });
      zone.on('pointerout', () => { if (this.skillMode === 'row') this.onTargetHover(null); });
      zone.on('pointerdown', () => { if (this.skillMode === 'row' && this.acceptingInput) this.onTargetCommit(row); });
    }
  }

  showEffect(state: BattleState, effect: BattleEffect): void {
    this.draw(state, false);
    this.effectLayer = this.add.container(0, 0);
    const color = effect.kind === 'shape' && effect.feedback?.type === 'heal' ? 0x8cf3ac : 0xffdd88;
    const g = this.add.graphics();
    this.effectLayer.add(g);
    for (const box of state.boxes.filter(box => effect.boxIds.includes(box.id))) {
      const { x, y } = this.center(box.row, box.col);
      g.fillStyle(color, .28);
      g.fillRoundedRect(x - this.cell / 2 + 3, y - this.cell / 2 + 3, this.cell - 6, this.cell - 6, 5);
      g.lineStyle(3, color, 1);
      g.strokeRoundedRect(x - this.cell / 2 + 3, y - this.cell / 2 + 3, this.cell - 6, this.cell - 6, 5);
    }
  }

  showFeedback(state: BattleState, effect: BattleEffect, reduced: boolean): void {
    if (!effect.feedback || !this.effectLayer) return;
    const feedback = feedbackText(effect.feedback);
    const label = this.add.text(0, 0, feedback.text, { fontFamily: '"Noto Sans JP", sans-serif', fontSize: '23px', fontStyle: 'bold', color: feedback.color, stroke: feedback.stroke, strokeThickness: 5, padding: { x: 5, y: 3 } }).setOrigin(.5, 1);
    const anchor = feedbackAnchor(state, effect, { left: this.left, top: this.top, cell: this.cell, width: WIDTH, height: HEIGHT }, label.width, label.height);
    label.setPosition(anchor.x, anchor.y);
    this.effectLayer.add(label);
    const timing = effectTiming(reduced);
    // 日本語: 短縮演出は移動なし。通常は余白内だけ少し浮かせる。
    // English: Reduced motion stays still; ordinary feedback floats only within safe headroom.
    if (!reduced) this.tweens.add({ targets: label, y: Math.max(label.height + 8, anchor.y - timing.float), alpha: 0, delay: timing.hold * .5, duration: timing.hold * .5 });
  }

  async animateTransformation(signal: AbortSignal, reduced: boolean, character: 'blue' | 'red', remainingStarts = defaultTuning.transformation.redBonusStarts): Promise<void> {
    if (signal.aborted) return;
    this.clearEffect();
    const effect = this.add.container(0, 0);
    this.effectLayer = effect;
    const glow = this.add.graphics();
    glow.lineStyle(5, 0xe0bcff, .95);
    glow.strokeRoundedRect(this.left - 6, this.top - 6, this.boardWidth * this.cell + 12, this.boardHeight * this.cell + 12, 8);
    effect.add(glow);
    glow.fillStyle(0x21122f, .92); glow.fillRoundedRect(42, HEIGHT / 2 - 72, WIDTH - 84, 144, 12);
    effect.add(this.add.text(WIDTH / 2, HEIGHT / 2 - 25, '変化！', { fontFamily: 'sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#f4deff', stroke: '#241433', strokeThickness: 5 }).setOrigin(.5));
    effect.add(this.add.text(WIDTH / 2, HEIGHT / 2 + 30, character === 'blue' ? 'このステージ中 · 回復を追加ダメージに' : `次の${remainingStarts}手番 · 無料の追加投入`, { fontFamily: 'sans-serif', fontSize: '16px', color: '#f0d9ff' }).setOrigin(.5));
    await new Promise<void>(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.tweens.killTweensOf(effect);
        effect.destroy(true);
        if (this.effectLayer === effect) this.effectLayer = undefined;
        signal.removeEventListener('abort', finish);
        this.cancelledAnimations.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, reduced ? 350 : 950);
      this.cancelledAnimations.add(finish);
      signal.addEventListener('abort', finish, { once: true });
      // 日本語: 短縮時は点滅させず、一定の枠光だけを出す。
      // English: Reduced motion uses a steady outline instead of a glow pulse.
      if (!reduced) this.tweens.add({ targets: effect, alpha: .35, duration: 300, yoyo: true });
    });
  }

  clearEffect(): void {
    if (!this.effectLayer) return;
    for (const child of this.effectLayer.list) this.tweens.killTweensOf(child);
    this.effectLayer.destroy(true);
    this.effectLayer = undefined;
  }

  /** 日本語: 行選択の予告は表示だけ。箱やHPには触れない。
   * English: Row targeting is a visual preview, never a speculative core mutation. */
  previewRow(row: number | null): void {
    this.targetRow = row;
    this.rowOverlay?.destroy();
    this.rowOverlay = undefined;
    if (!this.layer || row === null || row < 0 || row >= this.boardHeight) return;
    const overlay = this.add.graphics();
    overlay.fillStyle(0xf4c77b, .18);
    overlay.fillRect(this.left, this.top + row * this.cell, this.boardWidth * this.cell, this.cell);
    overlay.lineStyle(2, 0xf4c77b, .9);
    overlay.strokeRect(this.left, this.top + row * this.cell, this.boardWidth * this.cell, this.cell);
    this.layer.add(overlay);
    this.rowOverlay = overlay;
  }

  private makeBox(box: Box, highlight = false): Phaser.GameObjects.Container {
    const center = this.center(box.row, box.col);
    const tile = this.add.container(center.x, center.y);
    const g = this.add.graphics();
    const size = this.cell - 10;
    const theme = ownerTheme[box.owner];
    g.fillStyle(0x000000, .35);
    g.fillRoundedRect(-size / 2 + 2, -size / 2 + 4, size, size, 5);
    g.fillStyle(theme.dark);
    g.fillRoundedRect(-size / 2, -size / 2, size, size, 5);
    g.lineStyle(highlight ? 3 : 1.5, theme.color, highlight ? 1 : .9);
    g.strokeRoundedRect(-size / 2, -size / 2, size, size, 5);
    g.lineStyle(1, theme.color, .25);
    g.lineBetween(-size / 2 + 6, -size / 2 + 7, size / 2 - 6, -size / 2 + 7);
    tile.add(g);
    tile.add(this.add.text(0, 1, theme.glyph, { fontFamily: FONT, fontSize: `${Math.min(18, size * .5)}px`, fontStyle: 'bold', color: `#${theme.color.toString(16)}` }).setOrigin(.5));
    return tile;
  }

  private drawMarker(option: DropOption): void {
    const x = this.left + (option.edge.col + .5) * this.cell;
    const y = this.top + option.edge.row * this.cell;
    const enabled = option.available && this.acceptingInput && this.skillMode === null;
    const g = this.add.graphics();
    this.layer?.add(g);
    g.lineStyle(3, option.available ? 0xf4c77b : 0x59616b, option.available ? 1 : .7);
    g.lineBetween(x - this.cell * .32, y, x + this.cell * .32, y);
    if (option.available) {
      g.fillStyle(0xf4c77b, enabled ? 1 : .35);
      g.fillTriangle(x - 5, y + 3, x + 5, y + 3, x, y + 10);
    } else {
      g.lineStyle(1.6, 0x8a6770, .9);
      g.lineBetween(x - 3, y - 3, x + 3, y + 3);
      g.lineBetween(x - 3, y + 3, x + 3, y - 3);
    }
    if (!enabled) return;
    // 日本語: 選択範囲も天井辺に置く。English: The hit area belongs to the ceiling edge, not a floating launcher.
    const zone = this.add.zone(x, y + 1, this.cell - 3, Math.min(28, this.cell * .6)).setInteractive({ useHandCursor: true });
    this.layer?.add(zone);
    zone.on('pointerdown', () => { if (this.acceptingInput && this.skillMode === null) this.onDrop(option.id); });
    zone.on('pointerover', () => { this.selected = option.id; this.onHover(option); this.showPreview(option); });
    zone.on('pointerout', () => { this.selected = null; this.onHover(null); this.preview?.destroy(); this.preview = undefined; });
  }

  private showPreview(option: DropOption): void {
    if (!option.landing || this.selected !== option.id) return;
    this.preview?.destroy();
    const g = this.add.graphics();
    this.preview = g;
    this.layer?.add(g);
    g.lineStyle(1, 0xf4c77b, .26);
    const start = this.center(option.spawn.row, option.spawn.col);
    const end = this.center(option.landing.row, option.landing.col);
    g.lineBetween(start.x, start.y + 10, end.x, end.y);
    g.lineStyle(2, 0xf4c77b, .6);
    g.strokeRoundedRect(end.x - this.cell / 2 + 6, end.y - this.cell / 2 + 6, this.cell - 12, this.cell - 12, 5);
  }

  center(row: number, col: number): { x: number; y: number } {
    return { x: this.left + (col + .5) * this.cell, y: this.top + (row + .5) * this.cell };
  }

  async animateDrop(resolution: Resolution, before: BattleState, after: BattleState, signal: AbortSignal, reduced: boolean): Promise<void> {
    const event = resolution.events.find(event => event.type === 'drop');
    if (!event || signal.aborted) return;
    this.draw(before, false);
    const falling = this.makeBox({ ...event.box, ...event.spawn });
    const landing = this.center(event.landing.row, event.landing.col);
    await new Promise<void>(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.tweens.killTweensOf(falling);
        falling.destroy(true);
        signal.removeEventListener('abort', finish);
        this.cancelledAnimations.delete(finish);
        resolve();
      };
      this.cancelledAnimations.add(finish);
      signal.addEventListener('abort', finish, { once: true });
      this.tweens.add({ targets: falling, y: landing.y, duration: reduced ? 20 : 130 + event.path.length * 42, ease: 'Quad.easeIn', onComplete: finish });
    });
    if (!signal.aborted) this.draw(after, false);
  }

  cancel(): void {
    for (const finish of [...this.cancelledAnimations]) finish();
    this.clearEffect();
    this.tweens.killAll();
    this.skillMode = null;
    this.selected = null;
    this.previewRow(null);
  }
}

export function createBoardGame(parent: HTMLElement, scene: BoardScene): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#111c26',
    antialias: true,
    transparent: false,
    banner: false,
    audio: { noAudio: true },
    scene,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: false },
  });
  // 日本語: FITは盤面全体を維持。親の高さいっぱいに追従し、切り取らない。
  // English: FIT preserves the entire board; refresh on host changes, never crop it.
  const stopObserving = observeBoardViewport(parent, () => game.scale.refresh());
  game.events.once(Phaser.Core.Events.DESTROY, stopObserving);
  return game;
}

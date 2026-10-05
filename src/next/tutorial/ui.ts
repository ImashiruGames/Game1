// 日本語: チュートリアルの台詞パネル・光る目印・操作ロック。実画面を使い、置けない所は押しても反応しない。
// English: Speech panel, glow hints and input gate for the tutorial, layered over the real battle screen.
import './tutorial.css';
import type { TutorialController, TutorialPanel } from './controller.ts';
import { columnOf } from './scenes.ts';

export interface TutorialUiHooks {
  /** 話し手ごとの画像 */
  readonly portrait: (who: 'ao' | 'star') => { src: string; alt: string };
  readonly skip: () => void;
  readonly finish: () => void;
  readonly reward: () => HTMLDialogElement;
  readonly area: () => HTMLElement;
  readonly drops: () => HTMLElement;
}
const NAMES = { ao: '青の子', star: 'チュートリアル星人' } as const;
const GUIDE: Record<string, string> = {
  drop: '光っている▼をタップ。もう一度タップで決定',
  board: '光っている盤面スキルをタップ → 光っている1段目をタップ → もう一度タップで決定',
  transform: '光っている「変化する」をタップ',
  category: '光っている「ステータス」をタップ',
  reward: '好きなカードをタップ。もう一度タップで決定',
};

export function createTutorialUi(root: HTMLElement, hooks: TutorialUiHooks) {
  let tutorial: TutorialController | null = null;
  let panel: TutorialPanel | null = null;
  const element = document.createElement('section');
  element.className = 'tutorial-panel';
  element.setAttribute('aria-live', 'polite');
  element.hidden = true;
  let askedSkip = false;
  // 日本語: 無効なボタン（戦闘終了後のマスなど）はクリックを受け取らないため、台詞の場面では全画面の受け皿を重ねる。
  const catcher = document.createElement('div');
  catcher.className = 'tutorial-catch';
  catcher.hidden = true;
  catcher.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); tutorial?.tap(); });

  const html = (p: TutorialPanel): string => {
    const portrait = hooks.portrait(p.who);
    const guide = GUIDE[p.expect.kind];
    const back = p.canBack ? '<button type="button" class="tutorial-back" data-tutorial="back">◀ 戻る</button>' : '';
    const action = p.expect.kind === 'tap'
      ? `${back}<span class="tutorial-tap">画面をタップで${p.last ? 'おわり' : 'つぎへ'} ▶</span>`
      : `${back}<span class="tutorial-guide">${guide ?? ''}</span>`;
    return `<img class="tutorial-avatar" src="${portrait.src}" alt="${portrait.alt}"><div class="tutorial-body"><div class="tutorial-head"><span class="tutorial-who">${NAMES[p.who]}</span><span class="tutorial-count">${p.index + 1} / ${p.total}</span><button type="button" class="tutorial-skip" data-tutorial="skip">スキップ</button></div><p class="tutorial-text">${p.text}</p><div class="tutorial-foot">${action}</div></div>`;
  };

  /** 日本語: 盤面は一番上の空き段の上、報酬画面ではダイアログの先頭に置く。 */
  const place = (): void => {
    if (!panel) { element.hidden = true; catcher.hidden = true; return; }
    const reward = hooks.reward();
    const host: HTMLElement = reward.open ? reward : hooks.area();
    element.classList.toggle('in-dialog', reward.open);
    if (element.parentElement !== host || (reward.open && host.firstElementChild !== element)) {
      if (reward.open) host.prepend(element); else host.append(element);
    }
    if (!reward.open) {
      // 日本語: 放出口（▼）の一番下より下に置く。PCでは▼が盤面の縁に重なるため実際の位置を測る。
      const area = hooks.area().getBoundingClientRect();
      const emitters = Array.from(hooks.drops().querySelectorAll<HTMLElement>('.edge-emitter'));
      const board = hooks.drops().nextElementSibling?.getBoundingClientRect();
      const bottom = emitters.length ? Math.max(...emitters.map(node => node.getBoundingClientRect().bottom)) : (board?.top ?? area.top);
      element.style.setProperty('--tut-top', `${Math.max(0, bottom - area.top + 6)}px`);
    }
    element.classList.toggle('is-busy', !!tutorial?.isResolving && panel.expect.kind !== 'tap');
    element.hidden = false;
    if (!catcher.isConnected) document.body.append(catcher);
    catcher.hidden = !(panel.expect.kind === 'tap' && !reward.open);
  };
  const show = (next: TutorialPanel | null): void => {
    panel = next;
    if (next) element.innerHTML = html(next);
    place();
    glow();
  };

  /** 日本語: 押してよいものだけを光らせ、ほかは薄くする。 */
  const glow = (): void => {
    root.querySelectorAll('.tutorial-glow,.tutorial-dim').forEach(node => node.classList.remove('tutorial-glow', 'tutorial-dim'));
    if (!panel) return;
    const e = panel.expect;
    const mark = (selector: string, dimSelector?: string): void => {
      root.querySelectorAll<HTMLElement>(selector).forEach(node => node.classList.add('tutorial-glow'));
      if (dimSelector) root.querySelectorAll<HTMLElement>(dimSelector).forEach(node => { if (!node.classList.contains('tutorial-glow')) node.classList.add('tutorial-dim'); });
    };
    if (e.kind === 'drop') mark(`[data-drop="ceiling:${columnOf(e.col)}:0"]`, '.edge-emitter');
    else if (e.kind === 'board') mark('[data-board],[data-confirm]');
    else if (e.kind === 'transform') mark('[data-transform]');
    else if (e.kind === 'category') mark('#reward [data-category="stats"]', '#reward [data-category]');
    else if (e.kind === 'reward') mark('#reward [data-reward-preview]');
    const h = panel.highlight;
    if (h === 'board') mark('[data-board]');
    else if (h === 'shape') mark('#skill-hud [data-skill-info="0"]');
    else if (h) mark(`#reward [data-category="${h}"]`, '#reward [data-category]');
    if (e.kind === 'board') root.querySelectorAll<HTMLElement>('[data-cell-row="7"]').forEach(node => node.classList.add('tutorial-glow'));
  };

  /** 日本語: 台本が許す操作だけ通す。パネル内・説明役のボタンは常に通す。 */
  const allowed = (b: HTMLElement): boolean => {
    if (!panel) return false;
    const e = panel.expect;
    if (b.closest('.tutorial-panel')) return true;
    if (e.kind === 'drop') return b.dataset.drop === `ceiling:${columnOf(e.col)}:0` || (b.dataset.cellCol !== undefined && Number(b.dataset.cellCol) === columnOf(e.col));
    if (e.kind === 'board') return b.dataset.board !== undefined || b.dataset.confirm !== undefined || b.dataset.cancel !== undefined || b.dataset.rowProjection !== undefined || (b.dataset.cellRow !== undefined && Number(b.dataset.cellRow) === e.row);
    if (e.kind === 'transform') return b.dataset.transform !== undefined;
    if (e.kind === 'category') return b.dataset.category === e.category;
    if (e.kind === 'reward') return !!b.closest('#reward') && b.dataset.category === undefined;
    return false;
  };
  const gate = (event: MouseEvent): void => {
    if (!tutorial) return;
    const b = (event.target as Element | null)?.closest<HTMLElement>('button,[role=button],a');
    // 日本語: 台詞だけの場面は画面のどこをタップしても進む（スキップ・戻るは除く）。
    if (panel?.expect.kind === 'tap' && b?.dataset.tutorial !== 'skip' && b?.dataset.tutorial !== 'back') { event.preventDefault(); event.stopImmediatePropagation(); tutorial.tap(); return; }
    if (!b) return;
    if (b.dataset.tutorial === 'back') { event.preventDefault(); event.stopImmediatePropagation(); tutorial.back(); return; }
    if (b.dataset.tutorial === 'skip') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (tutorial.isFirstRun && !askedSkip && !window.confirm('スキップしてもあとからホームの「？」で見られます。スキップしますか？')) return;
      askedSkip = true; hooks.skip(); return;
    }
    if (!root.contains(b) && !b.closest('#reward')) return;
    if (!allowed(b)) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  // 日本語: ゲーム側のハンドラより先（捕捉段階）で止める。English: Capture phase, before the game's own handlers.
  document.addEventListener('click', gate, true);
  window.addEventListener('keydown', event => {
    if (!tutorial) return;
    if (event.key === 'Escape') event.stopImmediatePropagation();
    if (event.key === 'ArrowRight') tutorial.tap();
    if (event.key === 'ArrowLeft') tutorial.back();
  }, true);
  window.addEventListener('resize', place);

  return {
    attach(controller: TutorialController): void {
      tutorial = controller; askedSkip = false;
      controller.onPanel = show;
      controller.onFinish = () => { show(null); hooks.finish(); };
    },
    detach(): void { tutorial = null; panel = null; element.hidden = true; element.remove(); catcher.remove(); glow(); },
    /** 描画のたびに呼ぶ（盤面・報酬画面が作り直されるため）。 */
    afterRender(): void { if (tutorial) { place(); glow(); } },
    get active(): boolean { return tutorial !== null; },
  };
}

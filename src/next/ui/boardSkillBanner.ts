// 日本語: 盤面スキルの「発動！」演出。既存の小さな名前札とは別の飾りで、操作や待ち時間は増やさない。
// English: A large "Board skill!" banner decoration. It adds no input handling and no extra wait.
import './boardSkillBanner.css';
import type { AnimationMotion } from './animationTimeline.ts';

export function createBoardSkillBanner(root: HTMLElement) {
  const area = root.querySelector<HTMLElement>('.board-area');
  let current: { finish: () => void } | undefined;
  const clear = (): void => current?.finish();
  return {
    play(skillId: string, name: string, options: { motion: AnimationMotion; signal?: AbortSignal }): number {
      if (!area || options.signal?.aborted) return 0;
      clear();
      const reduced = options.motion.timeline?.short || options.motion.lowMotion || document.body?.dataset.reducedMotion === 'true' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const duration = reduced ? 600 : Math.max(700, options.motion.timeline?.skill.name ?? 760) + 120;
      const layer = document.createElement('div');
      layer.className = `board-skill-banner ${skillId === 'ember' ? 'is-warm' : ''}${reduced ? ' is-static' : ''}`;
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = `<i class="bsb-flash"></i><div class="bsb-band"><span class="bsb-title">盤面スキル発動！</span><span class="bsb-name"></span></div>`;
      layer.querySelector('.bsb-name')!.textContent = name;
      area.append(layer);
      const animations: Animation[] = [];
      let finished = false;
      const finish = (): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', finish);
        for (const animation of animations) try { animation.cancel(); } catch { /* 飾りのみ */ }
        layer.remove();
        if (current?.finish === finish) current = undefined;
      };
      const animate = (node: Element | null, frames: Keyframe[]): void => {
        if (reduced || !node || typeof (node as HTMLElement).animate !== 'function') return;
        try { const a = (node as HTMLElement).animate(frames, { duration, easing: 'ease-out', fill: 'both' }); animations.push(a); a.finished.catch(() => {}); } catch { /* 静止表示のまま */ }
      };
      animate(layer.querySelector('.bsb-flash'), [{ opacity: 0.9, transform: 'scale(.4)' }, { opacity: 0.45, transform: 'scale(1.1)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.5)' }]);
      animate(layer.querySelector('.bsb-band'), [
        { opacity: 0, transform: 'translateX(-60%) skewX(-12deg) scaleY(.6)' },
        { opacity: 1, transform: 'translateX(0) skewX(-12deg) scaleY(1.08)', offset: 0.22 },
        { opacity: 1, transform: 'translateX(0) skewX(-12deg) scaleY(1)', offset: 0.7 },
        { opacity: 0, transform: 'translateX(40%) skewX(-12deg) scaleY(.9)' },
      ]);
      const timer = setTimeout(finish, duration);
      options.signal?.addEventListener('abort', finish, { once: true });
      current = { finish };
      return duration;
    },
    clear,
  };
}

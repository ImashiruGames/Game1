/** 日本語: CSSグリッド・ウィンドウの寸法変更だけを監視。ゲーム状態は変更しない。
 * English: Resize presentation when its grid host changes; never modify battle state. */
export function observeBoardViewport(host: Element, refresh: () => void, Observer: typeof ResizeObserver = ResizeObserver): () => void {
  let width = -1;
  let height = -1;
  const observer = new Observer(entries => {
    const entry = entries.find(item => item.target === host);
    if (!entry) return;
    const next = entry.contentRect;
    if (next.width <= 0 || next.height <= 0 || (next.width === width && next.height === height)) return;
    width = next.width;
    height = next.height;
    refresh();
  });
  observer.observe(host);
  return () => observer.disconnect();
}

// 日本語: 変化の演出で使う大きな絵を、戦闘が静かなうちに読み込んでデコードしておく（演出で初めて読むと重いため）。
// English: Fetch and decode the big transformation art while the battle is idle, so the cinematic never waits on it.
const kept = new Map<string, HTMLImageElement>();
const idle = (task: () => void): void => {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(task, { timeout: 2500 }); else setTimeout(task, 400);
};
export function warmArt(urls: readonly string[]): void {
  for (const url of urls) {
    if (!url || kept.has(url)) continue;
    // 日本語: 参照を保持してメモリ上のキャッシュにする。English: Holding the element keeps the decoded bitmap cached.
    const img = new Image();
    img.decoding = 'async';
    kept.set(url, img);
    idle(() => { img.src = url; void img.decode?.().catch(() => { /* 読み込み失敗は演出時にあらためて試す */ }); });
  }
}

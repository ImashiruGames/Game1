// 日本語: GitHub Pages は https://<user>.github.io/<repo>/ の下で配信される。
// コード内の絶対パス "/assets/..." はサイト直下を指してしまうため、ビルド後に "/<repo>/assets/..." へ書き換える。
// あわせて、トップページ（/<repo>/）を最新版 /next/ への入口にし、旧1.0は v1.0.html に残す。
// English: Pages serves under /<repo>/. Absolute "/assets/..." literals would point at the site root, so prefix them
// after the build. The top page becomes an entrance to /next/; the old 1.0 page is kept as v1.0.html.
import fs from 'node:fs'; import path from 'node:path';
const dist = path.resolve('dist'), base = process.env.PAGES_BASE || '/';
if (!base.startsWith('/') || !base.endsWith('/')) throw new Error(`PAGES_BASE must look like /Repo/ (got ${base})`);
export function rewrite(text, b = base) {
  return text
    .replace(/(["'`])\/assets\//g, `$1${b}assets/`)
    .replace(/href=(\\?["'])\/lab\/\1/g, `href=$1${b}lab/$1`)
    .replace(/href=(\\?["'])\/\1/g, `href=$1${b}v1.0.html$1`);
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  let changed = 0;
  for (const f of fs.readdirSync(dist, { recursive: true })) {
    const p = path.join(dist, f); if (!/\.(js|html)$/.test(p) || !fs.statSync(p).isFile()) continue;
    const before = fs.readFileSync(p, 'utf8'), after = rewrite(before); if (after !== before) { fs.writeFileSync(p, after); changed++; }
  }
  const root = path.join(dist, 'index.html');
  if (fs.existsSync(root)) fs.renameSync(root, path.join(dist, 'v1.0.html'));
  fs.writeFileSync(root, `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=./next/"><title>箱積みの戦場</title></head><body><p><a href="./next/">箱積みの戦場をはじめる</a></p></body></html>\n`);
  fs.writeFileSync(path.join(dist, '.nojekyll'), '');
  console.log(`pages-postbuild: base ${base}, rewrote ${changed} files`);
}

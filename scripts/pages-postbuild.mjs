// Keep / as the next entrance; never recreate the retired v1.0 game.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const publicRoots='assets|docs|lab|next|energy-qa|audio-asset-preview|night-qa|build-card-preview|build-ui-preview|save-preview|transform-preview|box-design-preview|skill-experiments';
const rootUrl=new RegExp('(["\'\x60])\\/('+publicRoots+')\\/','g');

export function rewrite(text, base='/') {
  return text
    .replace(rootUrl, (_match, quote, route) => quote+base+route+'/')
    .replace(/href=(\\?["'])\/\1/g, (_match, quote) => 'href='+quote+base+'next/'+quote);
}

export function postbuild(directory, base='/') {
  if (!base.startsWith('/') || !base.endsWith('/')) throw new Error('PAGES_BASE must start and end with /');
  const dist=path.resolve(directory);
  if (fs.existsSync(path.join(dist,'v1.0.html'))) throw new Error('Use a fresh Vite build: retired v1.0.html must not be published');
  let changed=0;
  for (const file of fs.readdirSync(dist,{recursive:true})) {
    const target=path.join(dist,file);
    if (!/\.(js|html)$/.test(target)||!fs.statSync(target).isFile()) continue;
    const before=fs.readFileSync(target,'utf8'),after=rewrite(before,base);
    if(after!==before){fs.writeFileSync(target,after);changed++;}
  }
  // Vite already built the static index.html redirect; keep it as the only root entry.
  fs.writeFileSync(path.join(dist,'.nojekyll'),'');
  return changed;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const base=process.env.PAGES_BASE||'/';
  console.log('pages-postbuild: base '+base+', rewrote '+postbuild('dist',base)+' files');
}

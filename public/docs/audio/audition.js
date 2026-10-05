(async function(){
"use strict";
/** A single shared HTMLAudioElement; no Web Audio synthesis and no autoplay. */
class AuditionPlayer {
  constructor({ audioFactory = () => new Audio(), onState = () => {}, now = () => performance.now(), setTimer = (callback, delay) => globalThis.setTimeout(callback, delay), clearTimer = handle => globalThis.clearTimeout(handle), minimumStartGap = 2000, betweenGap = 450, loadTimeout = 18000, audioContextFactory = null } = {}) {
    this.audio = audioFactory();
    this.audio.preload = 'none';
    this.audio.loop = false;
    this.audio.volume = 0.65;
    this.onState = onState; this.now = now;
    this.audioContextFactory = audioContextFactory; this.audioContext = null; this.gain = null;
    this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.minimumStartGap = minimumStartGap; this.betweenGap = betweenGap; this.loadTimeout = loadTimeout;
    this.generation = 0; this.pending = null; this.timer = null; this.loadTimer = null;
    this.state = { phase: 'idle', track: null, index: 0, total: 0, volume: 0.65, muted: false, message: '再生する音を選んでください' };
  }
  emit(next = {}) { this.state = { ...this.state, ...next }; this.onState({ ...this.state }); }
  cancelPending() {
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null; }
    if (this.loadTimer !== null) { this.clearTimer(this.loadTimer); this.loadTimer = null; }
    if (this.pending) { const finish = this.pending; this.pending = null; finish(false); }
  }
  stop(message = '停止しました') {
    ++this.generation;
    this.cancelPending();
    this.audio.pause();
    try { this.audio.currentTime = 0; } catch {}
    this.emit({ phase: 'idle', track: null, index: 0, total: 0, message });
  }
  setVolume(value) {
    const volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.gain) { this.audio.volume = 1; this.gain.gain.value = volume; } else this.audio.volume = volume;
    this.emit({ volume });
  }
  setMuted(muted) { this.audio.muted = Boolean(muted); this.emit({ muted: this.audio.muted }); }
  async play(tracks) {
    this.stop();
    // Created/resumed only in the click handler, keeping iOS audio user-initiated.
    if (this.audioContextFactory && !this.audioContext) {
      try {
        this.audioContext = this.audioContextFactory();
        const source = this.audioContext.createMediaElementSource(this.audio);
        this.gain = this.audioContext.createGain();
        source.connect(this.gain); this.gain.connect(this.audioContext.destination);
        this.gain.gain.value = this.state.volume; this.audio.volume = 1;
      } catch { this.audioContext = null; this.gain = null; }
    }
    if (this.audioContext?.state === 'suspended') this.audioContext.resume().catch(() => {});
    const list = tracks.filter(track => track && typeof track.src === 'string' && track.src);
    if (!list.length) { this.emit({ phase: 'error', message: '再生できる音がありません。配布ファイルの状態を確認してください' }); return; }
    const token = this.generation;
    for (let index = 0; index < list.length; index++) {
      if (token !== this.generation) return;
      const track = list[index];
      const began = this.now();
      this.emit({ phase: 'loading', track, index: index + 1, total: list.length, message: `${track.themeLabel} / ${track.kindLabel} を読み込み中` });
      const succeeded = await this.playOne(track, token);
      if (!succeeded || token !== this.generation) return;
      if (index < list.length - 1) {
        const wait = Math.max(this.betweenGap, this.minimumStartGap - (this.now() - began));
        this.emit({ phase: 'waiting', message: `次の音へ · ${index + 1} / ${list.length}` });
        const keepGoing = await this.delay(wait);
        if (!keepGoing || token !== this.generation) return;
      }
    }
    if (token === this.generation) this.emit({ phase: 'idle', track: null, index: 0, total: 0, message: `${list.length}音の再生が終わりました` });
  }
  playOne(track, token) {
    return new Promise(resolve => {
      let settled = false;
      const cleanup = () => {
        for (const [name, callback] of Object.entries(events)) this.audio.removeEventListener(name, callback);
        if (this.loadTimer !== null) { this.clearTimer(this.loadTimer); this.loadTimer = null; }
      };
      const finish = (value) => {
        if (settled) return;
        settled = true; cleanup();
        if (this.pending === finish) this.pending = null;
        resolve(value);
      };
      const fail = error => {
        if (token !== this.generation || settled) return;
        this.audio.pause();
        const blocked = error?.name === 'NotAllowedError';
        this.emit({ phase: 'error', message: blocked ? '再生がブロックされました。音のボタンをもう一度押してください' : `音を読み込めませんでした: ${track.themeLabel} / ${track.kindLabel}。もう一度押すか、MP3をダウンロードしてください` });
        finish(false);
      };
      const events = {
        playing: () => {
          if (token !== this.generation || settled) return;
          if (this.loadTimer !== null) { this.clearTimer(this.loadTimer); this.loadTimer = null; }
          this.emit({ phase: 'playing', message: `${track.themeLabel} / ${track.kindLabel} を再生中` });
        },
        ended: () => finish(token === this.generation),
        error: () => fail(new Error('Audio load error')),
      };
      this.pending = finish;
      for (const [name, callback] of Object.entries(events)) this.audio.addEventListener(name, callback);
      this.audio.src = track.src;
      this.audio.load();
      this.loadTimer = this.setTimer(() => fail(new Error('Audio load timeout')), this.loadTimeout);
      try { Promise.resolve(this.audio.play()).catch(fail); } catch (error) { fail(error); }
    });
  }
  delay(ms) {
    return new Promise(resolve => {
      const finish = value => { if (this.pending === finish) this.pending = null; resolve(value); };
      this.pending = finish;
      this.timer = this.setTimer(() => { this.timer = null; finish(true); }, ms);
    });
  }
}

function bindVisibilityStop(player, target = document) {
  const stopWhenHidden = () => { if (target.hidden) player.stop('画面が切り替わったため停止しました'); };
  target.addEventListener('visibilitychange', stopWhenHidden);
  return () => target.removeEventListener('visibilitychange', stopWhenHidden);
}

const THEMES = [
  ['cute','かわいい','♡','#f2a3cc'],['cool','かっこいい','◆','#9caeff'],['intellectual','知的','◎','#a4cffc'],['fire','炎','♨','#ffa786'],['ice','氷','❄','#a0e7ff'],['thunder','雷','ϟ','#f2dc81'],['dark','闇','◐','#c3a1ef'],['light','光','✧','#eee6ae'],['machine','機械','⌘','#b0c6d4'],['space','宇宙','✦','#b5adff'],
].map(([id,label,icon,color])=>({id,label,icon,color}));
const KINDS = [['link_small','リンク小'],['link_medium','リンク中'],['link_large','リンク大'],['shape_damage','形'],['direct_damage','直接']].map(([id,label])=>({id,label}));
function safeRelative(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.includes('://') && !/^[a-z][a-z0-9+.-]*:/i.test(path) && !path.split('/').includes('..') && !/[\x00-\x1f]/.test(path) ? path : null;
}
function normalizeCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.sounds)) throw new Error('音源一覧の形式を読み取れません');
  const sounds = []; const warnings = [];
  for (const theme of THEMES) for (const kind of KINDS) {
    const matches = catalog.sounds.filter(s => s.theme === theme.id && s.kind === kind.id);
    if (matches.length > 1) warnings.push(`${theme.label} / ${kind.label}: 重複したメタデータ`);
    const raw = matches[0];
    const formats = Object.fromEntries(['mp3','wav','flac'].map(format=>[format, {path:safeRelative(raw?.[format]),status:'checking'}]));
    for (const file of Object.values(formats)) if (!file.path) file.status = 'missing';
    const duration = Number(raw?.duration_seconds);
    sounds.push({id:raw?.id || `${theme.id}_${kind.id}`,theme:theme.id,themeLabel:theme.label,kind:kind.id,kindLabel:kind.label,duration:Number.isFinite(duration) && duration > 0 ? duration : null,formats,missingMetadata:!raw,description:typeof raw?.description==='string'?raw.description:''});
  }
  const downloads = Array.isArray(catalog.downloads) ? catalog.downloads.map(item=>typeof item==='string'?{label:'サウンドパック ZIP',path:item}:item).filter(item=>safeRelative(item.path)).map(item=>({...item,path:safeRelative(item.path),status:'checking'})) : [];
  return { sounds, downloads, warnings };
}
function playableSource(sound) { return ['mp3','wav','flac'].map(format=>sound.formats[format]).find(file=>file?.status==='ready')?.path || null; }
function makeQueue(sounds, {theme, kind} = {}) {
  return sounds.filter(sound=>(!theme || sound.theme===theme) && (!kind || sound.kind===kind)).map(sound=>({...sound,src:playableSource(sound)})).filter(sound=>sound.src);
}

const $ = id => document.getElementById(id);
let selectedTheme = THEMES[0].id;
let model = {sounds:[],downloads:[],warnings:[]};
let verificationDone = false;
const soundButtons = new Map();
function element(tag, className, text) { const node=document.createElement(tag); if(className)node.className=className; if(text!==undefined)node.textContent=text; return node; }
function downloadLink(path,label,className='') {const node=element('a',className,label);node.href=path;node.download='';return node;}
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const player = new AuditionPlayer({audioContextFactory: AudioContextClass && location.protocol!=='file:' ? () => new AudioContextClass() : null, onState:state=>{
  $('playback-status').textContent=state.message;
  $('playback-label').textContent=({idle:'STANDBY',loading:'LOADING',playing:'NOW PLAYING',waiting:'UP NEXT',error:'PLAYBACK ERROR'})[state.phase];
  $('status-icon').textContent=state.phase==='playing'?'▶':state.phase==='loading'?'…':'■';
  $('playback-status').closest('.now-playing').classList.toggle('is-active',['playing','loading','waiting'].includes(state.phase));
  $('playback-status').closest('.now-playing').classList.toggle('has-error',state.phase==='error');
  $('mute').setAttribute('aria-pressed',String(state.muted));
  $('mute').setAttribute('aria-label',state.muted?'ミュートを解除する':'ミュートにする');
  $('mute').classList.toggle('is-silent',state.volume===0);
  $('mute').textContent=state.muted?'ミュート':state.volume===0?'音量ゼロ':'音あり';
  $('volume-value').value=`${Math.round(state.volume*100)}%`;
  for(const [id,button] of soundButtons){const current=state.track?.id===id&&state.phase!=='idle'&&state.phase!=='error';button.closest('.sound-card').classList.toggle('is-current',current);button.setAttribute('aria-pressed',String(current));}
}});
bindVisibilityStop(player);
window.addEventListener('pagehide',()=>player.stop());
$('stop').addEventListener('click',()=>player.stop());
$('mute').addEventListener('click',()=>player.setMuted(!player.state.muted));
$('volume').addEventListener('input',event=>player.setVolume(Number(event.target.value)/100));
document.addEventListener('keydown',event=>{if(event.key==='Escape')player.stop();});
$('play-theme').addEventListener('click',()=>player.play(makeQueue(model.sounds,{theme:selectedTheme})));
$('play-all').addEventListener('click',()=>player.play(makeQueue(model.sounds)));
$('play-compare').addEventListener('click',()=>player.play(makeQueue(model.sounds,{kind:$('compare-kind').value})));
$('compare-kind').addEventListener('change',renderCounts);
for(const kind of KINDS){const option=element('option','',kind.label);option.value=kind.id;$('compare-kind').append(option);}
for(const theme of THEMES){
 const button=element('button','theme-button');button.type='button';button.dataset.theme=theme.id;button.style.setProperty('--theme',theme.color);button.setAttribute('aria-pressed',String(theme.id===selectedTheme));
 const icon=element('span','theme-icon',theme.icon);icon.setAttribute('aria-hidden','true');button.append(icon,element('span','',theme.label));
 button.addEventListener('click',()=>{selectedTheme=theme.id;for(const other of $('theme-list').children)other.setAttribute('aria-pressed',String(other.dataset.theme===selectedTheme));renderSounds();renderCounts();});$('theme-list').append(button);
}
function renderSounds(){
 const theme=THEMES.find(item=>item.id===selectedTheme);document.documentElement.style.setProperty('--theme',theme.color);
 $('selected-theme-label').textContent=`${theme.label}の5音`;
 $('sound-list').replaceChildren();soundButtons.clear();
 const themeSounds=model.sounds.filter(sound=>sound.theme===selectedTheme);
 for(let index=0;index<themeSounds.length;index++){
  const sound=themeSounds[index];const source=playableSource(sound);const checking=Object.values(sound.formats).some(file=>file.status==='checking');
  const article=element('article','sound-card');article.classList.toggle('is-missing',!source&&!checking);
  const button=element('button','sound-play');button.type='button';button.disabled=!source;button.setAttribute('aria-label',`${sound.themeLabel} / ${sound.kindLabel} を再生${sound.duration?`、${sound.duration.toFixed(2)}秒`:''}`);button.setAttribute('aria-pressed','false');
  const icon=element('span','play-symbol','▶');icon.setAttribute('aria-hidden','true');
  button.append(element('span','sound-index',String(index+1).padStart(2,'0')),icon,element('span','sound-name',sound.kindLabel),element('span','duration',source?(sound.duration?`${sound.duration.toFixed(2)} 秒`:'長さデータなし'):checking?'ファイル確認中':'ファイル未配布'));
  button.addEventListener('click',()=>player.play([{...sound,src:playableSource(sound)}]));soundButtons.set(sound.id,button);article.append(button);
  const links=element('div','sound-downloads');links.setAttribute('aria-label',`${sound.themeLabel} / ${sound.kindLabel} のダウンロード`);
  for(const format of ['mp3','wav','flac']){
   const file=sound.formats[format];
   if(file.status==='ready'){const link=downloadLink(file.path,format.toUpperCase());link.setAttribute('aria-label',`${sound.themeLabel} ${sound.kindLabel} ${format.toUpperCase()}をダウンロード`);links.append(link);}
   else{const unavailable=element('span','missing-format',format.toUpperCase());unavailable.title=file.status==='checking'?'ファイル確認中':'未配布';links.append(unavailable);}
  }article.append(links);$('sound-list').append(article);
 }
 // Preserve the active audio indication even when selecting another theme.
 player.emit();
}
function renderCounts(){
 const count=makeQueue(model.sounds).length;const themeCount=makeQueue(model.sounds,{theme:selectedTheme}).length;const comparisonCount=makeQueue(model.sounds,{kind:$('compare-kind').value}).length;
 $('availability-summary').textContent=verificationDone?`配布ファイル ${count} / 50音`:`確認中 ${count} / 50音`;
 $('play-theme').disabled=!themeCount;$('play-theme').textContent=`この${themeCount||5}音を順に聴く`;
 $('play-all').disabled=!count;$('play-all').textContent=count===50?'全50音を順に聴く':`${count}音を順に聴く`;
 $('play-compare').disabled=!comparisonCount;$('play-compare').textContent=`${comparisonCount||10}テーマを聴く`;
}
function renderDownloads(){
 $('pack-downloads').replaceChildren();for(const item of model.downloads)if(item.status==='ready')$('pack-downloads').append(downloadLink(item.path,item.label||'サウンドパック ZIP'));
 if(!model.downloads.some(item=>item.status==='ready'))$('pack-downloads').append(element('p','small-note','編集用ファイルは、別配布のSource Packをお使いください'));
}
function renderIssues(){
 const messages=[...model.warnings];for(const sound of model.sounds){
  const missing=Object.entries(sound.formats).filter(([,file])=>file.status==='missing').map(([format])=>format.toUpperCase());
  if(missing.length)messages.push(`${sound.themeLabel} / ${sound.kindLabel}: ${missing.join('・')} ${sound.missingMetadata?'メタデータ未受領':'ファイル未配布・読み込み失敗'}`);
 }
 for(const download of model.downloads)if(download.status==='missing')messages.push(`${download.label||'ZIP'}: ファイル未配布・読み込み失敗`);
 $('file-issues').hidden=!messages.length;$('file-issues-list').replaceChildren(...messages.map(message=>element('li','',message)));
}
async function checkFile(file){
 if(!file.path)return;
 if(location.protocol==='file:'){
  // A local folder cannot be fetched. Reading metadata never starts playback.
  if(/\.zip$/i.test(file.path)){file.status='missing';return;}
  file.status=await checkLocalAudio(file.path)?'ready':'missing';return;
 }
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(file.path,{method:'HEAD',cache:'no-cache',signal:controller.signal});
  const type=response.headers.get('content-type')||'';
  const length=response.headers.get('content-length');
  file.status=response.ok&&!/text\/html|application\/json/i.test(type)&&length!=='0'?'ready':'missing';
 }catch{file.status='missing';}finally{clearTimeout(timeout);}
}
async function checkLocalAudio(path){
 return new Promise(resolve=>{
  const probe=new Audio();let finished=false;const timer=setTimeout(()=>finish(false),12000);
  const finish=ready=>{if(finished)return;finished=true;clearTimeout(timer);probe.removeEventListener('loadedmetadata',loaded);probe.removeEventListener('error',failed);probe.pause();probe.removeAttribute('src');probe.load();resolve(ready);};
  const loaded=()=>finish(Number.isFinite(probe.duration)&&probe.duration>0);const failed=()=>finish(false);
  probe.addEventListener('loadedmetadata',loaded);probe.addEventListener('error',failed);probe.preload='metadata';probe.src=path;probe.load();
 });
}
async function verifyFiles(){
 const files=[...model.sounds.flatMap(sound=>Object.values(sound.formats)),...model.downloads];let next=0;
 await Promise.all(Array.from({length:6},async()=>{while(next<files.length){const index=next++;await checkFile(files[index]);renderCounts();}}));
 verificationDone=true;renderCounts();renderSounds();renderDownloads();renderIssues();
}
try{
 let catalog=window.AUDITION_CATALOG;
 if(!catalog){
  if(location.protocol==='file:')throw new Error('catalog-data.js が同じフォルダに必要です');
  const response=await fetch('catalog.json',{cache:'no-cache'});if(!response.ok)throw new Error('音源一覧が見つかりません');catalog=await response.json();
 }
 model=normalizeCatalog(catalog);renderSounds();renderCounts();await verifyFiles();
}catch(error){
 model=normalizeCatalog({sounds:[]});verificationDone=true;renderSounds();renderCounts();renderDownloads();renderIssues();
 $('catalog-error').hidden=false;$('catalog-error').textContent=`音源一覧を読み込めませんでした。${error.message}。ページを再読み込みしてください。`;
}

})();

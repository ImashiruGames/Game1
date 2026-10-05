// Isolated rendering study. No game modules, persistent storage, audio or network requests.
const $ = selector => document.querySelector(selector);
const board = $('#board');
const effects = $('#effects');
const status = $('#status');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionQuery.matches;
let runId = 0;
const timers = new Set();
const animations = new Set();
const initial = [
  [4, 1, 'enemy'], [4, 4, 'own'],
  [5, 0, 'enemy'], [5, 1, 'own'], [5, 3, 'enemy'], [5, 4, 'own'],
  [6, 0, 'own'], [6, 1, 'own'], [6, 2, 'own'], [6, 3, 'enemy'], [6, 4, 'enemy'], [6, 5, 'own'],
  [7, 0, 'enemy'], [7, 1, 'own'], [7, 2, 'enemy'], [7, 3, 'enemy'], [7, 4, 'own'], [7, 5, 'enemy'],
];
const cells = new Map();

function box(owner, phase = 0) {
  const own = owner === 'own';
  const outline = own ? '<rect class="glass-body" x="2.5" y="2.5" width="35" height="35" rx="6"/>' : '<path class="glass-body" d="M8 2.5H32L37.5 8V32L32 37.5H8L2.5 32V8Z"/>';
  const bevel = own ? '<rect class="glass-bevel" x="5" y="5" width="30" height="30" rx="4"/>' : '<path class="glass-bevel" d="M9 5H31L35 9V31L31 35H9L5 31V9Z"/>';
  const energy = own ? `<g class="blue-energy"><path class="prism-field" d="M20 7L28 13L30 25L20 31L10 25L12 13Z"/><path class="prism-seam" d="M20 7V31M12 13L20 16L28 13M10 25L20 21L30 25"/><path class="core-rim" d="M26.8 20a6.8 6.8 0 1 1-13.6 0 6.8 6.8 0 0 1 13.6 0"/><circle class="core-fill" cx="20" cy="20" r="4.8"/><path class="core-shade" d="M15.4 21.3a4.8 4.8 0 0 0 9-1.2q-5.3 2.3-9 1.2"/><path class="core-glint" d="M17 16.8q3-2 5.3.2l-1.6 1.7q-1.5-1-3 .2Z"/><circle class="dust" cx="28" cy="10" r=".6"/><circle class="dust" cx="11" cy="29" r=".45"/></g><g class="red-energy"><g class="flame-tongue"><path class="flame-outer" d="M20 6c3 5-1 6 3 9 2-2 2-4 2-4 7 9 6 18-4 21C9 33 8 22 12 17c0 3 2 4 3 4-2-8 5-8 5-15Z"/><path class="flame-edge" d="M15 26c-2-6 5-7 4-15 6 9-1 10 6 15"/></g><circle class="core-rim" cx="20" cy="22" r="6.8"/><circle class="core-fill" cx="20" cy="22" r="4.8"/><path class="flame-inner" d="M20 17c3 2 4 4 2 7-1 2-5 2-5-1 0-2 3-3 3-6Z"/><circle class="dust" cx="28" cy="16" r=".6"/><circle class="dust" cx="13" cy="10" r=".45"/></g>` : `<path class="prism-field" d="M20 6L30 20L20 33L10 20Z"/><path class="prism-seam" d="M20 6V33M10 20H30M20 11L27 20L20 28L13 20Z"/><path class="core-rim" d="M20 11.5L28 20L20 28.5L12 20Z"/><path class="core-fill" d="M20 14L25.5 20L20 26L14.5 20Z"/><path class="core-glint" d="M20 14L20 20L14.5 20Z"/><path class="core-shade" d="M20 20L25.5 20L20 26Z"/><path class="glass-shine" d="M29 9l2 2M9 29l2 2"/>`;
  return `<svg class="energy-box ${owner}" viewBox="0 0 40 40" aria-hidden="true" style="--delay:${-(phase % 11) * .31}s">${outline}${bevel}<path class="glass-shine" d="M8 4.5H16M4.5 10V16M25 35.5H31"/><path class="corner-foot" d="M8 36h4v1H8Zm20 0h4v1h-4Z"/><ellipse class="base-shadow" cx="20" cy="32" rx="7" ry="1.4"/><g class="energy-float"><ellipse class="inner-aura" cx="20" cy="20" rx="12" ry="12"/>${energy}</g><rect class="conversion-wash" x="3" y="3" width="34" height="34" rx="4"/></svg>`;
}

function setBox(row, col, owner) {
  const cell = cells.get(`${row},${col}`);
  cell.innerHTML = box(owner, row * 6 + col);
  cell.dataset.owner = owner;
  cell.setAttribute('aria-label', `${row + 1}行${col + 1}列 ${owner === 'own' ? '自分' : '敵'}の箱`);
  return cell;
}
function renderBase() {
  board.replaceChildren();
  cells.clear();
  for (let row = 0; row < 8; row++) for (let col = 0; col < 6; col++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.position = `${row},${col}`;
    cells.set(`${row},${col}`, cell);
    board.append(cell);
  }
  initial.forEach(([r, c, owner]) => setBox(r, c, owner));
  $('#own-specimen').innerHTML = box('own');
  $('#enemy-specimen').innerHTML = box('enemy', 4);
}
function later(callback, delay) {
  const current = runId;
  const id = setTimeout(() => { timers.delete(id); if (current === runId) callback(); }, delay);
  timers.add(id);
}
function clearRun() {
  runId++;
  timers.forEach(clearTimeout);
  timers.clear();
  animations.forEach(animation => animation.cancel());
  animations.clear();
  effects.replaceChildren();
  $('#target').classList.remove('hit');
  document.querySelectorAll('[data-event]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  $('#own-specimen').classList.remove('pulse');
  $('#enemy-specimen').classList.remove('pulse');
  renderBase();
}
function pulseSpecimen() {
  if (reduced) return;
  const specimen = $('#own-specimen');
  specimen.classList.add('pulse');
  later(() => specimen.classList.remove('pulse'), 800);
}
function svgNode(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  effects.append(node);
  return node;
}
function center(element) {
  const a = $('#arena').getBoundingClientRect();
  const b = element.getBoundingClientRect();
  return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 };
}
function animate(node, frames, options, onFinish) {
  const animation = node.animate(frames, options);
  animations.add(animation);
  const current = runId;
  animation.onfinish = () => { animations.delete(animation); if (current === runId) onFinish?.(); };
  return animation;
}
function drawLink(from, to, motion = true) {
  const a = center(from), b = center(to);
  const line = svgNode('line', {x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'link-trace'});
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (motion && !reduced) animate(line,[{strokeDasharray:`${length}`,strokeDashoffset:length},{strokeDasharray:`${length}`,strokeDashoffset:0}],{duration:180,fill:'forwards',easing:'ease-out'});
  return line;
}
function attack(path) {
  const end = center($('#target'));
  path.forEach((cell, index) => {
    const start = center(cell);
    const particle = svgNode('circle', {cx:0,cy:0,r:2.1,class:'attack-particle'});
    animate(particle,[{transform:`translate(${start.x}px, ${start.y}px)`,opacity:1},{transform:`translate(${start.x + (end.x-start.x)*.4}px, ${start.y-50}px)`,opacity:1,offset:.35},{transform:`translate(${end.x}px, ${end.y}px)`,opacity:.2}],{duration:420,delay:index*80,fill:'both',easing:'cubic-bezier(.4,0,.65,1)'},()=>particle.remove());
  });
  later(() => {
    $('#target').classList.add('hit');
    svgNode('circle',{cx:end.x,cy:end.y,r:12,class:'impact-ring'});
    status.textContent = 'リンクしたコアから、敵へエネルギーを放出';
  }, 470);
  later(() => { effects.replaceChildren(); $('#target').classList.remove('hit'); path.forEach(c=>c.classList.remove('linking')); }, 1150);
}
function run(kind) {
  clearRun();
  document.querySelector(`[data-event="${kind}"]`)?.setAttribute('aria-pressed','true');
  if (kind === 'place') {
    const placed = setBox(5, 2, 'own');
    placed.classList.add('placed');
    status.textContent = reduced ? '投入後の状態。揺れ・落下を省略しています' : '着地だけ小さく弾む。箱の輪郭は崩しすぎない';
    pulseSpecimen();
    if (!reduced) later(() => placed.classList.remove('placed'), 650);
  }
  if (kind === 'link') {
    const path = ['6,0','6,1','6,2'].map(key=>cells.get(key));
    if (reduced) {
      path.forEach(cell=>cell.classList.add('linking'));
      drawLink(path[0],path[1],false); drawLink(path[1],path[2],false);
      status.textContent = '3つのコアがリンク。攻撃の移動演出を省略';
    } else {
      status.textContent = '3つのコアが順番につながる';
      path[0].classList.add('linking');
      later(()=>{drawLink(path[0],path[1]);path[1].classList.add('linking');}, 150);
      later(()=>{drawLink(path[1],path[2]);path[2].classList.add('linking');}, 380);
      later(()=>attack(path), 780);
      pulseSpecimen();
    }
  }
  if (kind === 'convert') {
    const convert = () => { const cell = setBox(5,3,'own'); cell.classList.add('converted','converting'); pulseSpecimen(); };
    if (reduced) convert();
    else {
      const old = cells.get('5,3').querySelector('.energy-box');
      animate(old,[{opacity:1},{opacity:.25}],{duration:180,fill:'forwards'},convert);
    }
    status.textContent = reduced ? '6行4列の敵箱が、自分の丸いコアに変化' : '敵の結晶が自分の色に染まり、丸いコアに変わる';
  }
}
function updateMotion() {
  document.body.dataset.motion = reduced ? 'still' : 'full';
  $('#reduce-motion').checked = reduced;
  $('#motion-origin').textContent = motionQuery.matches ? '端末設定：軽減' : '';
}
document.querySelectorAll('button[data-theme]').forEach(button => button.addEventListener('click', () => {
  document.body.dataset.theme = button.dataset.theme;
  document.querySelectorAll('button[data-theme]').forEach(b => b.setAttribute('aria-pressed', String(b===button)));
  $('#material-caption').textContent = button.dataset.theme === 'red' ? 'Red は揺れる炎。敵は紫の結晶' : 'Blue は氷のプリズム。敵は紫の結晶';
  clearRun();
  status.textContent = reduced ? '動きを抑えて表示中。ボタンで変化を確認' : 'コアが静かに浮遊。ボタンで演出を再生';
}));
document.querySelectorAll('[data-event]').forEach(button=>button.addEventListener('click',()=>run(button.dataset.event)));
$('#reset').addEventListener('click',()=>{clearRun();status.textContent='初期配置に戻しました';});
$('#reduce-motion').addEventListener('change',event=>{reduced=event.target.checked;clearRun();updateMotion();status.textContent=reduced?'動きを抑えて表示中。ボタンで変化を確認':'コアが静かに浮遊。ボタンで演出を再生';});
motionQuery.addEventListener('change',event=>{reduced=event.matches;clearRun();updateMotion();status.textContent=reduced?'端末の設定に合わせて動きを軽減しました':'通常の動きに戻しました';});
window.addEventListener('pagehide',()=>{timers.forEach(clearTimeout);animations.forEach(animation=>animation.cancel());});
document.body.dataset.theme='blue';
renderBase();
updateMotion();
if (reduced) status.textContent='端末の設定に合わせて動きを軽減しています';

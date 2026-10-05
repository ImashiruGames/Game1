// 日本語: ホームと同じ淡色ラボ様式のカプセル機。結果は保存済みで、演出は見た目だけ。
// English: Capsule terminal in the home's pale-lab style. The draw is already committed; motion is cosmetic only.

// 日本語: 8キャラの色から作ったカプセル色。English: Capsule hues taken from the roster palette.
const HUES = ['#a3417c', '#4f9ec4', '#e06a5a', '#4fb59a', '#d39a3c', '#8a63c4', '#8f9aa8', '#d9638f', '#5fa3a0'];
// 日本語: ドーム内の固定配置（中心x, 中心y, 回転）。English: Fixed in-dome layout (cx, cy, rotation).
const SLOTS: Array<[number, number, number]> = [
  [88, 128, -20], [120, 132, 15], [152, 127, 40],
  [72, 102, 30], [104, 106, -35], [138, 104, 10], [168, 100, -15],
  [96, 78, 50], [146, 76, -40],
];

function capsule(i: number): string {
  const [cx, cy, rot] = SLOTS[i]!, hue = HUES[i % HUES.length]!;
  return `<g class="gm-capsule" style="--i:${i}" transform="translate(${cx} ${cy}) rotate(${rot})"><g class="gm-capsule-body"><circle r="14" fill="#fbfaf6"/><path d="M-14 0a14 14 0 0 1 28 0z" fill="${hue}"/><path d="M-14 0h28" stroke="#ffffffb0" stroke-width="1.4"/><circle r="14" fill="none" stroke="#5a4a6233" stroke-width="1"/><path d="M-8-8a10 10 0 0 1 7-3" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/></g></g>`;
}

export function gachaMachineSvg(cost: number): string {
  const capsules = SLOTS.map((_, i) => capsule(i)).join('');
  return `<svg class="gm-svg" viewBox="0 0 240 300" aria-hidden="true" focusable="false">
<defs>
 <radialGradient id="gm-glass" cx=".32" cy=".26" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef6f3" stop-opacity=".92"/><stop offset="1" stop-color="#c6d9d3" stop-opacity=".95"/></radialGradient>
 <linearGradient id="gm-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6eef7"/><stop offset=".55" stop-color="#fbf8fb"/><stop offset="1" stop-color="#dfe9e6"/></linearGradient>
 <linearGradient id="gm-collar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8e315d"/><stop offset="1" stop-color="#ad4e80"/></linearGradient>
 <clipPath id="gm-dome-clip"><path d="M30 150V112a90 90 0 0 1 180 0v38z"/></clipPath>
 <clipPath id="gm-chute-clip"><rect x="92" y="246" width="56" height="30" rx="6"/></clipPath>
</defs>
<path class="gm-ticks" d="M6 20V6h14M234 20V6h-14M6 280v14h14M234 280v14h-14"/>
<ellipse cx="120" cy="290" rx="86" ry="6" fill="#4b3a5214"/>
<g class="capsule-globe">
 <path d="M30 150V112a90 90 0 0 1 180 0v38z" fill="url(#gm-glass)"/>
 <g clip-path="url(#gm-dome-clip)">
  <path class="gm-grid" d="M30 60h180M30 85h180M30 110h180M30 135h180M60 22v130M90 22v130M120 22v130M150 22v130M180 22v130"/>
  ${capsules}
 </g>
 <path d="M30 150V112a90 90 0 0 1 180 0v38" fill="none" stroke="#a98fae" stroke-width="2"/>
 <path d="M52 90a72 72 0 0 1 46-52" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>
 <path d="M58 112a66 66 0 0 1 4-14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>
</g>
<rect x="22" y="148" width="196" height="22" rx="3" fill="url(#gm-collar)"/>
<text class="gm-label" x="34" y="163">DISCOVERY</text><text class="gm-label" x="206" y="163" text-anchor="end">◈ ${cost}</text>
<path d="M32 170h176v104q0 10-10 10H42q-10 0-10-10z" fill="url(#gm-body)" stroke="#a98fae" stroke-width="2"/>
<path d="M44 182h152" stroke="#a98fae55" stroke-dasharray="2 4"/>
<rect x="160" y="192" width="28" height="7" rx="3.5" fill="#4a3650"/><path d="M166 195.5h16" stroke="#d9b6cb" stroke-width="1.5"/>
<text class="gm-micro" x="174" y="212" text-anchor="middle">COIN</text>
<g class="gm-gauge"><path d="M48 226a26 26 0 0 1 52 0" fill="none" stroke="#d5c7d6" stroke-width="3"/><path class="gm-gauge-fill" d="M48 226a26 26 0 0 1 52 0" fill="none" stroke="#a3417c" stroke-width="3" pathLength="100"/></g>
<g transform="translate(120 214)"><g class="capsule-handle">
 <circle r="25" fill="#fbf8fb" stroke="#a98fae" stroke-width="2"/>
 <circle r="18" fill="none" stroke="#a98fae66" stroke-dasharray="3 3"/>
 <path d="M0-15 4-4 15 0 4 4 0 15-4 4-15 0-4-4z" fill="#a3417c"/>
 <circle r="3" fill="#fbf8fb"/>
</g></g>
<g class="capsule-chute">
 <rect x="92" y="246" width="56" height="30" rx="6" fill="#3f2f47"/>
 <g clip-path="url(#gm-chute-clip)"><g class="gm-drop"><circle cx="120" cy="266" r="10" fill="#fbfaf6"/><path d="M110 266a10 10 0 0 1 20 0z" fill="#d39a3c"/><path d="M110 266h20" stroke="#fff" stroke-width="1.2"/></g></g>
 <path d="M92 252h56" stroke="#ffffff22"/>
</g>
<text class="gm-micro" x="44" y="268">NO.01</text>
</svg>`;
}

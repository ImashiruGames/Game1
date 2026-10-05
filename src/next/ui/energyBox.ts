const frame0 = new URL('../assets/box-frames/shiny-frame.webp',import.meta.url).href;
const frame1 = new URL('../assets/box-frames/frozen-frame.webp',import.meta.url).href;
const frame2 = new URL('../assets/box-frames/absolute-zero-frame.webp',import.meta.url).href;
const frame3 = new URL('../assets/box-frames/poison-frame.webp',import.meta.url).href;
const frame4 = new URL('../assets/box-frames/deadly-poison-frame.webp',import.meta.url).href;
const frame5 = new URL('../assets/box-frames/rubble-frame.webp',import.meta.url).href;
const frame6 = new URL('../assets/box-frames/thorn-frame.webp',import.meta.url).href;
import type {BoxType} from '../core/boxTypes.ts';
import type {Box,CharacterId,EnemyId,BattleState} from '../core/types.ts';
/** Generated raster materials leave the owner core visible; geometry/hit targets are unchanged. */
export function boxTypeOverlay(type:BoxType='normal'):string {
 const frames:Record<BoxType,string>={normal:'','shiny':frame0,'frozen':frame1,'absolute-zero':frame2,'poison':frame3,'deadly-poison':frame4,'rubble':frame5,'thorn':frame6};
 const source=frames[type];
 return source?`<g class="eb-type-overlay eb-type-${type}"><image class="eb-type-raster" href="${source}" x="0" y="0" width="40" height="40" preserveAspectRatio="xMidYMid meet"/></g>`:'';
}
export interface EnergyAppearance {readonly characterId?:CharacterId;readonly rosterId?:string;readonly enemyId?:EnemyId;readonly transformation?:BattleState['transformation']}
export function energyAppearance(state:BattleState):EnergyAppearance{return {characterId:state.config.characterId,rosterId:state.config.meta?.rosterId,enemyId:state.config.enemyId,transformation:state.transformation};}
export function energyTheme(owner:Box['owner'],appearance:EnergyAppearance):string {
 if(owner==='neutral')return 'neutral';
 if(owner==='player'&&appearance.rosterId==='imashiru')return 'imashiru';
 if(owner==='player')return appearance.characterId==='red'?'red':'blue';
 return appearance.enemyId??'marujiro';
}
/** Cosmetic SVG only. Color-independent round / diamond / square ownership never touches rules. */
export function energyBoxMarkup(box:Pick<Box,'owner'|'row'|'col'> & Partial<Pick<Box,'type'>>, appearance:EnergyAppearance):string {
  const owner=box.owner, own=owner==='player', phase=box.row*6+box.col;
  const theme=energyTheme(owner,appearance), transformed=owner==='player'&&!!appearance.transformation;
  const outline = own ? '<rect class="eb-glass-body" x="2.5" y="2.5" width="35" height="35" rx="6"/>' : '<path class="eb-glass-body" d="M8 2.5H32L37.5 8V32L32 37.5H8L2.5 32V8Z"/>';
  const bevel = own ? '<rect class="eb-glass-bevel" x="5" y="5" width="30" height="30" rx="4"/>' : '<path class="eb-glass-bevel" d="M9 5H31L35 9V31L31 35H9L5 31V9Z"/>';
  const energy = owner==='neutral' ? `<rect class="eb-core-rim" x="13" y="13" width="14" height="14" rx="1"/><rect class="eb-core-fill" x="16" y="16" width="8" height="8" rx="1"/><path class="eb-core-glint" d="M16 16h8v2h-8Z"/>` : own ? `<g class="eb-blue-energy"><path class="eb-prism-field" d="M20 7L28 13L30 25L20 31L10 25L12 13Z"/><path class="eb-prism-seam" d="M20 7V31M12 13L20 16L28 13M10 25L20 21L30 25"/><path class="eb-core-rim" d="M26.8 20a6.8 6.8 0 1 1-13.6 0 6.8 6.8 0 0 1 13.6 0"/><circle class="eb-core-fill" cx="20" cy="20" r="4.8"/><path class="eb-core-shade" d="M15.4 21.3a4.8 4.8 0 0 0 9-1.2q-5.3 2.3-9 1.2"/><path class="eb-core-glint" d="M17 16.8q3-2 5.3.2l-1.6 1.7q-1.5-1-3 .2Z"/><circle class="eb-dust" cx="28" cy="10" r=".6"/><circle class="eb-dust" cx="11" cy="29" r=".45"/></g><g class="eb-red-energy"><g class="eb-flame-tongue"><path class="eb-flame-outer" d="M20 6c3 5-1 6 3 9 2-2 2-4 2-4 7 9 6 18-4 21C9 33 8 22 12 17c0 3 2 4 3 4-2-8 5-8 5-15Z"/><path class="eb-flame-edge" d="M15 26c-2-6 5-7 4-15 6 9-1 10 6 15"/></g><circle class="eb-core-rim" cx="20" cy="22" r="6.8"/><circle class="eb-core-fill" cx="20" cy="22" r="4.8"/><path class="eb-flame-inner" d="M20 17c3 2 4 4 2 7-1 2-5 2-5-1 0-2 3-3 3-6Z"/><circle class="eb-dust" cx="28" cy="16" r=".6"/><circle class="eb-dust" cx="13" cy="10" r=".45"/></g>` : `<path class="eb-prism-field" d="M20 6L30 20L20 33L10 20Z"/><path class="eb-prism-seam" d="M20 6V33M10 20H30M20 11L27 20L20 28L13 20Z"/><path class="eb-core-rim" d="M20 11.5L28 20L20 28.5L12 20Z"/><path class="eb-core-fill" d="M20 14L25.5 20L20 26L14.5 20Z"/><path class="eb-core-glint" d="M20 14L20 20L14.5 20Z"/><path class="eb-core-shade" d="M20 20L25.5 20L20 26Z"/><path class="eb-glass-shine" d="M29 9l2 2M9 29l2 2"/>`;
  return `<svg class="energy-box ${owner}${box.type==='shiny'?' is-shiny':''}${transformed?' is-transformed':''}" data-box-type="${box.type??'normal'}" data-energy-theme="${theme}" viewBox="0 0 40 40" aria-hidden="true" focusable="false" style="--delay:${-(phase % 11) * .31}s">${outline}${bevel}<path class="eb-glass-shine" d="M8 4.5H16M4.5 10V16M25 35.5H31"/><path class="eb-corner-foot" d="M8 36h4v1H8Zm20 0h4v1h-4Z"/><ellipse class="eb-base-shadow" cx="20" cy="32" rx="7" ry="1.4"/><g class="eb-energy-float"><ellipse class="eb-inner-aura" cx="20" cy="20" rx="12" ry="12"/>${energy}</g><rect class="eb-conversion-wash" x="3" y="3" width="34" height="34" rx="4"/>${boxTypeOverlay(box.type)}</svg>`;
}


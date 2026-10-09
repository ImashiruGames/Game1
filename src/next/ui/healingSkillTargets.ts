import {skillHasEffect} from '../core/skillCatalog.ts';
import type {BattleState,NormalSkillId} from '../core/types.ts';
/** Resolve equipped HP-healing skills through the shared definition tags and real HUD nodes. */
export function isHealingSkill(id:NormalSkillId):boolean{return skillHasEffect(id,'hp-heal');}
export function equippedHealingSlots(state:Pick<BattleState,'build'>){return state.build?[state.build.fixed,...state.build.slots].flatMap((s,index)=>s&&isHealingSkill(s.id)&&(s.uses===null||s.uses>0)?[{index,id:s.id}]:[]):[];}
export function visibleHealingIcon(node:HTMLElement):boolean{
 const win=node.ownerDocument.defaultView;if(!win||!node.isConnected||node.getClientRects().length===0)return false;
 const r=node.getBoundingClientRect();if(![r.left,r.top,r.width,r.height].every(Number.isFinite)||r.width<=0||r.height<=0||r.left<0||r.top<0||r.right>win.innerWidth||r.bottom>win.innerHeight)return false;
 for(let el:HTMLElement|null=node;el;el=el.parentElement){const s=win.getComputedStyle(el);if(el.hidden||el.getAttribute('aria-hidden')==='true'||s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'||Number(s.opacity)===0)return false;
  if(el!==node){const b=el.getBoundingClientRect();if(/hidden|clip|scroll|auto/.test(s.overflowX)&&(r.left<b.left||r.right>b.right))return false;if(/hidden|clip|scroll|auto/.test(s.overflowY)&&(r.top<b.top||r.bottom>b.bottom))return false;}
 }return true;
}
export function healingHudTargets(root:HTMLElement,state:Pick<BattleState,'build'>):HTMLElement[]{
 return equippedHealingSlots(state).flatMap(({index,id})=>{const node=root.querySelector<HTMLElement>('.hud-skill[data-skill-info="'+index+'"]');return node?.classList.contains('skill-trigger--'+id)&&visibleHealingIcon(node)?[node]:[];});
}

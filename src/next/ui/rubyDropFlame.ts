import type {BattleState,DropEvent,Resolution} from '../core/types.ts';
import {transformationIdentity} from './transformationIdentity.ts';
/** Presentation-only classification of the existing, isolated turn-start resolution. */
export function rubyAutoDrop(event:DropEvent,resolution:Resolution,before:BattleState):boolean {
 const start=resolution.events[0];
 return resolution.actor==='player'&&event.actor==='player'&&event.box.owner==='player'
  &&before.transformation?.character==='red'&&transformationIdentity(before.config,'red').id==='red'
  &&start?.type==='turn-start'&&!start.skipped&&resolution.events.find(e=>e.type==='drop')===event;
}
/** User-approved B: exact preview gradients and geometry, shared with the comparison. */
export const RUBY_COMET_STYLE=Object.freeze({
 "pointerEvents": "none",
 "backgroundRepeat": "no-repeat",
 "backgroundSize": "100% 100%",
 "border": "0",
 "borderRadius": "0",
 "filter": "none",
 "mixBlendMode": "normal",
 "left": "-25%",
 "top": "-95%",
 "width": "150%",
 "height": "190%",
 "backgroundImage": "radial-gradient(ellipse 28% 24% at 50% 76%,rgba(255,255,244,.94) 0%,rgba(255,233,161,.78) 24%,rgba(255,166,76,.32) 60%,rgba(255,118,41,0) 100%),radial-gradient(ellipse 17% 54% at 50% 61%,rgba(255,206,126,.60) 0%,rgba(255,159,71,.33) 38%,rgba(255,116,36,.09) 73%,rgba(255,99,31,0) 100%)"
});
export function applyRubyComet(node:HTMLElement):void{
 node.innerHTML='';node.dataset.candidate='comet';Object.assign(node.style,RUBY_COMET_STYLE);
}
/** Step at the exact flight/landing boundary, on the moving box's own animation clock. */
export function rubyDropFlameFrames(landingOffset:number):Keyframe[]{return [{opacity:1,offset:0,easing:'steps(1,end)'},{opacity:0,offset:landingOffset},{opacity:0,offset:1}];}

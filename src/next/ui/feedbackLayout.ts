import {feedbackPosition} from './battleFeedback.ts';
import type {FeedbackRect} from './battleFeedback.ts';
import type {Actor} from '../core/types.ts';
/** Convert the visible board viewport to the feedback layer's coordinates, including scroll offsets. */
export function feedbackLayerPosition(view:{left:number;top:number;width:number;height:number},layer:{left:number;top:number},cells:readonly FeedbackRect[],label:{width:number;height:number},anchor:Actor,inset=0){
 const local=cells.map(r=>({left:r.left-view.left,right:r.right-view.left,top:r.top-view.top,bottom:r.bottom-view.top}));
 const p=feedbackPosition(view,local,label,anchor,inset);
 return {...p,x:p.x+view.left-layer.left,y:p.y+view.top-layer.top};
}
export function placeFeedbackBubble(area:HTMLElement,layer:HTMLElement,bubble:HTMLElement,cells:readonly HTMLElement[],anchor:Actor,inset=0):void {
 if(!bubble.isConnected)return;
 const rect=area.getBoundingClientRect(),origin=layer.getBoundingClientRect();
 const p=feedbackLayerPosition({left:rect.left+area.clientLeft,top:rect.top+area.clientTop,width:area.clientWidth,height:area.clientHeight},{left:origin.left+layer.clientLeft,top:origin.top+layer.clientTop},cells.map(c=>c.getBoundingClientRect()),{width:bubble.offsetWidth,height:bubble.offsetHeight},anchor,inset);
 bubble.style.left=p.x+'px';bubble.style.top=p.y+'px';bubble.style.setProperty('--rise',-p.rise+'px');
}

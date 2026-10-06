export interface GuideRect {top:number;bottom:number;height:number}
/** 日本語: 実測した対象と台詞の高さから上下を選び、必要なスクロール量も返す。
 * English: Choose top/bottom from measured target and speech bounds; expose the minimum scroll correction. */
export function treeGuidePlacement(view:GuideRect,target:GuideRect,height:number){
 const gap=12,top=view.top+gap,bottom=view.bottom-gap-height;
 const topOverlap=Math.max(0,Math.min(top+height,target.bottom+gap)-Math.max(top,target.top-gap));
 const bottomOverlap=Math.max(0,Math.min(bottom+height,target.bottom+gap)-Math.max(bottom,target.top-gap));
 const side=topOverlap<bottomOverlap?'top':bottomOverlap<topOverlap?'bottom':target.top+target.height/2<view.top+view.height/2?'bottom':'top';
 const y=side==='top'?top:bottom;
 const visibleTop=side==='top'?y+height+gap:view.top+gap,visibleBottom=side==='bottom'?y-gap:view.bottom-gap;
 const scrollBy=target.top<visibleTop?target.top-visibleTop:target.bottom>visibleBottom?target.bottom-visibleBottom:0;
 return {side,y,scrollBy};
}

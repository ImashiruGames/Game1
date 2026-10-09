/** Presentation only: old Safari vh fallback, no game or persisted state. */
export function availableViewportHeight(view:Pick<Window,'innerHeight'|'visualViewport'>):number {
 const visual=view.visualViewport;
 const height=visual&&visual.scale===1?Math.min(view.innerHeight,visual.height):view.innerHeight;
 return Number.isFinite(height)&&height>0?Math.round(height):0;
}
export function installViewportHeight(root:HTMLElement,view:Window=window):()=>void {
 let last=0;
 const update=()=>{const height=availableViewportHeight(view);if(height&&height!==last){last=height;root.style.setProperty('--available-viewport-height',height+'px');}};
 update();view.addEventListener('resize',update);view.addEventListener('pageshow',update);view.visualViewport?.addEventListener('resize',update);
 return ()=>{view.removeEventListener('resize',update);view.removeEventListener('pageshow',update);view.visualViewport?.removeEventListener('resize',update);};
}

/** 日本語: 選択描画で盤面ボタンを作り直しても、キーボードの投入・行指定を継続する。
 * English: Restore the exact board target after rendering replaces its DOM node. */
export function preserveBoardTargetFocus(container:HTMLElement):()=>void {
 const active=container.ownerDocument.activeElement as HTMLElement|null;
 if(!active||!container.contains(active))return ()=>{};
 const {cellRow,cellCol,drop}=active.dataset;
 if(drop===undefined&&(cellRow===undefined||cellCol===undefined))return ()=>{};
 return ()=>{
  const candidates=container.querySelectorAll<HTMLButtonElement>('button[data-drop],button[data-cell-row]');
  const next=[...candidates].find(button=>drop!==undefined?button.dataset.drop===drop:button.dataset.cellRow===cellRow&&button.dataset.cellCol===cellCol);
  if(next&&!next.disabled)next.focus({preventScroll:true});
 };
}

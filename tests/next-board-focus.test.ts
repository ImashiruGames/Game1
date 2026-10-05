import test from 'node:test';import assert from 'node:assert/strict';
import {preserveBoardTargetFocus} from '../src/next/ui/boardFocus.ts';
import {readFileSync} from 'node:fs';
test('selection rerender preserves exact emitter or row keyboard focus across replacement, without scrolling',()=>{
 for(const dataset of [{drop:'ceiling:3:2'},{cellRow:'6',cellCol:'2'}]){
  const old={dataset},doc={activeElement:old as unknown};let targets:any[]=[old],focused:any=null;
  const root={ownerDocument:doc,contains:(n:any)=>targets.includes(n),querySelectorAll:()=>targets};
  const restore=preserveBoardTargetFocus(root as any);
  const replacement={dataset,disabled:false,focus:(options:any)=>{focused=replacement;doc.activeElement=replacement;assert.deepEqual(options,{preventScroll:true});}};
  targets=[{dataset:{cellRow:'0',cellCol:'0'},disabled:false},replacement];restore();assert.equal(focused,replacement);assert.equal(doc.activeElement,replacement);
 }
});
test('disabled or removed targets and focus outside the board are never moved',()=>{let focused=false;const active={dataset:{drop:'top:2'}},candidate={dataset:{drop:'top:2'},disabled:true,focus(){focused=true;}},root={ownerDocument:{activeElement:active},contains:()=>true,querySelectorAll:()=>[candidate]};preserveBoardTargetFocus(root as any)();assert.equal(focused,false);root.contains=()=>false;candidate.disabled=false;preserveBoardTargetFocus(root as any)();assert.equal(focused,false);});
test('board renderer restores focus and selected-row reactivation has no time limit',()=>{const source=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8');assert.match(source,/const restoreFocus=preserveBoardTargetFocus/);assert.match(source,/fitBoard\(\);restoreFocus\(\)/);assert.match(source,/const confirm=selected.row===row;/);assert.doesNotMatch(source,/rowDoubleTap.tap/);});

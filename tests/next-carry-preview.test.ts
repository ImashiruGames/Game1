import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/next/core/battle.ts';
import { createTrialConfig } from '../src/next/config.ts';
import { carryTopPlayerRow } from '../src/next/app/BattleRun.ts';
import { carryPreview, renderCarryPreview } from '../src/next/ui/carryPreview.ts';
import type { BattleState, Box } from '../src/next/core/types.ts';
const box = (id: string, row: number, col: number, owner: Box['owner'] = 'player'): Box => ({id,row,col,owner,type:'normal',status:'normal'});
const state = (boxes: readonly Box[]): BattleState => ({...createBattle(createTrialConfig('red')),boxes});

test('carry markers identify one highest player row, not each column top', () => {
  const s=state([box('p-high',2,0),box('p-same',2,3),box('p-low',4,1),box('enemy-high',1,2,'enemy'),box('enemy-same',2,4,'enemy'),box('neutral',2,5,'neutral')]);
  const before=JSON.stringify(s),view=carryPreview(s);
  assert.deepEqual(view.candidates.map(b=>b.id),['p-high','p-same']);assert.equal(view.sourceRow,2);
  assert.deepEqual(view.candidates.map(b=>b.col),[0,3]);assert.deepEqual(view.candidates.map(b=>b.row),[2,2]);
  assert.deepEqual(carryTopPlayerRow(s).map(b=>b.id),view.candidates.map(b=>b.id));
  assert.equal(JSON.stringify(s),before);assert.match(view.explanation,/各列の最上箱/);
});
test('captured boxes join the real carry row; removal and no-player boards recalculate', () => {
  const s=state([box('old',5,0),box('captured',3,1),box('other',4,2)]);
  assert.deepEqual(carryPreview(s).candidates.map(b=>b.id),['captured']);
  assert.deepEqual(carryPreview({...s,boxes:s.boxes.filter(b=>b.id!=='captured')}).candidates.map(b=>b.id),['other']);
  assert.equal(carryPreview(state([box('e',1,0,'enemy')])).candidates.length,0);
  assert.equal(carryPreview(s,false).candidates.length,0);assert.match(carryPreview(s,false).label,/持越しなし/);
});

test('DOM markers preserve existing axis/target classes and do not accumulate legends', () => {
  const classes = new Set(['cell','player','hit','row-target']);
  const cell={getAttribute:(key:string)=>attrs.get(key),classList:{add:(v:string)=>classes.add(v),remove:(v:string)=>classes.delete(v)},setAttribute:(key:string,value:string)=>{attrs.set(key,value);}};
  const attrs=new Map<string,string>();let legend:{className:string;textContent:string|null;title:string;setAttribute:(key:string,value:string)=>void}|null=null;let appended=0;
  const host={querySelector:()=>legend,append:(value:typeof legend)=>{legend=value;appended++;}};
  const board={querySelectorAll:()=>classes.has('carry-candidate')?[cell]:[],querySelector:()=>cell,parentElement:host,ownerDocument:{createElement:()=>({className:'',textContent:null,title:'',setAttribute(){}})}};
  const s=state([box('p',2,0)]);renderCarryPreview(board as unknown as HTMLElement,s);renderCarryPreview(board as unknown as HTMLElement,s);
  assert.ok(classes.has('carry-candidate'));assert.ok(classes.has('hit'));assert.ok(classes.has('row-target'));assert.equal(appended,1);assert.match(attrs.get('aria-label')!,/持越し候補/);
  renderCarryPreview(board as unknown as HTMLElement,s,false);assert.ok(!classes.has('carry-candidate'));assert.ok(classes.has('hit'));assert.doesNotMatch(attrs.get('aria-label')!,/持越し候補/);
});

test('carry marker preserves a committed box type and other accessible descriptions',()=>{const attrs=new Map([['aria-label','8行1列 自箱・輝きタイプ']]);const classes=new Set<string>();const cell={getAttribute:(k:string)=>attrs.get(k),setAttribute:(k:string,v:string)=>attrs.set(k,v),classList:{add:(c:string)=>classes.add(c),remove:(c:string)=>classes.delete(c)}};const board={querySelectorAll:()=>classes.has('carry-candidate')?[cell]:[],querySelector:()=>cell,parentElement:null};const s=state([{...box('shine',7,0),type:'shiny'}]);renderCarryPreview(board as unknown as HTMLElement,s);renderCarryPreview(board as unknown as HTMLElement,s);assert.equal(attrs.get('aria-label'),'8行1列 自箱・輝きタイプ · 次戦へ持越し候補');renderCarryPreview(board as unknown as HTMLElement,s,false);assert.equal(attrs.get('aria-label'),'8行1列 自箱・輝きタイプ');});

import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleController} from '../src/next/app/BattleController.ts';
import {rewardReviewFixture} from '../src/next/ui/rewardReviewFixture.ts';
import {createRewardDialog} from '../src/next/ui/rewardDialog.ts';
import {decodeSave,encodeSave} from '../src/next/app/saveCheckpoint.ts';

class Dialog {
 innerHTML='';open=false;focus:string[]=[];events=new Map<string,Function>();
 showModal(){this.open=true;}close(){this.open=false;}
 addEventListener(name:string,fn:Function){this.events.set(name,fn);}removeEventListener(name:string,fn:Function){if(this.events.get(name)===fn)this.events.delete(name);}
 querySelector(selector:string){this.focus.push(selector);return {focus(){}};}
 button(name:string,value?:string):HTMLButtonElement{
  const matches=[...this.innerHTML.matchAll(/<button\b[^>]*>/g)].map(m=>m[0]);
  const html=matches.find(s=>s.includes(`data-${name}="${value??''}"`)||(value===undefined&&s.includes(`data-${name}=`)));assert.ok(html,`${name}:${value}`);
  const dataset:Record<string,string>={};for(const [,key,v] of html.matchAll(/data-([\w-]+)="([^"]*)"/g))dataset[key!.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v!.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&amp;','&');
  return {dataset} as HTMLButtonElement;
 }
}
const view={render(){},async animate(){}};const pointer={detail:1,clientX:100,clientY:150} as MouseEvent;
async function setup(){const s=rewardReviewFixture('full'),c=new BattleController(s.config,view,s.options);await c.start();await c.drop('ceiling:2:0');const d=new Dialog(),marks:unknown[]=[],commands:Promise<boolean>[]=[];let locked=false;
 const dialog=createRewardDialog(d as unknown as HTMLDialogElement,{controller:()=>({get snapshot(){return c.snapshot;},get runSnapshot(){return c.runSnapshot;},chooseCategory:(id,category)=>{const p=c.chooseCategory(id,category);commands.push(p);return p;},chooseReward:(id,reward,slot)=>{const p=c.chooseReward(id,reward,slot);commands.push(p);return p;}}),locked:()=>locked,markCommit:e=>marks.push(e),afterPreview(){}});
 const render=()=>dialog.render(c.snapshot,c.runSnapshot,locked);render();return {c,d,dialog,marks,commands,render,lock:(value:boolean)=>{locked=value;}};
}
test('locked boot never stacks reward modal; offer/category controls retain their command boundary',async()=>{
 const s=await setup();s.dialog.reset();s.lock(true);s.render();assert.equal(s.d.open,false);const b=s.d.button('category','skills');s.dialog.handleInput(b,pointer);assert.equal(s.commands.length,0);
 s.lock(false);s.render();assert(s.d.open);s.dialog.handleInput(s.d.button('category','skills'),pointer);await Promise.all(s.commands);s.render();assert.equal(s.marks.length,0);assert.equal(s.c.runSnapshot!.offer!.category,'skills');
});
test('preview redraw preserves focus and checkpoint, repeat commits Health+ once',async()=>{
 const s=await setup();await s.c.chooseCategory(s.c.runSnapshot!.offer!.id,'skills');s.render();const cp=JSON.stringify(s.c.exportCheckpoint()),slots=s.c.snapshot.build!.slots;
 s.dialog.handleInput(s.d.button('reward-preview','health'),pointer);assert.equal(JSON.stringify(s.c.exportCheckpoint()),cp);assert.equal(s.d.focus.at(-1),'[data-reward-preview="health"]');
 const b=s.d.button('reward-preview','health');s.dialog.handleInput(b,pointer);s.dialog.handleInput(b,pointer);await Promise.all(s.commands);
 assert.equal(s.c.runSnapshot!.stage,9);assert.equal(s.c.snapshot.build!.fixed.rank,2);assert.deepEqual(s.c.snapshot.build!.slots,slots);assert.equal(s.commands.length,1);assert.equal(s.marks.length,1);
});
test('outgoing slot focus, cancel and reset preserve fixed offers while clearing transient selection',async()=>{
 const s=await setup();await s.c.chooseCategory(s.c.runSnapshot!.offer!.id,'skills');s.render();const cp=JSON.stringify(s.c.exportCheckpoint());
 s.dialog.handleInput(s.d.button('reward-preview','corner-strike'),pointer);s.dialog.handleInput(s.d.button('replace-preview','1'),pointer);assert.equal(s.d.focus.at(-1),'[data-replace-preview="1"]');
 s.dialog.handleInput(s.d.button('replace-cancel'),pointer);assert.equal(s.d.focus.at(-1),'[data-reward-preview="corner-strike"]');assert.equal(JSON.stringify(s.c.exportCheckpoint()),cp);
 s.dialog.handleInput(s.d.button('reward-preview','health'),pointer);const stale=s.d.button('reward-preview','health');s.dialog.reset();s.render();s.dialog.handleInput(stale,pointer);assert.equal(s.commands.length,0);
 assert.deepEqual(decodeSave(encodeSave(s.c.exportCheckpoint(),1)).checkpoint,JSON.parse(cp));assert.doesNotMatch(s.d.innerHTML,/data-reward-repeat="true"/);
});
test('held activation keys and native modal dismissal stay guarded; dispose removes only own listeners',async()=>{
 const s=await setup();for(const key of ['Enter',' ']){let prevented=0,stopped=0;s.d.events.get('keydown')!({key,repeat:true,preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}});assert.equal(prevented,1);assert.equal(stopped,1);}
 let prevented=0;s.d.events.get('keydown')!({key:'Enter',repeat:false,preventDefault(){prevented++;},stopImmediatePropagation(){}});assert.equal(prevented,0);
 s.d.events.get('cancel')!({preventDefault(){prevented++;}});assert.equal(prevented,1);s.dialog.dispose();assert.equal(s.d.events.size,0);assert.equal(s.d.open,false);
});

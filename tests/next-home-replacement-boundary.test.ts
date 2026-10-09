import {isTerminalRun} from '../src/next/app/BattleRun.ts';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
import {createProfile,ProfileStore,freezeRunMeta} from '../src/next/meta/profile.ts';
import {reconcileSavedProgress} from '../src/next/meta/reconciliation.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';import {LocalSave,saveNamespace} from '../src/next/app/localSave.ts';
import {BattleController} from '../src/next/app/BattleController.ts';import type {RunCheckpoint} from '../src/next/app/saveCheckpoint.ts';
const view={render(){},async animate(){}};
class Storage {data=new Map<string,string>();fault:'none'|'before'|'after'='none';profileKey='';getItem(key:string){return this.data.get(key)??null;}setItem(key:string,value:string){if(key===this.profileKey&&this.fault==='before')throw new Error('quota before commit');this.data.set(key,value);if(key===this.profileKey&&this.fault==='after'){this.fault='none';throw new Error('uncertain persisted commit');}}}
const main=readFileSync(new URL('../src/next/main.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('main.ts',main,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
function actualFunctions(names:string[]):string{return names.map(name=>{const node=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===name);assert(node,`main.ts must retain ${name}`);return node.getText(ast);}).join('\n');}
test('actual main newRun cannot replace or destroy a pending terminal checkpoint after settlement failure',async()=>{
 for(const fault of ['before','after'] as const){
  const storage=new Storage(),profileStore=new ProfileStore(storage,()=>true),save=new LocalSave(storage,()=>true);profileStore.read();storage.profileKey=profileStore.key;save.read();const setup=prepareDeparture(freezeRunMeta(createProfile(1),'blue',true),1),start=new BattleController(setup.config,view,setup.options).exportCheckpoint();
  const terminal={...start,run:{...start.run!,stage:50,defeatedCount:50,status:'cleared'},state:{...start.state,hp:{...start.state.hp,player:{...start.state.hp.player,current:10},enemy:{...start.state.hp.enemy,current:0}},result:{winner:'player',reason:'hp-zero'}}} as RunCheckpoint;
  profileStore.register(terminal);save.write(terminal);const raw=storage.getItem(saveNamespaceKey(save));assert(raw);let destroyed=0,hidden=0,errors=0,homeShown=0;
  const injected={skillActivationEffects:{clear(){}},save,profileStore,ownership:{owned:true},localStorage:storage,SAVE_KEY:saveNamespaceKey(save),window:{confirm:()=>true},initialSetup:setup,view,BattleController,reconcileSavedProgress,isTerminalRun,
   persistence:{beforeAction(){save.guard();profileStore.guard();},write(cp:RunCheckpoint){save.write(cp);profileStore.settle(cp);},failed(){errors++;}},
   reportSaveError(){errors++;},home:{hide(){hidden++;},show(){homeShown++;}},details:{close(){}},rewardDialog:{reset(){}},saveDialog:{close(){}},el:()=>({close(){}}),musicScene:{showHome(){},enterBattle(){}},oldController:{destroy(){destroyed++;}}};
  const code=ts.transpileModule(`let controller=oldController,selected=null,saveRecovery='controller';${actualFunctions(['reconcileSavedSettlement','newRun','showHome'])};return {newRun,showHome,recovery:()=>saveRecovery};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const app=new Function(...Object.keys(injected),code)(...Object.values(injected)) as {newRun(s:typeof setup):Promise<void>;showHome():void;recovery():string};
  storage.fault=fault;await app.newRun(setup);assert.equal(storage.getItem(saveNamespaceKey(save)),raw);assert.equal(save.latest!.checkpoint.runId,terminal.runId);assert.equal(destroyed,0);assert.equal(hidden,0);assert.equal(errors,1);assert.equal(app.recovery(),'boot');
  // A still-failing storage layer must also prevent entering a replacement home flow.
  if(fault==='before'){app.showHome();assert.equal(homeShown,0);assert.equal(storage.getItem(saveNamespaceKey(save)),raw);}
  storage.fault='none';await app.newRun(setup);assert.equal(profileStore.current.coins,450);assert.equal(profileStore.current.characters.blue.xp,750);assert.equal(Object.keys(profileStore.current.receipts).length,1);assert.notEqual(save.latest!.checkpoint.runId,terminal.runId);assert.equal(destroyed,1);assert.equal(hidden,1);
 }
});
function saveNamespaceKey(_save:LocalSave):string{return saveNamespace('/next/').key;}

test('boot readiness follows settlement and pre-swap launch retry reconciles through boot',()=>{
 const boot=actualFunctions(['boot']),settlement=boot.indexOf('profileStore.settle'),ready=boot.indexOf('profileReady=true');assert(settlement>=0&&ready>settlement);
 assert.match(main,/if\(action==='retry'\)\{if\(saveRecovery==='boot'\)\{void boot\(\);return;\}/);
});

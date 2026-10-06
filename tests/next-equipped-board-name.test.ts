import test from 'node:test';import assert from 'node:assert/strict';
import {equippedBoardName} from '../src/next/ui/equippedBoardName.ts';
import {createProfile,freezeRunMeta} from '../src/next/meta/profile.ts';
import {prepareDeparture} from '../src/next/meta/departure.ts';
import {BattleController} from '../src/next/app/BattleController.ts';
import {getAvailableBoardSkills} from '../src/next/core/skills.ts';
import {boardSkillName} from '../src/next/ui/kitInformation.ts';
import {roster} from '../src/next/meta/roster.ts';import type {RosterId} from '../src/next/meta/roster.ts';
import {prepareTrialSetup} from '../src/next/config.ts';
test('every roster loadout keeps its equipped name through start, locked rendering, enemy turn and restore',async()=>{
 const p=createProfile();p.ownedCharacters=Object.keys(roster) as RosterId[];
 for(const id of p.ownedCharacters){const x=prepareDeparture(freezeRunMeta(p,id,false),7);const expected=boardSkillName(x.config.meta!.board);const seen:string[]=[];const view={render(s:Parameters<typeof getAvailableBoardSkills>[0]){seen.push(equippedBoardName(s.config));},async animate(){}};const c=new BattleController(x.config,view,x.options);await c.start();assert.equal(equippedBoardName(c.snapshot.config),expected);const enemy={...c.snapshot,actor:'enemy' as const};assert.equal(getAvailableBoardSkills(enemy).length,0);assert.equal(equippedBoardName(enemy.config),expected);await c.drop('ceiling:2:0');const restored=BattleController.restore(c.exportCheckpoint(),view);await restored.start();assert(seen.length>0);assert(seen.every(n=>n===expected));}
});
test('legacy red trial cannot fall back to blue skill when unavailable',()=>{const x=prepareTrialSetup({character:'red',firstEnemy:'marujiro',seed:1,mode:'manual',stage:1,fixture:'normal',route:'boss-loop'});assert.equal(equippedBoardName(x.config),'ほむらの火種');assert.equal(equippedBoardName({...x.config,playerSkills:{boardSkills:[],shapeSkills:[],linkSkills:[]}}),'盤面スキル');});

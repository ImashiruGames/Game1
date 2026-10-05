import {prepareTrialSetup} from '../config.ts';
import {createPlayerBuild,createSkill} from '../core/playerBuild.ts';
import type {PlayerBuild} from '../core/types.ts';
/** Isolated review route only; visible setup buttons create ordinary valid starts. */
export function rewardReviewFixture(kind:'full'|'long') {
 const setup=prepareTrialSetup({character:'blue',firstEnemy:'marujiro',seed:1,mode:'manual',stage:8,fixture:'reward',route:'boss-loop'});
 const build:PlayerBuild={...createPlayerBuild('blue'),slots:kind==='full'?[createSkill('first-guard'),createSkill('charge')]:[createSkill('grow-fire',2),createSkill('horizontal-slash',2)],power:kind==='long'?{3:49,4:98,5:147}:{3:0,4:0,5:0}};
 return {...setup,config:{...setup.config,initialBuild:build,...(kind==='long'?{combatants:{...setup.config.combatants,player:{...setup.config.combatants.player,maxHp:275,initialHp:275}}}:{})}};
}

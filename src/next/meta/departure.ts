import {REWARD_HEAL_PER_RANK} from './profile.ts';
import {IMASHIRU} from '../core/shiny.ts';
import {createTuning} from '../core/tuning.ts';
import {prepareTrialSetup} from '../config.ts';
import {roster} from './roster.ts';
import type {RunMeta} from './profile.ts';
import {createSkill} from '../core/playerBuild.ts';
import type {PlayerBuild} from '../core/types.ts';
/** Snapshot applies only once, at departure. Subsequent stages carry the saved build. */
export function prepareDeparture(meta:RunMeta,seed:number){const entry=roster[meta.rosterId];const setup=prepareTrialSetup({character:entry.archetype,firstEnemy:'marujiro',seed,mode:'manual',stage:1,fixture:'normal',route:'boss-loop'});const tree=meta.tree;const base=meta.rosterId==='violet'&&meta.balanceVersion!==2?{3:4,4:7,5:12}:entry.attacks;const attacks={3:base[3]+tree.three,4:base[4]+tree.four,5:base[5]+tree.five*2};return {...setup,config:{...setup.config,meta:structuredClone(meta),tuning:createTuning({...setup.config.tuning,rewards:{...setup.config.tuning!.rewards,immediateHeal:setup.config.tuning!.rewards.immediateHeal+(meta.treeVersion===2?(tree.rewardHeal??0)*REWARD_HEAL_PER_RANK:0)},...(meta.rosterId==='imashiru'?{gauge:{...setup.config.tuning!.gauge,limits:{...setup.config.tuning!.gauge.limits,red:{cost:IMASHIRU.transformationCost,cap:IMASHIRU.gaugeCap}}}}:{})}),combatants:{...setup.config.combatants,player:{maxHp:entry.hp,initialHp:entry.hp,attacks}},initialBuild:{fixed:createSkill(entry.starter),slots:Array(meta.slots).fill(null) as unknown as PlayerBuild['slots'],power:{3:0,4:0,5:0}}}};}

import {starterFor} from './kits.ts';
import {REWARD_HEAL_PER_RANK} from './profile.ts';
import {IMASHIRU} from '../core/shiny.ts';
import {createTuning} from '../core/tuning.ts';
import {prepareTrialSetup} from '../config.ts';
import {roster} from './roster.ts';
import type {RunMeta} from './profile.ts';
import {createSkill} from '../core/playerBuild.ts';
import type {PlayerBuild} from '../core/types.ts';
/** Snapshot applies only once, at departure. Subsequent stages carry the saved build. */
export type DepartureRoute='standard'|'deep';
/** 日本語: 深層は1階から始まる別ステージ（50階で終了）。English: The deep route is its own stage, floors 1–50. */
export function prepareDeparture(meta:RunMeta,seed:number,route:DepartureRoute='standard'){const current=roster[meta.rosterId];const entry=meta.rosterId==='mint'&&meta.characterRevision!==1?{...current,hp:32,attacks:{3:4,4:7,5:10}}:current;const setup=prepareTrialSetup({character:entry.archetype,firstEnemy:'marujiro',seed,mode:'manual',stage:1,fixture:'normal',route:'boss-loop',...(route==='deep'?{ending:'deep50' as const}:{})});const tree=meta.tree;const base=meta.rosterId==='violet'&&meta.balanceVersion!==2?{3:4,4:7,5:12}:entry.attacks;const attacks={3:base[3]+tree.three,4:base[4]+tree.four,5:base[5]+tree.five*2};return {...setup,config:{...setup.config,meta:structuredClone(meta),tuning:createTuning({...setup.config.tuning,...(meta.characterRevision===1&&['mint','violet'].includes(meta.rosterId)?{gauge:{...setup.config.tuning!.gauge,limits:{...setup.config.tuning!.gauge.limits,red:meta.rosterId==='mint'?{cost:300,cap:300}:{cost:80,cap:150}}}}:{}),rewards:{...setup.config.tuning!.rewards,immediateHeal:setup.config.tuning!.rewards.immediateHeal+(meta.treeVersion===2?(tree.rewardHeal??0)*REWARD_HEAL_PER_RANK:0)},...(meta.rosterId==='imashiru'?{gauge:{...setup.config.tuning!.gauge,limits:{...setup.config.tuning!.gauge.limits,red:{cost:IMASHIRU.transformationCost,cap:IMASHIRU.gaugeCap}}}}:{})}),combatants:{...setup.config.combatants,player:{maxHp:entry.hp,initialHp:entry.hp,attacks}},initialBuild:{fixed:createSkill(starterFor({...setup.config,meta})),slots:Array(meta.slots).fill(null) as unknown as PlayerBuild['slots'],power:{3:0,4:0,5:0}}}};}

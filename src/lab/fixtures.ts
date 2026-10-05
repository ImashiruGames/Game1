import cases from './preparedCases.json' with { type: 'json' };
import { defaultConfig, battleFixtures, createCharacterBattleConfig } from './engine/definitions.ts';
import { createPlayerBuild } from './engine/playerBuild.ts';
import type { BattleConfig, Box, Owner, CharacterId, EnemyId } from './engine/types.ts';
import type { ProposalId } from './model.ts';
export const preparedCases=cases as unknown as readonly {skill:ProposalId;kind:'favorable'|'unfavorable';config:BattleConfig;steps:readonly unknown[]}[];
const box=(row:number,col:number,owner:Owner='player'):Box=>({id:`lab:${row}:${col}`,row,col,owner,type:'normal',status:'normal'});
export const labFixtures: readonly BattleConfig[] = [
{...defaultConfig,id:'open',title:'自由対戦',description:'空の6×8盤面。まず自分の判断で対戦し、同じシードの装備なしと比べる。'},
{...defaultConfig,id:'foundation-on',title:'縁の下：最下行で発動',description:'3列目へ投入。最下行の自箱が3個になり、横3リンクは4→7。',initialBoxes:[box(7,0),box(7,1)]},
{...defaultConfig,id:'foundation-off',title:'縁の下：最下行が他者の箱',description:'3列目へ投入。縦3リンクでも、最下行の自箱は0個。加算なし。',initialBoxes:[box(7,2,'neutral'),box(6,2),box(5,2)]},
{...defaultConfig,id:'ironwall-on',title:'鉄壁：離れた四角で防御',description:'シード1112なら敵は5列目で縦4。左下の四角が攻撃ごとに2軽減。',firstActor:'enemy',seed:1112,initialBoxes:[box(6,0),box(6,1),box(7,0),box(7,1),box(5,4,'enemy'),box(6,4,'enemy'),box(7,4,'enemy')]},
{...defaultConfig,id:'ironwall-off',title:'鉄壁：四角に他者の箱',description:'自箱が1個欠けた四角は対象外。同じ攻撃を防げない。',firstActor:'enemy',seed:1112,initialBoxes:[box(6,0),box(6,1,'neutral'),box(7,0),box(7,1),box(5,4,'enemy'),box(6,4,'enemy'),box(7,4,'enemy')]},
...battleFixtures.filter(f=>['internal-ceilings','cross-attack','health-plus','grow-fire','transformed-health','transformed-red','enemy-attack','blocked-player'].includes(f.id)),
];
/** 日本語: 比較の両側は同じキャラ・空き枠・HP・乱数。実験だけ1枠を予約。
 * English: Paired runs share starters, HP, board and seed; only the experimental slot differs. */
export function fixtureConfig(id:string,character:CharacterId,enemy:EnemyId,seed:number,experiment?:ProposalId):BattleConfig {
 const prepared=preparedCases.find(c=>c.config.id===id);
 if(prepared)return {...prepared.config,seed,...(experiment?{experiment}:{})};
 const base=labFixtures.find(f=>f.id===id)??labFixtures[0]!;
 const configured=createCharacterBattleConfig(character,enemy,{...base,seed,initialBuild:createPlayerBuild(character)});
 return {...configured,combatants:{...configured.combatants,enemy:{...configured.combatants.enemy,initialHp:base.id==='cross-attack'?base.combatants.enemy.initialHp:configured.combatants.enemy.initialHp}},...(experiment?{experiment}:{}),initialTransformation:base.initialTransformation?.character===character?base.initialTransformation:undefined};
}

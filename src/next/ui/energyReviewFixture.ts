import {prepareTrialSetup} from '../config.ts';
import type {Box,BattleConfig} from '../core/types.ts';
import type {BattleControllerOptions} from '../app/BattleController.ts';
export const energyReviewCases=[
 {id:'axes',button:'検証用：4軸の順番リンク',instructions:'3列目へ投入。横・縦・斜め2方向のリンクを1軸ずつ表示します。'},
 {id:'enemy',button:'検証用：敵リンクの着弾',instructions:'開始直後の敵の縦4リンクで、自分のHPと着弾を確認します。'},
 {id:'lethal',button:'検証用：着弾後の50階クリア',instructions:'3列目へ投入。敵HP3を倒す着弾を確認し、リンク演出後に50階クリアへ進みます。'},
 {id:'red',button:'検証用：赤の染色と変化',instructions:'ほむらの火種で敵箱を自箱に染色。変化ボタンで変化中の箱も確認できます。'},
] as const;
export function energyReviewFixture(kind:typeof energyReviewCases[number]['id']):{config:BattleConfig;options:BattleControllerOptions}{
 const item=energyReviewCases.find(item=>item.id===kind);if(!item)throw new Error('Unknown energy review fixture');
 const setup=prepareTrialSetup({encounterVersion:'legacy-v0',character:kind==='red'?'red':'blue',firstEnemy:'marujiro',seed:1,mode:'manual',stage:kind==='lethal'?50:1,fixture:'normal',route:'boss-loop'});
 const box=(row:number,col:number,owner:Box['owner']='player'):Box=>({id:`energy:${row}:${col}`,row,col,owner,type:'normal',status:'normal'});
 const boxes=kind!=='red'?[box(5,0),box(5,1),...[6,7].flatMap(row=>[0,1,2,3,4].map(col=>box(row,col))),box(7,5,'neutral')]:[...Array.from({length:6},(_,col)=>box(7,col,col===5?'neutral':'enemy')),box(6,1),box(6,3),box(6,4,'enemy')];
 return {...setup,config:{...setup.config,id:`energy-review-${kind}`,title:item.button,description:item.instructions,firstActor:kind==='enemy'?'enemy':'player',initialBoxes:kind==='enemy'?boxes.map(b=>({...b,owner:b.owner==='player'?'enemy':b.owner})):boxes,initialGauge:kind==='red'?100:80,combatants:{...setup.config.combatants,player:{...setup.config.combatants.player,maxHp:100,initialHp:100},enemy:{...setup.config.combatants.enemy,maxHp:200,initialHp:kind==='lethal'?3:200}}}};
}

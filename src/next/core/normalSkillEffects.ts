import {tuningOf} from './tuning.ts';
import {ownSquareMembers} from './boxPowerStatus.ts';
import {foundationBonus} from './foundation.ts';
import {activeSkillValue,playerPower} from './playerBuild.ts';
import type {BattleState,Box,Link} from './types.ts';
/** 日本語: 元作の分かりやすい盤面条件を採用。未来の連続回数・追加回復・基礎火力の永続変更は導入しない。
 * English: Adapt original Game1's readable current-board conditions, without future counters, more healing, or persistent base-power mutation.
 * Source: ImashiruGames/Game1@869769deedbc5e7aece8e841d3a1f17639188be6/index.html#L1314-L1439
 */
export function hasOwnSquare(state:Pick<BattleState,'boxes'>):boolean {return ownSquareMembers(state).size>0;}
export function normalLinkBonus(state:BattleState,origin:Box,link:Link,links:readonly Link[]):number {
 const value=(id:Parameters<typeof activeSkillValue>[1])=>activeSkillValue(state,id);
 const adjacent=state.boxes.filter(b=>b.owner==='enemy'&&Math.abs(b.row-origin.row)+Math.abs(b.col-origin.col)===1).length;
 const edge=state.boxes.some(b=>link.boxIds.includes(b.id)&&(b.col===0||b.col===state.config.board.width-1));
 return (state.hp.player.current===state.hp.player.max?value('full-power'):0)
  +foundationBonus(state)+(link.count>=5?value('snake-line'):0)
  +(edge?value('edge-strike'):0)+adjacent*value('siege')
  +(links.filter(l=>l.tier!==null).length>=2?value('crossfire'):0)
  +(tuningOf(state.config).skillRevision!==2&&state.hp.player.current*2<=state.hp.player.max?value('last-stand'):0)
  +trophyLinkBonus(state,origin,link,links);
}
export function normalLinkGuard(state:BattleState):number {return hasOwnSquare(state)?activeSkillValue(state,'iron-wall'):0;}

/** Current insertion geometry only. Bonuses are added before shiny/frozen modifiers; no counters or RNG. */
export function trophyLinkBonus(state:BattleState,origin:Box,link:Link,links:readonly Link[]):number {
 if(link.tier===null)return 0;
 const value=(id:Parameters<typeof activeSkillValue>[1])=>activeSkillValue(state,id);
 const at=new Map(state.boxes.map(b=>[`${b.row}:${b.col}`,b]));
 const own=state.boxes.filter(b=>b.owner==='player');
 const members=new Set(link.boxIds);
 const column=state.boxes.filter(b=>b.col===origin.col);
 const neighbors=[[1,0],[-1,0],[0,1],[0,-1]] as const;
 const pincer=neighbors.some(([dr,dc])=>at.get(`${origin.row+dr}:${origin.col+dc}`)?.owner==='enemy'&&at.get(`${origin.row+2*dr}:${origin.col+2*dc}`)?.owner==='player');
 const adjacentEnemies=neighbors.map(([dr,dc])=>at.get(`${origin.row+dr}:${origin.col+dc}`)).filter(b=>b?.owner==='enemy');
 const square=own.some(b=>{const cells=[b,at.get(`${b.row+1}:${b.col}`),at.get(`${b.row}:${b.col+1}`),at.get(`${b.row+1}:${b.col+1}`)];return cells.every(c=>c?.owner==='player')&&cells.some(c=>c&&members.has(c.id));});
 const diagonals=['diagonal-down','diagonal-up'].every(axis=>links.some(l=>l.axis===axis&&l.tier!==null));
 return (link.count>=5?Math.floor(playerPower(state,5)*value('heavy-swing')/100):0)
  +(column.length>=3&&column.every(b=>b.owner==='player')?value('clear-column'):0)
  +(pincer?value('pincer-strike'):0)
  +(diagonals?value('twin-diagonal'):0)
  +(square?value('square-conduit'):0)
  +(adjacentEnemies.some(b=>b?.type==='poison'||b?.type==='deadly-poison')?value('venom-edge'):0)
  +(adjacentEnemies.some(b=>b?.type==='frozen'||b?.type==='absolute-zero')?value('frost-edge'):0)
  +(link.count===4?value('exact-four'):0)
  +(own.filter(b=>members.has(b.id)&&b.type==='shiny').length>=2?value('shiny-relay'):0);
}

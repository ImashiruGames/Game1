import type { BoardSkillId, CharacterId, NormalSkillId } from '../core/types.ts';
/** 日本語: キャラIDと既存の変化方式を分離。仮キャラは既存方式を明示的に再利用。
 * English: Collection identity is separate from the proven combat archetype. */
export const rosterIds = ['blue','red','mint','amber','violet','silver','rose','imashiru'] as const;
export type RosterId = typeof rosterIds[number];
export interface RosterEntry { id:RosterId;name:string;subtitle:string;color:string;archetype:CharacterId;starter:NormalSkillId;board:BoardSkillId;hp:number;attacks:Record<3|4|5,number>;prototype:boolean }
export const roster:Readonly<Record<RosterId,RosterEntry>> = {
 blue:{id:'blue',name:'青の子',subtitle:'プリズムの賢者',color:'#65c8ed',archetype:'blue',starter:'health',board:'pain-shared',hp:30,attacks:{3:4,4:7,5:11},prototype:false},
 red:{id:'red',name:'赤の子',subtitle:'炎の育て手',color:'#ee777d',archetype:'red',starter:'grow-fire',board:'ember',hp:30,attacks:{3:4,4:7,5:11},prototype:false},
 mint:{id:'mint',name:'ミント',subtitle:'角を読む観測者',color:'#80d6b8',archetype:'red',starter:'corner-strike',board:'mint-observe',hp:32,attacks:{3:4,4:7,5:10},prototype:true},
 amber:{id:'amber',name:'アンバー',subtitle:'四角の造形師',color:'#e9bb68',archetype:'red',starter:'square-strike',board:'amber-convert',hp:28,attacks:{3:6,4:9,5:13},prototype:true},
 violet:{id:'violet',name:'バイオレット',subtitle:'毒を操るアサシン',color:'#b299de',archetype:'red',starter:'poison-craft',board:'violet-poison',hp:28,attacks:{3:1,4:2,5:3},prototype:true},
 silver:{id:'silver',name:'シルバー',subtitle:'最初の盾',color:'#bbcad2',archetype:'red',starter:'first-guard',board:'silver-freeze',hp:34,attacks:{3:3,4:7,5:11},prototype:true},
 rose:{id:'rose',name:'ローズ',subtitle:'横列の剣士',color:'#e2a0ba',archetype:'red',starter:'horizontal-slash',board:'rose-slice',hp:30,attacks:{3:5,4:6,5:10},prototype:true},
 imashiru:{id:'imashiru',name:'イマシルちゃん',subtitle:'ピコーン閃いた！',color:'#b099e5',archetype:'red',starter:'charge',board:'imashiru-insight',hp:30,attacks:{3:4,4:7,5:11},prototype:false},
};
export const isRosterId=(id:unknown):id is RosterId=>typeof id==='string'&&(rosterIds as readonly string[]).includes(id);

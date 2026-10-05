import { freeze } from '../core/immutable.ts';
import { enemyRoster } from '../core/monsters.ts';
import { sampleUniformIndex } from '../core/random.ts';
import type { EnemyId } from '../core/types.ts';
export const CURRENT_ENCOUNTER_VERSION = 'bands-v2' as const;
export type EncounterVersion = 'bands-v1' | typeof CURRENT_ENCOUNTER_VERSION;
export interface EncounterBand { readonly id:string; readonly from:number; readonly to:number; readonly pool:readonly {readonly enemyId:EnemyId;readonly weight:number}[] }
export interface EncounterTable { readonly bands:readonly EncounterBand[];readonly bosses:Readonly<Record<number,EnemyId>> }
/** 日本語: 1–24階は基本攻撃のみ。回復もギミックとして26階以降へ分離。
 * English: Floors 1–24 teach ordinary links; even healing is reserved for the middle band.
 * This version is immutable history. Future changes get a new version rather than rewriting saved runs. */
export const encounterBandsV1:EncounterTable = freeze({
 bands:[
  {id:'basic',from:1,to:24,pool:[{enemyId:'marujiro',weight:3},{enemyId:'hikikizan',weight:2},{enemyId:'merarun',weight:2},{enemyId:'twin-core',weight:3},{enemyId:'needle-core',weight:2}]},
  {id:'gimmick',from:26,to:39,pool:[{enemyId:'nigirin',weight:2},{enemyId:'frost-core',weight:3},{enemyId:'thorn-core',weight:3}]},
  {id:'advanced',from:41,to:49,pool:[{enemyId:'rime-crown',weight:1},{enemyId:'briar-wheel',weight:1}]},
 ], bosses:{25:'speed-core',40:'speed-core',50:'mother-core'},
});
export const encounterBandsV2:EncounterTable=freeze({...encounterBandsV1,bands:encounterBandsV1.bands.map(b=>b.id==='advanced'?{...b,pool:[...b.pool,{enemyId:'devilmon' as const,weight:1},{enemyId:'shashark' as const,weight:1}]}:b)});
export function validateEncounterTable(table:EncounterTable):void {
 const known=(id:EnemyId)=>enemyRoster.includes(id);
 for(const [stage,id] of Object.entries(table.bosses))if(!Number.isSafeInteger(Number(stage))||Number(stage)<1||Number(stage)>50||!known(id))throw new Error('Invalid boss override');
 for(const [stage,id] of [[25,'speed-core'],[40,'speed-core'],[50,'mother-core']] as const)if(table.bosses[stage]!==id)throw new Error('Required boss override missing');
 const ids=new Set<string>();
 for(const band of table.bands){
  if(!band.id||ids.has(band.id))throw new Error('Duplicate encounter band ID');ids.add(band.id);
  if(!Number.isSafeInteger(band.from)||!Number.isSafeInteger(band.to)||band.from<1||band.to>50||band.from>band.to||!band.pool.length)throw new Error('Invalid encounter band');
  const seen=new Set<EnemyId>();let total=0;
  for(const entry of band.pool){if(!known(entry.enemyId)||seen.has(entry.enemyId)||!Number.isSafeInteger(entry.weight)||entry.weight<=0)throw new Error('Invalid encounter weight or enemy ID');seen.add(entry.enemyId);total+=entry.weight;}
  if(!Number.isSafeInteger(total)||total>0x1_0000_0000)throw new Error('Encounter weights overflow');
 }
 for(let stage=1;stage<=50;stage++)if(!table.bosses[stage]&&table.bands.filter(b=>stage>=b.from&&stage<=b.to).length!==1)throw new Error('Encounter bands have a gap or overlap');
}
validateEncounterTable(encounterBandsV1);
validateEncounterTable(encounterBandsV2);
/** Seed-isolated selection: never consume combat/reward RNG. Boss override wins before any draw. */
export function selectEncounter(stage:number,seed:number,version:EncounterVersion=CURRENT_ENCOUNTER_VERSION,table:EncounterTable=version==='bands-v1'?encounterBandsV1:encounterBandsV2):EnemyId {
 if(!Number.isSafeInteger(stage)||stage<1||!Number.isInteger(seed)||seed<0||seed>0xffff_ffff)throw new Error('Invalid encounter seed or stage');
 if(version!=='bands-v1'&&version!==CURRENT_ENCOUNTER_VERSION)throw new Error('Unsupported encounter version');
 const local=(stage-1)%50+1;
 if(table.bosses[local])return table.bosses[local]!;
 const band=table.bands.find(b=>local>=b.from&&local<=b.to);if(!band)throw new Error('Missing encounter band');
 // Avalanche the domain-separated stage key so adjacent seeds/stages do not cluster in one bucket.
 let key=(seed^Math.imul(stage,0x9e3779b9)^0x454e4354)>>>0;
 key=Math.imul(key^(key>>>16),0x85ebca6b);key=Math.imul(key^(key>>>13),0xc2b2ae35);key=(key^(key>>>16))>>>0;
 let ticket=sampleUniformIndex(key,band.pool.reduce((n,e)=>n+e.weight,0)).index;
 for(const entry of band.pool){if(ticket<entry.weight)return entry.enemyId;ticket-=entry.weight;}
 throw new Error('Invalid encounter pool');
}

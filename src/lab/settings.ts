import { proposalIds } from './model.ts';
import type { ProposalId } from './model.ts';
import type { BattleConfig, CharacterId, EnemyId } from './engine/types.ts';
export interface SetupFields { readonly skill:string; readonly fixture:string; readonly character:string; readonly enemy:string; readonly seed:string }
export interface ParsedSetup { readonly selected:ProposalId|'none';readonly fixture:string;readonly character:CharacterId;readonly enemy:EnemyId;readonly seed:number }
/** 日本語: 再開始ボタンで入力欄の値をまとめて読む。blur/changeイベントに依存しない。
 * English: Explicit restart commits the actual fields atomically, independent of blur/change delivery. */
export function parseSetupFields(fields:SetupFields,fallbackEnemy:EnemyId='marujiro'):ParsedSetup|null {
 const seed=Number(fields.seed);
 if(!fields.seed.trim()||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)return null;
 if(fields.skill!=='none'&&!proposalIds.includes(fields.skill as ProposalId))return null;
 if(!['blue','red'].includes(fields.character))return null;
 const enemy=fields.enemy==='fixture'?fallbackEnemy:fields.enemy;
 if(!['marujiro','hikikizan','nigirin','merarun'].includes(enemy))return null;
 return{selected:fields.skill as ProposalId|'none',fixture:fields.fixture,character:fields.character as CharacterId,enemy:enemy as EnemyId,seed};
}
/** 日本語: 比較は進行中の盤面でも未適用の設定欄でもなく、同じ試行の初期設定から。
 * English: A paired reset changes only the experiment on the committed trial's original config. */
export function pairedConfig(initial:BattleConfig,skill?:ProposalId):BattleConfig {
 const {experiment: _previous,...base}=initial;
 return skill?{...base,experiment:skill}:base;
}

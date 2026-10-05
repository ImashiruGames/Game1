import {roster} from '../meta/roster.ts';
import type {RosterId} from '../meta/roster.ts';
import type {BattleConfig} from '../core/types.ts';
/** 日本語: 旧キットの効果IDと、立ち絵・発動者の名前は別。English: Keep the saved mechanic, name its actual caster. */
export function transformationIdentity(config:Pick<BattleConfig,'meta'|'characterId'>,effect:RosterId){const id=config.meta?.rosterId??config.characterId??effect,name=roster[id].name;return {id,name,formName:id==='imashiru'?'ピコーン閃いた！':`${name}の変化${id!==effect?'（旧キット）':''}`};}

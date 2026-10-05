import {META,characterDrawPool} from './profile.ts';
import type {Profile} from './profile.ts';
/** Display and draw share the same current candidate pool. Rates describe the NEXT draw. */
export function percentLabel(value:number):string{const rounded=Math.round(value*100)/100;return `${Math.abs(rounded-value)>1e-9?'約':''}${rounded}%`;}
export function characterGachaOdds(p:Pick<Profile,'ownedCharacters'>){
 const candidates=characterDrawPool(p),missingCount=candidates.filter(id=>!p.ownedCharacters.includes(id)).length,each=META.characterRate/candidates.length;
 const summary=missingCount?`キャラクター${META.characterRate}%：未所持の${missingCount}人から均等に抽選（全体で各${percentLabel(each)}）。未所持がいる間、所持済みキャラは出ません。`:`キャラクター${META.characterRate}%：全${candidates.length}人から均等に抽選（全体で各${percentLabel(each)}）。重複は経験値エナジー${META.duplicateCharacterEnergy}個に交換。`;
 return {candidates,missingCount,eachOverallPercent:each,summary};
}

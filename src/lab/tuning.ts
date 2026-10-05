/** 日本語: 各提案の仮数値。採用済み通常版のtuningとは独立。
 * English: Provisional proposal values are typed and independent of release tuning. */
export interface ExperimentTuning {
 readonly foundationCap:number; readonly ironwallReduction:number; readonly exactThreeBonus:number; readonly focusBonus:number;
 readonly minimumLinkDamage:number; readonly executeBonus:number; readonly lowerHpBonus:number; readonly fullHpBonus:number;
 readonly bloodCost:number; readonly bloodBonus:number; readonly singleLinkNumerator:number; readonly singleLinkDenominator:number;
 readonly incomingCap:number; readonly fractionalReductionDivisor:number; readonly emptySlotCap:number;
 readonly lifestealDivisor:number; readonly lifestealOriginCap:number; readonly mutualHealBonus:number; readonly mutualEnemyHeal:number;
 readonly criticalOutOf:number; readonly criticalMultiplier:number; readonly meditationHeal:number; readonly meditationCooldown:number;
 readonly endDamage:number; readonly thornDamage:number; readonly healRebuttalDivisor:number;
}
export const defaultExperimentTuning:ExperimentTuning=Object.freeze({foundationCap:3,ironwallReduction:2,exactThreeBonus:3,focusBonus:5,minimumLinkDamage:5,executeBonus:4,lowerHpBonus:3,fullHpBonus:5,bloodCost:2,bloodBonus:3,singleLinkNumerator:3,singleLinkDenominator:2,incomingCap:6,fractionalReductionDivisor:4,emptySlotCap:2,lifestealDivisor:4,lifestealOriginCap:3,mutualHealBonus:4,mutualEnemyHeal:2,criticalOutOf:4,criticalMultiplier:2,meditationHeal:6,meditationCooldown:3,endDamage:2,thornDamage:2,healRebuttalDivisor:2});
export function validateExperimentTuning(tuning:ExperimentTuning):void{for(const key of Object.keys(defaultExperimentTuning) as (keyof ExperimentTuning)[]){const n=tuning[key];if(!Number.isSafeInteger(n)||n<0)throw new Error(`Invalid experiment tuning: ${key}`);}for(const key of ['singleLinkDenominator','fractionalReductionDivisor','lifestealDivisor','criticalOutOf','healRebuttalDivisor'] as const)if(tuning[key]<1)throw new Error(`Experiment divisor must be positive: ${key}`);}

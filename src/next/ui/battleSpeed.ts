import type {BattlePace} from './animationTimeline.ts';
export interface BattleSpeedControls {select:HTMLSelectElement;note:HTMLElement;}
/** 日本語: 速度と光・揺れの低減は独立。端末の低減設定も維持する。
 * English: Pacing and visual motion reduction are independent preferences. */
export function battleSpeedView(speed:BattlePace,lowMotion:boolean,system:boolean):{label:string;note:string;description:string}{
 const label={slow:'遅',medium:'中',fast:'速'}[speed];
 const source=system?'端末の動き低減':lowMotion?'光・揺れの低減':'';
 return {label,note:source?'動き低減':'',description:`戦闘速度：${label}。${source?`${source}を適用中。速度は変わりません。`:''}遅・中・速から選択できます。変更は次の行動から反映します。`};
}
export function renderBattleSpeed(controls:BattleSpeedControls,speed:BattlePace,lowMotion:boolean,system:boolean):void{
 const view=battleSpeedView(speed,lowMotion,system);controls.select.value=speed;controls.select.title=view.description;controls.select.setAttribute('aria-label',view.description);controls.note.textContent=view.note;controls.note.hidden=!view.note;
}

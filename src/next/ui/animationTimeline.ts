/** 日本語: 行動開始時に一度だけ確定し、待機・描画・CSSへ同じ時間を渡す。
 * English: One immutable action timeline owns waits, effects and CSS durations. */
export type BattlePace='slow'|'medium'|'fast';
export function resolveBattlePace(motion:{readonly speed?:BattlePace;readonly short:boolean}):BattlePace{return motion.speed??(motion.short?'fast':'medium');}
export function paceScale(motion:{readonly speed?:BattlePace;readonly short:boolean}):number{return resolveBattlePace(motion)==='slow'?1.5:1;}
export interface AnimationMotion {readonly speed?:BattlePace;readonly short:boolean;readonly lowMotion:boolean;readonly timeline?:AnimationTimeline}
export interface AnimationTimeline {
 readonly short:boolean;readonly drop:number;readonly attack:Readonly<{lead:number;hold:number}>;
 readonly feedback:Readonly<{lead:number;hold:number}>;readonly material:number;
 readonly skill:Readonly<{name:number;effect:number}>;
 readonly portrait:Readonly<{attack:number;hit:number;mark:number}>;
}
export function animationTimeline(motion:AnimationMotion,drop=180,shortDrop=15):AnimationTimeline {
 const short=resolveBattlePace(motion)==='fast',scale=paceScale(motion);
 const ms=(n:number)=>Math.round(n*scale);
 return Object.freeze({short,drop:short?shortDrop:ms(drop),attack:Object.freeze(short?{lead:0,hold:150}:{lead:ms(300),hold:ms(300)}),
 feedback:Object.freeze(short?{lead:0,hold:150}:{lead:ms(100),hold:ms(500)}),material:short?0:ms(drop),
 skill:Object.freeze(short?{name:240,effect:240}:{name:ms(760),effect:ms(420)}),
 portrait:Object.freeze(short?{attack:0,hit:0,mark:120}:{attack:ms(160),hit:ms(200),mark:ms(240)})});
}
export function captureAnimationMotion(motion:AnimationMotion,drop=180,shortDrop=15):AnimationMotion {
 return Object.freeze({speed:resolveBattlePace(motion),short:resolveBattlePace(motion)==='fast',lowMotion:motion.lowMotion,timeline:animationTimeline(motion,drop,shortDrop)});
}

import {LEGACY_KIT_BALANCE} from './kitBalance.ts';
import type {BoardSkillId,BattleConfig,NormalSkillId} from '../core/types.ts';
import type {RosterId} from './roster.ts';
/** 日本語: キット第2版。盤面の選択肢は別の版で新規出発だけ更新する。
 * English: Kit v2 stays stable; the separately versioned board catalog changes new departures only. */
export const KIT_VERSION=2 as const;
export const LEGACY_STARTERS:Record<RosterId,NormalSkillId>={blue:'health',red:'grow-fire',mint:'corner-strike',amber:'square-strike',violet:'diagonal-shot',silver:'first-guard',rose:'horizontal-slash',imashiru:'charge'};
export const LEGACY_BOARDS:Record<RosterId,BoardSkillId>={blue:'pain-shared',red:'ember',mint:'pain-shared',amber:'ember',violet:'pain-shared',silver:'pain-shared',rose:'ember',imashiru:'imashiru-insight'};
export const NATIVE_BOARDS:Record<RosterId,BoardSkillId>={...LEGACY_BOARDS,mint:'mint-observe',amber:'amber-convert',violet:'violet-poison',silver:'silver-freeze',rose:'rose-slice'};
export const EXTRA_BOARDS:Partial<Record<RosterId,BoardSkillId>>={blue:'blue-freeze',red:'red-capture',imashiru:'imashiru-focus'};
/** 日本語: 他キャラの固有盤面技を貸さず、各役割に固有の二択を追加する。
 * English: Each character earns two unique choices without borrowing another signature board. */
export const BOARD_CATALOG_VERSION=2 as const;
export const UNLOCK_BOARDS:Readonly<Record<RosterId,readonly [BoardSkillId,BoardSkillId]>>={
 blue:['blue-crosscut','blue-plumb'],red:['red-frontline','red-brand'],
 mint:['mint-diagonal','mint-frame'],amber:['amber-squarepress','amber-rubble'],
 violet:['violet-venom','violet-sting'],silver:['silver-frostbind','silver-thornwall'],
 rose:['rose-longcut','rose-twincut'],imashiru:['imashiru-polish','imashiru-reset'],
};
export function characterBoardChoices(id:RosterId,unlocked:boolean):BoardSkillId[]{return [NATIVE_BOARDS[id],...(unlocked?[...(EXTRA_BOARDS[id]?[EXTRA_BOARDS[id]!]:[]),...UNLOCK_BOARDS[id]]:[])];}
/** 日本語: 読込専用の旧選択肢。新しい出発・選択画面からは呼ばない。
 * English: Read-only compatibility catalog; never offer it for a new departure. */
export function legacyBoardChoices(id:RosterId,unlocked:boolean,newKit=true):BoardSkillId[]{return [...new Set<BoardSkillId>([LEGACY_BOARDS[id],...(newKit?[NATIVE_BOARDS[id]]:[]),...(unlocked?['pain-shared','ember',...(newKit&&EXTRA_BOARDS[id]?[EXTRA_BOARDS[id]!]:[])] as BoardSkillId[]:[])])];}

export const KIT={mintShapeBonus:LEGACY_KIT_BALANCE.mintShapeBonus,roseHorizontalBonus:LEGACY_KIT_BALANCE.roseHorizontalBonus,silverBarrier:LEGACY_KIT_BALANCE.silverBarrier,violetPoisonTargets:LEGACY_KIT_BALANCE.violetPoisonTargets,prototypeCost:100,prototypeCap:150} as const;
export function starterFor(config:BattleConfig):NormalSkillId {const id=config.meta?.rosterId;if(!id)return config.characterId==='blue'?'health':'grow-fire';return config.meta?.kitVersion===2&&id==='violet'?'poison-craft':LEGACY_STARTERS[id];}
export function hasNewKit(config:BattleConfig):boolean{return config.meta?.kitVersion===KIT_VERSION;}
export const KIT_ROLES:Record<RosterId,string>={blue:'テクニカル',red:'フィジカル',mint:'テクニカル',amber:'フィジカル・パワー',violet:'アサシン',silver:'フィジカル・ガード',rose:'テクニカル',imashiru:'閃き・タイプ操作'};
export const KIT_FORM_TEXT:Record<RosterId,string>={blue:'この戦闘中、回復予定量と同じ連動ダメージ。',red:'次の自手番開始に追加投入・2回。',mint:'全点観測：この戦闘中、角打ちのダメージ＋3。',amber:'力の解放：この自手番、リンクダメージ×2。ゲージ100・上限150。形・毒・直接攻撃・回復は変わりません。保存済みランは出発時のルールを維持します。',violet:'毒の雨：上・左から最大2個の敵箱をもうどくに。毒盛り術は現在の自箱2×2の数を毎回参照。',silver:'鋼の守り：バリアを12に。敵のリンク・固定攻撃のみ軽減し、この戦闘中だけ持続。毒・トゲ・自己コスト・投入不能は防ぎません。',rose:'横一閃：この自手番、横リンクのダメージ＋12。',imashiru:'ピコーン閃いた！（ゲージ200）：自箱すべてを即時に輝きへ。この自手番の投入も輝き。箱のタイプは手番後も残ります。'};

# Interaction design draft / 操作設計の下書き

## User criticism and intent / 指摘と意図
- JP: ガチャは説明だけでなく、ハンドル、混ざるカプセル、排出口、結果の順で期待感を出す。残高と抽選は先に一括保存し、閉じる・中断・連打で再抽選しない。
- EN: Make draws feel like a physical capsule machine: crank, mixing chamber, chute, reveal. Persist wallet and outcome first. Closing, interruption, and repeated taps must never reroll.
- JP: ラン開始は即時出発しない。実際に開始する構成のHP、火力、固定スキル、空き枠、盤面スキル、変化、報酬候補を確認してから開始する。
- EN: Starting a run requires a review of the actual frozen departure snapshot: HP, power, fixed skill, free slots, board skill, transformation, and reward pool. Cancel changes no gameplay state.
- JP: 説明文の常設を減らし、詳しいルールは必要なときだけ開く。通常スキルと残回数は戦闘画面に表示し、使い切りスキルは直接予告・確定へ進める。
- EN: Remove persistent explanatory prose; keep detailed rules on demand. Equipped skills and remaining charges belong on the battle screen, with consumable preview/confirmation directly accessible.
- JP: 6×8と画面上端を前提にしない。投入候補の実際の辺と各縦区間に操作を結び付ける。内部天井も同じ扱い。現行の下向き重力規則を勝手に増やさない。
- EN: Never assume 6×8 or the screen's top boundary. Anchor controls to each actual engine edge and vertical segment, including internal ceilings. Keep the current downward-gravity rules.
- JP: キャラ固有盤面スキルを別キャラに配らず、各キャラの役割に合う独自の解放先を用意。新規通常スキルは保存互換と発動タイミングを検証する。
- EN: Character trees should unlock their own alternatives, rather than borrow other characters' signature board skills. Validate new normal skills against save compatibility and timing contracts.

## Verification boundary / 検証範囲
Source, engine, controller, isolated DOM, strict TypeScript, and production bundle checks are recorded in the release note. Existing live play is never forcibly reloaded. Desktop/mobile browser visuals, actual touch devices, and audio are not claimed unless separately observed.

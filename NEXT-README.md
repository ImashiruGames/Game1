> 現在の入口は `/next/` です。`/` は `/next/` への案内専用になりました。旧1.0画面は別保管済みのため撤去し、共有画像と旧ルールの互換性検証コード・fixture・元manifestは保持しています。整理範囲と復元方法は `docs/root-retirement.md` を参照してください。以下の旧版説明は履歴資料です。

# Game1 1.2 trial: save, clear50, battle feedback

Playable entry: `/next/`. This is a separate trial, not adoption of the 25 skill proposals.
Root version 1.0 and `/lab/` retain their original source. Their byte manifest and frozen traces are unchanged.
The trial core/app began as an isolated copy of release source at commit 718a35c991a9c7586b7d20cc5f204d4c62c8a8f0. This boundary keeps earlier evaluation reproducible; do not automatically port future changes between engines.

## Current rules

- Victories through stage49 first require committing one category: immediate recovery, stats, or skills. The category cannot be changed. The recovery category immediately heals 10, capped at maximum HP, and advances.
- Stats draw 3 different entries from maximum/current HP +5, 3-link power +1, 4-link power +2, and 5+-link power +3. They last for this run and use no equipment slot.
- Skills draw up to 3 different eligible entries from the existing 10 formal skills. Owned plus skills are excluded. Health is now an intrinsic normal skill: only a character whose immutable starter is Health can receive its plus upgrade; other characters cannot acquire it. Grow Fire remains shared. Fixed starter, two flexible slots, duplicate upgrades, consumable uses, and explicit replacement are preserved.
- A committed stats/skills reward may be declined, preserving the prior skip option. There is no skip before category selection. Declining ends that reward and cannot open another category.
- Category selection draws once; redraw, replacement cancellation, repeated taps, and stale messages cannot reroll it. Rewards use a separate RNG stream from combat.
- Recovery and max-HP rewards are run transitions, outside battle healing reactions. Blue cannot reflect them into the defeated or next enemy. Increased current/max HP carries to later fights; a new run restores initial values.
- Manual transformation is available only while the player can select an ordinary action, both combatants live, no transformation active, and enough gauge available. It spends one gauge cost and no ordinary action, RNG, or end-turn charge.
- Blue lasts for this battle. Red adds an active insertion at the next two own-turn starts, never immediately on manual activation. Bonus insertion and ordinary action retain their existing independent timing and victory boundaries.
- Manual charging per qualifying axis: exactly 3 → 2, exactly 4 → 4, exactly 5 → 6, 6 or more → fixed 30. Normal own-turn end +1 and actual HP loss ×1 remain. Costs/caps stay Blue 80/120, Red 100/150. Extra charge skills add their existing amounts.
- The old automatic function remains available. The settings comparison uses automatic 6+-link gating and original per-box charging; the new category rewards remain in that comparison.

## Configuration and checks

`src/next/config.ts` injects trial values; `core/tuning.ts` validates numerical overrides. `BattleConfig.strategy` selects activation and charging methods. Missing strategy retains legacy behavior. `app/rewards.ts` owns typed category/offer transitions; no UI RNG.

`tests/next-rules.test.ts` covers category locking, deterministic offers, HP/stat carry, replacement rejection, separate RNG, manual-action legality and input locks, Red start/carry timing, legacy traces, and the pending-category skip regression. Run `npm run check` for all original, lab, and new checks.

## 2026-10-02 correction and recovery design policy

This correction applies to `/next/` only. The version1.0 documents, root game, and 25-skill lab are historical comparisons. The current HTML/JSON content catalog is `/docs/game1_content_catalog_next.html` and `.json`; both carry revision `1.2` and are generated from the next skill metadata and tuning with `scripts/build-next-catalog.mts`.

ヘルスは固有通常スキル。初期固定枠に持つキャラクター（現在は青の子）だけ、通常報酬に＋強化用として出る。赤など非初期所持者には提示・新規取得・後付け所持からの強化を許可しない。15/20回復、青の名目回復量による連動攻撃、能動投入ごとの既存発動条件は変更しない。戦闘内回数上限は採用していない。成長する火も初期固定スキルだが、今回その共有報酬資格は変更していない。中ボス撃破やショップによる特別強化は将来案であり、実装済み仕様ではない。

今後の回復スキルは厳しく評価し、連戦の消耗を容易に帳消しにする量・頻度・組み合わせを避ける。単体回復量だけでなく、行動コスト、自傷コストの相殺、追加投入による発動増加、青の名目回復反射、入手性・装備枠の機会費用を検証する。実回復と上限で失われた回復、発動回数、敵からの実HP損失を分けて記録し、通常戦と長期戦・ボス・周回を比較する。現行の回復報酬10と最大/現在HP+5は維持する。この方針は回復の一律禁止や未承認の回数制限を意味しない。

`core/skillCatalog.ts` declares reward access; `canReceiveSkillReward` is shared by drawing, acquisition, and controller acceptance. A copied flexible-slot skill is not evidence of starter eligibility. Short or empty candidate pools are committed without duplicates or rerolls; skipping the already selected category remains possible.

The trial UI uses a viewport-height CSS Grid, board target previews plus explicit confirmation (a second tap on the same column also confirms), and details only on request. Default 6×8 desktop and narrow viewport checks do not establish actual iOS Safari behavior. Optional settings expose a normal run, charged-gauge fixture, and reward-ready fixture (third column wins), with seed and character selection.

Values are provisional, not established balance or evidence of human enjoyment. Boss trial additions are described below. All loop values are provisional and adjustable.


## Bosses and the 50-stage finish

The standard trial ends after a surviving victory at stage50, with no final build reward or stage51. The existing simple enemy cycle remains selectable for tests. The normal cycle is indexed by stage1–50, with Speed Core at25 and40 and Mother Core at50. The old endless strategy and later-loop formulas remain callable for regression comparisons with explicit `ending: legacy-endless`; they are not exposed as the standard UI run.

- Speed Core (スピードコア): base HP50 and link attacks6/7/9. On every fifth own turn, fixed3 damage resolves before one insertion; other turns have one insertion.
- Mother Core (マザーコア): base HP150 and link attacks5/8/12. Its seven-turn normal loop is insertion ×4 turns, wait ×1 turn, two insertions ×2 turns. At HP at or below20%, the next own turn starts a two-turn cycle from fixed5 damage then insertion, followed by one insertion. The low-HP phase does not repeatedly reset. Threshold comparison uses the HP ratio without rounding.
- First-loop maximum HP is baseHP +10×(localStage−1): Speed290 at25,440 at40, Mother640 at50. This is distinct from the base HP records.
- Retained legacy endless only: for loopIndex=floor((absoluteStage−1)/50), maximumHP=firstLoopMaximumHP×(1+2×loopIndex); each link tier adds2×loopIndex; fixed damage adds1×loopIndex. There is no additional absolute-stage HP growth. Stage51 Marujiro is180HP and4/6/8 attacks. Speed at75 is870HP,8/9/11 attacks, fixed4. Mother at100 is1920HP,7/10/14 attacks, fixed6.

Every ordered sequence consumes exactly one enemy own turn. Each insertion uses the updated board, runs its normal complete axis-attack sequence, and settles before the next sub-action. A KO stops later sub-actions and RNG draws. A scheduled insertion with no legal entry uses the existing lethal fallback; a wait remains a wait. Fixed damage bypasses the first-link guard and charges gauge from actual HP lost. First-guard applies once across the entire multi-insertion enemy turn, not once per insertion. PvE simultaneous KO remains a loss.

Provided boss PNGs are included unchanged; their bright green backgrounds remain. No background-removal edit is claimed.

Setup exposes an initial stage and distinct test seeds for Speed's fifth turn, Mother's waiting turn, two-drop turn, and initial critical phase. These start a new test run, not a mid-battle skip or stat editor. Next-stage construction clears those test turn counters and phase state. The reward-ready fixture can test stage50→clear with one drop. Its result explicitly identifies a test starting at50; it does not claim a complete 1–50 run. The legacy test suite explicitly selects endless when testing50→51. `tests/next-bosses.test.ts` covers first and later loops, phase transitions, KO/blocked/wait boundaries, shared guard, origin geometry, stage/reward carry, and reset.


## Local autosave (1.2)

This feature is for new runs using1.2. It does not retrofit a save into an already-open1.1.1 game. Production and the isolated `/save-preview/` QA route use different save and ownership keys.

The same browser/origin stores one versioned localStorage save. There is no account, cloud upload, or cross-device synchronization. Pre-save pages cannot be recovered retroactively.

- The complete battle state and original run configuration are persisted, including combat/reward RNG, selected reward category/candidates, permanent build, stage-local Grow, exact HP/maxHP, Red start markers and remaining starts, Mother phase clock, Speed own-turn clock, and route origin.
- Ordinary writes happen only at a complete automatic-sequence boundary. Presentation/intermediate displayed snapshots are never saved. A terminated tab during resolution returns to its prior complete checkpoint.
- Category choice is saved before candidates are exposed. Reward choice is a write-ahead intent with the untouched pre-effect snapshot. Recovery completes that choice once and replaces it with a completed checkpoint; failure retries retain the intended choice and never apply healing twice to the in-memory result.
- Selected drop/row/skill previews, replacement selection, dialogs and highlights are not restored. A replacement cancel keeps the already committed offer.
- An exclusive same-origin Web Lock prevents a second tab from playing over this save. There is no lease stealing or unsafe fallback. The previous raw value is checked before every action/write as a second conflict barrier.
- Save read/write/quota/corruption/version/conflict errors are visible and stop play. The old record is not silently erased. Starting a new run asks before replacing it. Failed new setup leaves the existing saved record intact.
- Pagehide aborts controller work before releasing ownership. BFCache pageshow reacquires, rereads and rebuilds the controller before Continue, without replaying presentation callbacks.
- JSON intentionally omits undefined optional properties; gameplay values and subsequent deterministic state/events are preserved. The checksum detects accidental corruption and is not anti-cheat authentication.

Validation: `tests/next-autosave.test.ts` exercises boundary replay, category lock, pending-reward interruption, save-failure retries, corruption, ownership cancellation, Red carry and boss/loop state. `tests/next-clear-feedback.test.ts` checks terminal saves, no final reward, simultaneous KO, result facts and event/geometry presentation. Browser QA coverage is recorded separately; a browser Back that reloads is not evidence of a real BFCache restoration. Simulated write failure is not a measured storage-capacity limit.


## Save compatibility and results

Format `game1-next-save`, schema1, rules `next-1.2-clear50-intrinsic-health`. Earlier preview-rule saves fail visibly and remain stored until the user confirms replacement; they are not silently migrated from endless to clear50. The checkpoint includes the finish limit, and rejects final-stage rewards or stages beyond that limit. A clear result restores as a terminal result, with no additional enemy turn, reward or stage. Simultaneous enemy/player KO remains a loss.

The result screen uses recorded stage, defeated count, final HP/build and initial seed. It never treats stage-local turn or growth counters as lifetime statistics. Starting from a fixture is explicitly labeled.

## Battle feedback

Committed attack/heal/cost events drive red damage and green actual-healing labels on the board. Primary axes highlight and resolve one at a time; skills use the event's actual shape box IDs. Blue nominal-heal reflection is a separate damage event and label, including when actual healing was zero. Ember self-cost and row-clear damage identify their source. Feedback stays within the board area; reduced-motion mode shortens it. Rendering never recalculates an effect, consumes RNG, or becomes a checkpoint. Reload/resume restores the stable state without replaying animations.

The damage formulas, Grow behavior, shape base values, unlimited eligible Health activations and the clear-arm/reinsert tactic are unchanged in this phase. Future scaling proposals are separate.

## Energy containers (1.2.38)

The approved `/box-design-preview/` SVG artwork now renders real `/next/` boxes: Blue prism and Red flame with round player cores and smooth shells, angular diamond enemy cores, and stationary square neutral cores. Opponents retain subtle individual color themes; transformed player boxes brighten their inner rim. Cell ownership labels remain accessible, while normal P/E/N glyphs are removed. Existing carry/recent-drop markers, shape highlights, row projection, fullbody portraits, cutins, rewards and stage flows remain.

`ui/energyBox.ts` is a presentation-only shared renderer for the stable board, committed drop overlay and conversion dye. `ui/energyLinks.ts` accepts only a committed attack's exact current-origin axis. Its single overlay uses the existing100ms lead /500ms hold (150ms static in reduced mode), clears between axes, and never detects passive links or produces combat actions. Drop timing remains180ms/15ms. Conversion follows emitted IDs and current settled positions; row removal and its passive fall do not gain attacks. No gameplay, RNG, save schema or sound assets changed.

`/energy-qa/` is the same current game bundle with separate save/lock/presentation settings. Explicit fixtures cover four axes and Red conversion; existing shape/row fixtures are available only there or other QA routes. `/energy-qa/viewport.html` provides390×600,320×568 and390×844 CSS viewport checks, not physical iOS validation. Normal `/next/` saves must never be overwritten for QA.

Validation includes the original754 tests plus energy rendering/event/lifecycle tests and a SHA256 manifest frozen from Site79 for combat, rules, RNG, checkpoints, progression and audio implementation. OS/UI reduced motion, interruption, repeated axes, stale timeout/abort, unavailable animation support and passive settling are covered. Physical iOS Safari, audible playback and actual-device performance require separate validation.

## Projectile / HP synchronization (1.2.39)

The previous link overlay launched its particles at100ms, exactly when the HUD had already taken damage; arrival was530–560ms. Each attack axis now has one shared300ms impact boundary. Lines build during0–80ms, particles launch at100–130ms with different flight durations so every particle reaches its target at300ms. The animator removes that event's flight, changes the displayed HP number/bar, reports the attack and starts hit feedback in the same task. An event identity guard prevents stale impact callbacks from touching a newer axis. The impact feedback lasts300ms, preserving the previous600ms total per axis. Drop, shape, healing, reflection, self-cost and reduced-motion timing are unchanged. Sound selection/assets/onset and the authoritative core, RNG, save format, action/result sequence are unchanged.

The isolated `/energy-qa/` route additionally exposes enemy-link and lethal stage50 fixtures. Its expandable read-only timing log samples rendered DOM/particle rectangles via MutationObserver and animation frames; it neither reads nor changes gameplay or storage. The normal game has no diagnostic observer. Completed saved states restore directly without replay. In-flight page exit retains the existing last-complete-checkpoint semantics; this change does not add mid-sequence saves.

## 1.3 — character home, permanent growth and original boss music

The home is the new entry to `/next/`: character preview/selection, EXP tree, individual board-skill settings, reward-pool editor, coin gacha, trophies, backup, and safe Continue. Selecting a different character or a pool/board card uses a second activation on that same card to confirm. Existing active runs retain their frozen character/build and saved offer. Starting another run requires an explicit replacement confirmation. Original root and `/lab/` sources are unchanged.

### Persistence and economy

Growth is browser/origin-local, separate from the unchanged `game1.next.autosave.v1` run record. It is not account/cloud/cross-device storage. Profile creation grants Blue/Red and six shared skill identities once. Each character has XP, a saved free-respec tree, a selected board skill and a 6–20 distinct, owned, eligible skill reward pool. There are currently ten formal skill identities, nine shared plus Blue-only intrinsic Health; 20 is a future cap. Pool membership is independent from equipped slots. New skills are not automatically added to an existing pool. Health can never be acquired/equipped by Red, Imashiru or the five provisional characters.

`meta/profile.ts` centralizes provisional numbers: level1 has2 talent points, then2 per level; level-up requirements40,60,80… EXP, cap30. Tree ranks: 3-link+1 up to5, 4-link+1 up to5, 5+-link+2 up to5 (1pt/rank); +1 normal flexible slot up to4 total (3pt/rank); alternate existing board skills unlock (3pt). No extra healing talent was added. Profile edits cannot change the active run: identity, level, tree, chosen board skill, slot capacity and reward pool are copied into its initial config and validated at restore.

Only an explicit normal stage1 production departure receives an eligibility snapshot and a launch record keyed by the controller's runId. All fixtures, custom starts and QA routes are ineligible. A terminal checkpoint is saved first, then one profile write commits XP+coins+trophies+its runId receipt. Reload/retry sees the same receipt. A shared Web Lock, exact previous bytes and uncertain-success reconciliation guard both stores. Home/replacement reconcile pending terminal settlement before a new checkpoint may overwrite it. Failed pre-swap launch recovery rereads storage rather than asking the old controller to retry an unrelated checkpoint.

Provisional earnings: each defeated enemy gives10 character EXP and5 coins; a verified stage50 clear adds250 EXP and200 coins. A floor4 defeat with3 wins gives30 EXP/15 coins. Complete50 gives750 EXP/450 coins. Abandoned runs, QA and old unverified runs receive no growth rewards. First50-clear and each-character50-clear trophies are idempotent. Historical saves lack the new production proof, so the UI explains that rewards/trophies are not retroactive rather than inventing history.

The existing schema1/rules decoder remains. Legacy active runs keep their old two slots and legacy eligible skill pool, with already committed candidates/RNG unchanged. Their raw save is backed up before first profile-era use; replacing any run retains one prior raw run. Corrupt/unsupported runs stay untouched until explicit backup-and-restart confirmation. Malformed profiles/maps are rejected. Growth JSON export/import is user-initiated; import validates before writing, blocks while a run is active, asks confirmation, and keeps one previous profile. It does not include or claim to restore the separate in-progress battle.

### Gacha and roster

No paid currency, checkout or subscriptions. One draw costs100 earned coins. Fixed category rates: characters20% (six gacha characters equally weighted), shared skills40% (nine equally weighted), two50-EXP energy items40%. Character duplicates become3 energy; skill duplicates return20 coins. No pity system. One atomic profile value saves debit, result, ownership, RNG, sequence and pending-result state. The result must be acknowledged before another draw; closing/reloading cannot reroll or bypass that state. Energy can be spent on any owned selected character.

The roster has eight entries. Blue/Red retain their rules. Imashiru uses the supplied JPEG unchanged (waist-up illustration, no separate transformed artwork claimed). Mint/Amber/Violet/Silver/Rose are explicitly provisional playable starter/stat variants reusing the existing Red transformation behavior and an existing portrait as a visual placeholder. They are not represented as five finished distinctive kits. Roster identity is separate from the reusable combat/audio archetype; Imashiru overrides transformation and gauge rules explicitly.

### Imashiru and single box types

One box has exactly one enum `type`, independent of its owner; assignment overwrites the previous type. Imashiru's “いま、知りたい！” spends30 gauge and one ordinary action to mark the next successful own active insertion shiny. Illegal actions do not spend it; duplicate pending reservations are unavailable; enemy drops do not consume it. The flag survives checkpoints and stage carry.

“ピコーン閃いた！” needs200 gauge (cap300). It spends no ordinary action, immediately overwrites every own box to shiny, and gives own insertions the shiny type through the end of the activation own turn. Existing shiny boxes retain their type afterward. Conversion itself performs no passive link/shape/heal and uses no RNG. Her fixed starter is provisionally Charge, not Health.

Latest confirmed shiny rule: a participating shiny box doubles link/shape damage, shape healing and that link's gauge gain once. Several shiny boxes do not stack. Unrelated shiny boxes, potions, normal turn charge and damage-based charge are not separately multiplied. Frozen subtracts1 damage per participating frozen box from a link, after shiny doubling, minimum0; it does not reduce shape damage or gauge. Poison and deadly poison cost the owner1 or2 HP per owned box at that owner's full turn end, once even for multi-insertion turns. Neutral boxes have no owner to damage. These HP losses charge player gauge only for actual lost HP and bypass the first-link guard. Simultaneous KO remains defeat.

Rubble follows the existing definition: two directly stacked boxes above crush it. Processing is after active skill/link attacks and passive settlement; collapse repeats until stable and may remove several rubble boxes. These falls do not trigger attacks/shapes. Type-changing and owner-changing operations preserve the other independent dimension. New hazard types are not randomly injected into normal enemies or runs; isolated QA fixtures expose them for evaluation.

### Music and checks

SpeedCore25/40 selects original “Velocity Signal” (160 BPM,48s); MotherCore50 selects “Gravity Crown” (144 BPM,53⅓s). Normal enemies retain “Neon Undertow”. Runtime uses exact whole-buffer FLAC loops with PCM16 WAV fallback. Native JummBox projects and official-renderer provenance are retained under `docs/boss-music-v1`. Track selection is idempotent, cancels stale loads, preserves independent effects/music toggles, and never starts from OFF/hidden without the existing gesture safeguards.

`tests/next-meta-progression.test.ts`, `next-boss-music.test.ts`, `next-imashiru.test.ts`, and `next-box-types.test.ts` cover progression, ambiguous writes, duplicate draws, settlement replacement guards, all eight registry launches, pool/intrinsic eligibility,4-slot consumption/replacement, boss audio races, current-turn transformation, overwrite/type ownership, poison turn boundaries, KO and rubble cascades. The historical Site79 byte manifest is retained; an explicitly enumerated1.3 extension manifest permits only authorized source changes. All unchanged bytes and legacy102 trace parity remain checked. Browser QA must use an isolated namespace, never the user's `/next/` save.


### Thorn type (replaces the unfinished magma proposal)

Confirmed name/trigger: トゲ, eight adjacent cells, active insertion causes2% damage to the inserter. Configurable provisional details: use the inserter's current maximum HP as denominator; floor each thorn's2% amount with minimum1; every already present adjacent thorn triggers separately, regardless of its owner. Process immediately after insertion, before shape/link effects. A lethal hit stops later thorn hits and that insertion's skills/links; later bonus/enemy insertions do not occur after KO. A newly created thorn never triggers itself. Passive falls, ownership changes and type overwrites do not trigger thorns. Shiny does not multiply this unrelated type damage. Source data is in `core/boxTypes.ts` (`THORN`). The old magma idea is not a second active type.


## 1.3.1 — mobile preparation checks and Imashiru artwork

Generated full-body normal/transformed Imashiru art, based on the supplied reference, replaces the temporary portrait in the new home, battle portrait and transformation presentation. The untouched reference JPEG remains in source. Both generated WebPs were inspected on neutral backgrounds and have genuine alpha; use contain/padding rather than cropping. Home artwork opens a large normal/transformed preview, and long panels retain a visible close header. Blue/Red approved original and transformed art remain unchanged.

Hosted isolated QA verified390×600 and320×568 home bounds, tree spending/free slots, EXP-energy two-activation confirmation, skill-pool same-card confirmation (6→7→6), Red's absence of Health, gacha saved result/debit across reload with pending acknowledgement, keyboard character confirmation/focus, horizontal-roster scroll preservation, and Continue retaining the saved Blue build despite new profile choices. Actual iOS hardware and subjective audio quality are not claimed.

## 1.4 — versioned role kits and authored home composition

New departures stamp `kitVersion:2`; absent versions retain the shipped prototype starters, Red reuse transformations and selected legacy board. Existing Violet/DiagonalShot pools remain character-locally eligible without globally granting that skill. Old tuning records do not require a new poison coefficient. Poisoning Art is a dedicated rank1 passive, excluded from shared gacha, reward offers and plus upgrades.

User-directed roles use separate operations: Mint removes an occupied3-box L (gauge10), Rose removes an occupied horizontal3 (gauge10); both are technical shapes and their removals/settling produce no active attack. Amber begins with6/9/13 link power and converts one enemy box to own for20 gauge. Silver changes up to2 enemy boxes in a selected column to frozen for15 gauge. Violet's20-gauge targeted poison records its applying actor. Blue's additional10-gauge board freezes one enemy box; Red's additional board pays2HP first then captures one enemy box (lethal cost stops capture); Imashiru's additional40-gauge board makes one chosen own box shiny without altering its pending next-drop reservation. Alternate character-specific boards use the existing tree unlock; legacy selected boards remain legal.

Prototype transformations (100/cap150) are distinct: Mint adds3 to CornerStrike this battle; Rose adds12 to horizontal links this own turn; Amber doubles transformation-gauge gain from links this own turn (not damage or other gauge sources); Violet deterministically makes up to2 enemy boxes deadly poison; Silver sets a nonstacking12-point barrier. Barrier blocks enemy link/fixed damage after FirstGuard, never self-costs, poison/thorns or blocked-board instant loss, and clears on stage change. These values are provisional and scheduled for simulation review.

Poisoning Art samples the current board at the victim's full turn end. Distinct own2×2 squares include overlaps by top-left anchor. Each poison/deadly box applied by the player assassin gains that current square count on top of base1/2. Untagged or other-source poison gets its base only. The count never accumulates permanently and is not a shape attack or shiny bonus. Box owner is the damage recipient; applying actor is separate provenance. Capturing poison preserves provenance; overwriting it with a non-poison type removes provenance. ActualHP loss alone fills player gauge.

The home composition uses official Blue Archive lobby and Arknights/Yostar storefront references for hierarchy only. No branded art was copied. Character/tools now share one launch-deck scene, the selection rail overlaps its foreground, the pool is a compact utility and the gacha has a differently weighted banner instead of a uniform2×2 card grid. Full-body normal/transformed artwork is integrated as each inspected pair arrives; no unavailable form is claimed. Meaningful helper text is darker and the backup action moves to a44px utility menu. Final visual and kit interaction QA remains part of the requested test phase.

## 1.4.1 — first bug-test closure

MotherCore now settles rubble after each active insertion, before checking the next insertion's landing/full-board state. A reproducible standard6×8 case previously attacked with a spurious4-link; a minimal full-board case incorrectly caused an instant loss. Both are retained as regressions. The animation applies crushed IDs to the current intermediate board and passively settles it, rather than revealing the final board before the second drop.

Backup import candidates are versioned by file selection. Selecting another file clears the old candidate immediately; stale reads/errors are ignored, and closing/leaving the panel cancels the pending candidate. Profile validation and the prior-profile backup still occur before restore. Delayed-file tests cover invalid/valid successor selection and cancellation.

Targeted board previews now display their actual gauge debit before ordinary turn recharge. Imashiru's30-gauge reservation emits the same debit event. Carry-candidate accessibility labels preserve the box type rather than replacing it.

Existing hosted1.4.0 mobile QA confirmed an Imashiru40-gauge targeted action and rapid same-target confirmation:193→156 gauge (one40 debit plus3 ordinary turn charge), one own/enemy cycle, and the skill disabled when all own boxes were already shiny. These fixes are verified by retained source/DOM tests and independent isolated review. The current hosted browser was intentionally not forcibly refreshed; newly deployed fixes and the newest generic charged-kit QA button are not claimed as observed in that already loaded browser. No production checkpoint was used for QA.

For profiles created before role kits, first acquisition of a previously locked character replaces its untouched legacy default board with its native role board. Only that board field changes; pools/trees/EXP and all already-owned choices stay intact. Nonlegacy imported selections are preserved. This avoids a newly recruited physical/assassin character silently departing with the old placeholder skill.

## 1.4.2 — boss audio lifecycle verification

A late failure of a cancelled FLAC load previously started an unnecessary9–10MB PCM fallback download, although playback remained safely OFF. The same load epoch/lifecycle guard now blocks that new fallback request after OFF, hiding, track replacement or destruction. Normal decode failures still fall back to WAV. Tests distinguish fetch failure, actual decode rejection, device-rate loop boundaries, stale completion, one live loop and independent effect state.

Both shipped boss FLAC files independently decode byte-for-byte to their shipped PCM16 WAV fallback: SpeedCore2,304,000frames and MotherCore2,560,000frames, stereo48kHz. Retained tests pin file hashes, FLAC STREAMINFO and WAV data-frame contracts. Subjective listening and iOS hardware remain unverified.

In the already loaded cloud QA page, normal, SpeedCore25 and MotherCore50 each reached visible BGM ON after explicit/continuing authorized gesture state. Stopping after a loading observation remained OFF until another gesture; effect audio could turn ON/OFF while MotherCore BGM stayed ON. Both controls were left OFF. This verifies displayed readiness and source scheduling contracts, not a subjective judgment of the sound. A stale settings sentence claiming BGM always remained Neon was corrected. No forced browser refresh or production checkpoint access was performed.

### Bug-phase closure evidence

The retained suite reaches863 passing tests with strict typecheck and production build. A direct application-boundary regression now executes the actual `main.ts` replacement/home functions with real stores, covering both pre-write failure and a write that persisted before throwing. It verifies the old raw terminal checkpoint and controller survive until settlement recovers, then pays exactly once before replacement. Boot readiness and launch-retry routing are separately guarded.

Independent source verification covered17 harnesses/64,717 explicit matrix cases,160 bounded continuation games/3,988 actions, and136 selected repository regressions. Recovery review covered640 storage-fault permutations,510 legacy checkpoint round trips,498 legacy continuation actions,30 first-acquisition checks and7 stale-import scenario groups. These are correctness tests, not win-rate or full50-stage-clear evidence. Detailed scope and browser/device/audio limits are recorded in `docs/qa/1.4.2-bug-phase-closure.json`. No confirmed defect remains from this test pass; that is not a claim of exhaustive correctness.

## 1.5.0 — frozen kit balance, conservative Amber power and unowned-first gacha

This release intentionally replaces the provisional Amber gauge-only form for NEW departures with「力の解放」:100 gauge/cap150, link damage×2 during the activation own turn. It does not multiply shapes, direct damage, poison, healing, gauge gain or Grow Fire growth. Link-skill additive damage is included before the power multiplier; shiny then doubles once and frozen subtracts afterward. No other combat value changes. The two-own-turn alternative remains an offline comparison candidate, not the departure default.

The old gauge-only form was weakly dominated under its cost/cap rules. Across54 paired natural simulation runs with two policies and holdout seeds, the one-turn candidate improved or tied all paired seeds (careful7/5/0; lookahead3/3/0). The two-turn candidate had higher upside but more policy sensitivity. These limited policy results support the conservative change; they do not establish universal balance or human win rates. The original unspent-level1 bot's0/384 clears was not used to justify broad buffs. Improving its policy produced real clears without changing combat numbers.

New departures freeze provisional board costs and form parameters in `meta.kitBalance`. Missing snapshots always use the exact1.4.2 fallback. Existing saves, XP, trees and builds are not rewritten. Snapshot-bearing saves use a new envelope rules tag so older clients refuse to reinterpret them; the new decoder reads both formats and checks tag/snapshot consistency. Old snapshot-free saves retain exact old bytes/rules on Continue. Candidate correctness independently passed480 parity traces/25,222 actions,4,118 focused cases and71 repository regressions.

Gacha remains100 earned coins, with20%characters/40%shared skills/40%two-energy. A new character-category result chooses uniformly among currently unowned discoverable characters until all six are collected. Then ordinary3-energy duplicates resume. Current ownership therefore changes individual character odds to20/N%; the UI labels these as NEXT-draw odds and shows the actual candidate names. There is no hard draw-count guarantee. All previous pending results, balances, RNG state, XP/builds/pools, trophies and settlement receipts remain intact; only a newly committed draw uses the new pool. No payout, XP or other exchange value changes. Independent review passed64,000 paired comparisons, rejection-sampling edge seeds, and storage-failure/migration checks.

The retained suite is878 passing tests, strict typecheck and production build. The existing cloud QA page remains loaded at1.4.0 because forced refresh was explicitly prohibited; no refreshed UI/device/audio claim is made for this release. Root1.0 and `/lab/` remain unchanged.

## 1.6.0 — versioned growth cap and preserved historical progression

Future character growth stops at Lv12/24 points, matching the unchanged total cost of the current tree. Existing higher levels and earned points are retained as character-local historical floors; excess points are shown as a preserved reserve, without promising new combat nodes. Every stored EXP value is retained, including full rewards and cap-crossing EXP-energy. The home badge shows only actually allocatable points. A fully allocated tree says「育成完了」; reaching the level cap with unspent points does not. EXP-energy cannot be spent on capped characters, including a preserved Lv30 character.

Profile schema2 records the growth-rule version and validated historical floors. Migration first preserves and verifies the original profile bytes in a separate browser-local backup, then atomically writes the migrated profile. Storage failure stops rather than deleting or overwriting unbacked-up history; retry reconciles both pre-write and persisted-before-error cases. Already-migrated profiles never recalculate historical floors from later EXP. Legacy backup imports migrate their own history; new backups preserve explicit floors. This remains device/browser-local storage, not account synchronization.

New departures freeze progressionVersion2. Existing registered, eligible old runs retain their old progression terms when their terminal reward settles exactly once; this can raise their historical floor. New-run rewards retain all EXP but do not create extra historical levels. Payouts, gacha rates/costs, tree costs, tree power and active-run combat snapshots are unchanged. New-term checkpoints use a distinct envelope tag so older clients reject them rather than silently applying older growth rules. Old checkpoint bytes remain unchanged.

The reviewed production candidate passed885 retained tests, strict typecheck and build. Independent review additionally covered100,001 EXP states,32,075 legal trees, actual old readers, legacy/new settlement terms,12 backup/primary storage-fault paths and same-instance recovery. The final package is checked against that reviewed candidate. UI cap/energy gates were inspected in source; the existing cloud QA page was not forcibly refreshed and this release has no refreshed-browser or iOS-device claim.

## 1.6.1 — descriptions that follow the actual run

The player-facing information audit found two incorrect labels: targeted board activations were all logged under Pain Shared, and legacy Amber runs that still use Red's extra-drop form were described as the newer gauge-only form. Board logs now use their actual names. Active-run board/form details read the saved tuning, kit version and balance snapshot; the home uses current new-departure values. Old Red-reuse, old gauge-only Amber and current one-turn link-power Amber are described separately. Red capture's HP cost follows its saved value. Form costs, caps, lifetime and exclusions are visible for all eight characters.

Target restrictions now match selection: Silver skips already-frozen enemy boxes, Violet excludes poison/deadly-poison, Blue excludes frozen, and Imashiru Focus excludes already-shiny own boxes without consuming its separate reservation. Poison details explain the applying actor, current overlapping own2×2 count and owner-based victim. Thorn's2% max-HP, per-thorn floor/minimum1 and active-insertion-only rule already matched the engine and remain unchanged. The home clearly labels next-departure settings, current eligible pool count and Lv12 growth scope. The energy panel now shows current/next-level EXP immediately after each use, including uses that do not level up. The linked catalog no longer presents1.2.27 as the current interface or lists newer characters' starters as unowned.

Seven retained information tests execute the actual event logger and minimal-DOM home handlers, including750→800→850→900 EXP, preserved Lv30/reserve36 and the energy cap guard. No combat, currency, growth, save or targeting implementation changed. This is source/isolated-DOM verification; no forced browser refresh or new live-browser claim.

## 1.7.0 — explicit earned-reward return

Home retains「続きから」as the primary way to resume. Its separate「帰還する」action confirms the saved run's character, defeated count and exact reward before ending it. A confirmed eligible formal return receives5coins/10EXP per actually defeated enemy once, matching ordinary defeat. Zero defeats yield zero; partial enemy damage, return itself, clear bonuses and trophies add nothing. The player remains alive, and HP/board/build/RNG/turn state are preserved. The result says「帰還しました」rather than death or victory. Returning never automatically starts another run.

The first slice is deliberately limited to a stable active player-decision checkpoint. It is unavailable during reward choice, pending committed rewards, enemy turns, turn-start actions or animations. The player finishes/skips the stage reward and waits for automatic resolution, including any carried Red bonus drop, before returning. Cancel is a pure no-op and leaves Continue available. No home navigation, modal close, character choice or page lifecycle event implicitly retires a run.

A new `retired` run outcome is durably written before the profile is credited. It reuses the registered departure snapshot and runId receipt ledger; no new profile schema or payout coefficient is introduced. Old progression terms remain attached to old runs. A dedicated return-save tag stops older readers from automatically resuming a live-HP returned battle. Existing non-returned save bytes remain unchanged. As with other unreadable saves, an older client's explicitly confirmed backup-and-replace recovery can still discard a save; forward-safe rejection is not a promise to prevent every user-authorized discard.

A failed checkpoint/profile write retains the exact intended terminal checkpoint for retry. Reload settles a durably returned result once. Every controller action, automatic start, retry/resume path and Continue classifier recognizes returned runs even though battle result remains null. A pending unpaid return cannot be overwritten by starting another run. QA/unregistered/old uncertified runs do not acquire reward eligibility.

The final retained suite is902 tests with strict typecheck and build. Independent review of the frozen runtime candidate passed35 naturally replayed checkpoints and18 additional audit groups, including ownership/stale changes during confirmation and pre/post-write failures. Retained actual-main and minimal-DOM home tests cover cancellation,0/10/49-kill quotes, selected-character mismatch, terminal Continue removal and reward-boundary restrictions. No battle-core or kit-balance coefficient changed. The existing browser was not forcibly refreshed; this is source/controller/isolated-DOM verification, not new browser/device coverage.

## 1.7.1 — roster transformation identity and recorded-cue routing

The all-character boss/presentation audit found that the transformation sound gate still accepted only Blue and Red, silently ignoring all six newer form events. Registered roster events now map explicitly to existing recorded banks: Blue keeps its dedicated cue; Red and the six newer characters use the existing Red rise/release cue. This is reuse, not six new compositions. Character and manual-theme modes retain once-only scheduling, OFF/hidden/abort safeguards and no synthesized/hit fallback.

Older prototype saves may legitimately retain a Red-style mechanic. Their effect event and behavior remain unchanged, while the cinematic identity marker, accessible portrait names, form caption and activation/end logs identify the actual caster. This corrects a legacy Mint/etc portrait being called Red. The basic-power explanation now explicitly separates later transformation/type multipliers and damage reduction from its displayed base values.

All eight rosters were replayed from natural recorded choices through stages25/40/50. Two selected sets total16 runs/1,276 boss actions/590 enemy boss turns, including43 double-drop Mother turns,31 critical Mother turns and61 fixed-attack Speed turns. HP event chains, intent ordering/limits, UI attack tables and music selection stayed consistent. The traces naturally included Silver barrier/frozen boxes, Violet poison and Imashiru shiny boxes. These are selected interaction traces, not representative win rates; seven second-pass runs are heldout and Rose is a primary trace. The prior rubble fix is not counted as a new finding.

The retained suite passes906 tests, strict typecheck and build. Independent presentation review additionally passed223 fixtures across current/legacy events, both audio modes, cancellation/failure paths and older-Safari relays. Audio evidence is scheduling/cancellation, not subjective hearing. No combat formula, save behavior, art bitmap or boss music changed. No forced browser refresh or new device coverage is claimed.

## 1.7.2 — active form names and type-preserving conversion feedback

The persistent form-status strip and bonus-start log now also name the actual legacy caster instead of calling every old Red-style effect Red. Remaining starts, remaining own turns and expiry are unchanged. Ember's engine already preserved a captured box's type, but the temporary conversion overlay rebuilt it as normal. The overlay now carries that type into both old/enemy and new/player layers, retaining shiny, frozen, poison, deadly-poison, rubble and thorn markers. The original normal-box cue remains byte-compatible.

The active-information audit also checked existing poison base/current-square contribution, shiny's single×2, frozen subtraction after multiplication, current-turn duration and inspectable ownership/type labels. No new panel, mechanic or balance coefficient was added. The retained suite reaches908 passing tests, strict typecheck and build. Independent review passed700 engine-driven type-conversion fixtures and24 real legacy turn-start cases, plus27 selected regressions. No core/app/meta source changed. No refreshed-browser/device verification is claimed.

### 1.7.2 player guide closure

The existing `/docs/game1_content_catalog_next.html` route is now a concise Japanese player guide. Its character/skill/cost tables and level thresholds are generated from current source definitions; the companion JSON retains the original rule1.2 catalog and adds the current guide data. It covers all8 roles,25 legal free/unlocked board choices, exact growth/gacha/return terms, types, trophies and local-only backup limits. The documentation index no longer presents1.2.25 as the current interface. No new game screen or runtime code was introduced.

Independent static review checked12 level thresholds, all64 ownership subsets,8 roles/25 board choices,9 shared skills and legacy level/point preservation. The retained suite is912 tests with strict typecheck/build. HTML nesting, unique anchors and exact source-to-output parity pass. The guide uses no script, external request or browser-storage access. A fresh browser/mobile rendering review was not performed under the existing no-forced-refresh boundary.

## 1.8.0 — tactile draws, departure review, visible loadout, geometry-based inputs

User criticism and design intent are retained in Japanese/English beside the implementation and in `docs/interaction-design-draft-1.8.md`. The draw view now shows a capsule globe, rotating crank, chute and reveal; debit/outcome persistence still occurs exactly once before animation. Closing or reduced motion affects only presentation. Run start reviews the frozen, actual departure configuration before calling launch. A delayed launch keeps the confirmation disabled and cannot be unlocked by closing the panel.

Equipped fixed/free skills and actual remaining consumable counts remain visible below the board. Consumables reuse the existing action forecast and confirmation, including slot3/4. Non-action skills are labeled automatic, not always-active. Explanatory home prose is shortened or moved into expandable detail.

Emitters use engine `edge.row/col/side` coordinates, not a top-only header or fixed6×8 layout. The engine's downward gravity remains unchanged. Internal ceilings and separate playable segments retain distinct candidate IDs and row/column labels. Clicking a lower chamber no longer selects the upper chamber's candidate. Thin12px edge marks have44px-high hit envelopes; same-column ceiling spacing is at least52px at the24px minimum cell size. Extra-large boards scroll inside the board region.

Added15 normal skills (26 identities including the fixed passive;25 normal choices) and16 character-exclusive tree board alternatives. New departures use own-character board choices; saved runs retain their frozen old configuration. Catalogs and guide describe current counts and distinguish prior balance studies from the still-unmeasured long-run balance of the new skills.

Validation: retained engine/controller tests plus actual isolated-DOM home interaction tests cover cancellation, delayed/double launch, repeated draw, interrupted reveal/reopen, duplicate acknowledgment and failed save. Geometry tests cover non6×8 boards, internal terrain ceilings, blocked upper chambers, every edge-side view coordinate, and hit-envelope separation. This release does not claim refreshed live-browser, phone touch-device, iOS, or subjective audio coverage. The user's ongoing game was not forcibly reloaded. Root1.0 and `/lab/` remain unchanged.

Final integrated validation:950 tests pass, strict TypeScript and production build pass. The final consumable preview regression verifies gauge gain and cleansed-box counts with no state mutation. No browser refresh was used for verification.

## v1.9.0 — reusable monsters and versioned encounter bands

日本語（設計意図）: 1–24階で通常リンクを覚え、26–39階で一体につき一つのギミックを学び、41–49階で同じギミックの上位形を読む。色違いだけの水増しや、一体へ複数妨害を積む構成は避ける。今回の新種は6体、既存を含め12体。ボスの固有周期は変更しない。
English (design intent): Learn ordinary links at floors 1–24, a single gimmick per monster at 26–39, then readable upgrades at 41–49. Six new distinct silhouettes/attack identities, twelve total enemies; no palette-only padding or stacked debuffs. Boss signatures are unchanged.

### Common definition vs Monster data vs encounter placement

- `core/types.ts`, `boxTypes.ts`, `activeDrop.ts`, `turnLifecycle.ts`: shared meaning of insertion, box ownership/type, links, damage, turn-end poison and KO boundaries. 共通定義は「何が起きるか」の意味を一箇所で定める。
- `core/monsters.ts`: reusable stable ID, Japanese name and resolved base combat data. `core/tuning.ts` owns numeric tables; old snapshots may omit only the six added IDs. モンスター定義に出現階配列は持たせない。
- `core/monsterBehavior.ts`: pure own-turn schedules and deterministic freeze target selection; `enemySequence.ts` executes them using the existing type and active-drop rules. No render-time mutation or RNG. 行動周期と効果実行を分離。
- `app/encounters.ts`: versioned declarative `{id, from, to, pool:[{enemyId,weight}]}` bands, plus explicit boss overrides. A stage-ID-per-monster list would duplicate dozens of values and make range changes fragile; ranges are the authoritative source. Fixed exceptions belong to the override table. 将来は新しい出現版を追加し、`bands-v1` を上書きしない。
- `app/progression.ts`: stat scaling only after enemy selection. Current first-loop HP is base HP + `(localStage - 1) * hpPerStage`; loop growth still applies once. 出現と難度を別責務にする。
- `ui/monsterPresentation.ts`, `ui/enemyIntent.ts`, `portraits.ts`: names/traits, actual planned actions, target coordinates and portraits; none owns combat rules. UIは予告・説明だけ。

### v1 band data / 出現表

| Local floor | Pool (integer weights) |
|---|---|
| 1–24 | Marujiro 3, Hikikizan 2, Merarun 2, Twin Core 3, Needle Core 2 |
| 25 | Speed Core, fixed |
| 26–39 | Nigirin 2, Frost Core 3, Thorn Core 3 |
| 40 | Speed Core, fixed |
| 41–49 | Rime Crown 1, Briar Wheel 1 |
| 50 | Mother Core, fixed |

Nigirin's healing is deliberately excluded from the basic band. Merarun has ordinary drops and link attacks only. Weights are relative, not percentages or guarantees; repeated encounters are permitted. The selector uses an avalanche-mixed domain-separated key from original run seed + absolute stage, with existing unbiased integer sampling. It never consumes combat or reward RNG. Boss override returns before any weighted draw. Invalid IDs, duplicate entries/bands, missing non-boss coverage, overlapping non-boss bands, nonpositive/noninteger/overflowing weights and missing fixed bosses fail validation.

### New monsters / 新モンスター

| ID | Base HP | 3/4/5+ | Identity |
|---|---:|---|---|
| twin-core | 42 | 4/5/7 | Strong short links, ordinary single drops |
| needle-core | 25 | 2/6/13 | Fragile long-link threat, ordinary single drops |
| frost-core | 36 | 3/5/8 | Every fourth own turn, freeze up to one player box instead of dropping |
| thorn-core | 40 | 2/4/7 | Every fourth own turn, insert one thorn instead of a normal box |
| rime-crown | 48 | 3/6/9 | Every third own turn, freeze up to two player boxes instead of dropping |
| briar-wheel | 52 | 3/5/8 | Every third own turn, insert one thorn instead of a normal box |

日本語: 氷結は未凍結の自箱を上の行→左の列の順に選ぶ。所有者は維持しタイプを上書き、古い毒付与者も消す。対象なしなら何もせず手番終了。氷結自体は投入でもリンクでもないため、満杯盤面の代替攻撃・トゲ反応・乱数消費を起こさない。敵の毒は全行動後に一度精算する。
English: Freeze targets uppermost then leftmost non-frozen player boxes, retaining ownership and replacing type/provenance. No targets means a spent no-op turn, not a drop. Freeze cannot trigger insertion/link/thorn/fallback or spend RNG; enemy poison still settles once at the complete own-turn end.

日本語: トゲ箱は投入時点からトゲ。既存トゲの周囲8マスなら敵自身も被害を受け、敵が倒れたらリンク攻撃へ進まない。フローズンとトゲの既存ダメージ計算を再実装しない。
English: Thorn is present on the committed drop event before insertion effects. Existing adjacent thorns can kill the inserting monster before link attacks. This reuses, rather than duplicates, all current thorn and frozen mechanics.

### Save compatibility / セーブ互換

New standard 50-floor setups save `options.run.encounterVersion = 'bands-v1'` and the rules marker `next-1.9-encounters-bands-v1`, including retired results. Unknown versions fail closed. Missing version always keeps the old rotation, unchanged numeric snapshots, combat/reward RNG and future enemies. Explicit `legacy-endless` and `legacy-v0` QA fixtures keep the old route. Reopening an old save never opts it into the new bands; no forced reload or ongoing autoplay is introduced.

The existing root and lab, all existing art/audio, private audience, existing boss signatures and return/reward logic are preserved. New portraits were generated as six individual transparent image assets; runtime WebPs retain distinct silhouettes and alpha. No existing portrait was repainted.

### Validation scope / 検証の範囲

The expansion has focused tests for weighted coverage, validation, first-band purity, deterministic targets, full/no-target freeze, thorn self-KO, save/reward resume and retired rules versions. Independent audit additionally checks 150,000 stage samples, 24 new-run save boundaries, and eight real pre-update checkpoint trajectories. This establishes deterministic functional correctness, not equal character strength or a human clear-rate claim. Existing balance studies in the guide are explicitly labeled as using the old encounter table.

## 1.10.0 — supplied late monsters and growing rank caps / 終盤2種と育成段階上限

日本語：新出発の41–49階は `bands-v2`。ライムクラウン、ブライアホイール、デビルモン、シャシャークを各重み1で抽選。25/40のスピードコア、50のマザーコアは固定のまま。旧 `bands-v1` の表・順序・ハッシュ・抽選結果は変更せず、保存ランの出現版を維持する。
English: New departures use bands-v2, with four equally weighted late-band species. Existing bands-v1 and missing-version legacy runs preserve their original encounter stream and all combat/reward RNG.

- デビルモン / Devilmon: base HP48 (provisional, matching Rime Crown), attacks 4 / 8 / 12 for 3 / 4 / 5+ links. On each exact-four active enemy link axis, uniformly select one currently player-owned normal-type box and assign poison through the central type hook with enemy provenance. A multi-axis four-link selects distinct eligible boxes sequentially. Five-plus links, passive conversions/settling, non-Devilmon actors, and no-target states do not trigger. No eligible target consumes no RNG. Poison settles only at the affected owner's turn end; enemy provenance cannot gain Violet's player-origin bonus.
- シャシャーク / Shashark: base HP52 (provisional, matching Briar Wheel), attacks 4 / 12 / 20. Normal drops only; no extra skill. Both keep the existing stage HP scaling: base + (stage−1)×10 in the first loop.
- 報酬の即時回復 / Reward heal: new numeric tree node, initial rank cap5, cost1pt/rank, +2 HP/rank to BUILD REWARD immediate healing only. At departure, snapshot into the existing reward tuning; display in tree/departure/reward preview. Health, potions, maximum-HP reward, Blue reactions and all other heals are unchanged. Old frozen configurations are never rebuilt or retroactively strengthened.
- 段階上限 / Rank caps: three/four/five link power and rewardHeal use initial cap5 + floor(character level/5): levels4/5/9/10/15 yield5/6/6/7/8. Fresh growth remains capped at Lv12, so Lv15 applies only to preserved legacy characters. No unrequested HP stat added. Skill slots retain two upgrades (four free slots total); board unlock retains one rank. Points remain2+2×(level−1), never awarded by migration. Dynamic budgets/caps, UI, validation and respec agree. Legacy L30 retains60 earned points; dynamic tree capacity53 leaves7 reserved rather than deleting them.
- Migration: profile/run treeVersion2 distinguishes expanded allocation validation; missing rewardHeal remains0 for old structures. ProfileStore backs up the exact previous profile before migrating; launches, receipts, XP, currencies and old run metadata remain unchanged. New saves use next-1.10-encounters-bands-v2; v1/missing-version saves retain previous rule markers.
- Art provenance: supplied IMG_8785.png (Devilmon) and IMG_8658.png (Shashark), with transparent WebP background-removal derivatives. Originals retained outside runtime; background processing introduces minor highlight/star-detail differences. No replacement character concept or generated substitute was used.

Verification: independent pristine 90cf0b encounter/save fixtures compare750 exact bands-v1 stage/seed results and5 full reward continuations, including frozen tuning, enemy selection and every RNG state. Exact-three/four/five, multi-axis, no-target, typed exclusions, provenance, reward-only healing, frozen launch isolation and level4/5/9/10/15 boundaries are covered by independent tests.


## 1.11.0 — type frames, inspection and frozen link balance / タイプ外周・長押し・凍結調整

- 日本語: 「ト」「フ」などの仮文字を廃止。所有者の芯・色は維持し、輝きの星枠、氷の結晶、毒の液面、げきどくの二重毒枠、ガレキの角片、トゲの針を独立した上描きに変更。通常は追加外周なし。
- English: Distinct SVG type silhouettes are painted after owner energy, below cell targeting/hit feedback. No DOM hit targets, raster dependencies, layout expansion or rapid blinking; reduced-motion disables the slow shiny breathe.
- 日本語: 450ms長押しで現在のタイプ名と効果を表示。ドラッグ・スクロール・キャンセル・複数指では投入しない。開くと既存の投入/行/対象選択を解除し、次の通常タップは新規選択。「箱の効果」ボタンから選択、フォーカスした箱でI/Shift+F10も利用可。閉じる/Escape/背景で閉じ、箱IDでフォーカス復帰。
- English: New departures snapshot frozenRule=half-melt-v1. One or more frozen / absolute-zero boxes halve link attack once, flooring odd results. After that qualifying link attacks, participating frozen boxes thaw to normal; absolute-zero does not melt. Per-link order remains vertical → horizontal → diagonal-down → diagonal-up; later links read current types. Absolute-zero is a supported type without automatic reassignment of existing enemy skills. Order: link bonuses/transformation multipliers → shiny ×2 once → frozen ÷2 once → first guard/normal guard/barrier. Shapes, healing and gauge are unchanged. Preview runs the identical resolver. Existing checkpoints with no field retain subtraction of1 per frozen box; stage advancement and serialization retain the field without migration or forced reload.
- 日本語: タイプ説明・ルール・敵詳細の凍結説明は同一ヘルパーから生成。どく/げきどくは所有者手番末1/2、毒盛り術は付与元に応じ現在の2×2分加算。トゲは8近傍の能動投入に投入者最大HP2%、1個ごと切捨て・最低1。ガレキは直上2箱で崩れ受動落下。
- Validation: all existing suites plus gesture state sequences, eight visual variants, type explanations, new/legacy rounding and count, 3/4/5-link preview parity, unaffected shapes and stage-rule retention. No managed browser preview executable is installed in this environment; real browser touch/visual QA remains a separate check.

### 1.11.1 — inspection footer containment / 効果確認ボタンの配置修正
The inspection toggle now occupies an explicit third hint column rather than creating an implicit row overlapping action controls. Expanded row/Ember forecasts use a full-width hint followed by a contained save-status/toggle row. Desktop, narrow widths and short viewports retain the existing footer allocation. Gameplay and saved-run rules are unchanged.

## v1.12.0 — Trophy skills, Violet, and home music

- JP: 新規出発のバイオレットは3/4/5以上リンク基礎火力1/2/3。毒盛り術・毒盤面技を中心にするテクニカルなキャラ。EN: New Violet departures use 1/2/3; existing run combatant snapshots and legacy departure metadata retain their original power.
- JP: 記録済みのキャラ別50階トロフィー8種へ専用通常スキルを各1種付与。新規の正式ランは自手番実ダメージ100・最大HP100でも解放。EN: Eight recorded character-clear trophies grant eight ownership entitlements; newly observed official-run thresholds grant Heavy Swing and Rescue Kit. No fabricated historical damage/HP claims.
- JP: 大振り攻撃は5以上の各リンクへ「現在の5リンク火力×0.5、＋なら×1」を加算、端数切り捨て。救急箱は上段 自/任意/自・下段 自/自/自、回転不可、10回復、＋なし。EN: Additive 5+ tier bonus is floored per link; the five required rescue cells ignore the top-center wildcard's contents. Existing shiny/Blue healing behavior applies. No other new healer.
- JP: キャラ報酬は澄んだ支柱・挟撃・双斜線・方陣連結・毒際攻め・氷際攻め・四拍子・輝き継ぎ。EN: Each uses current board/link conditions only, without future setup counters or RNG.
- JP: 所持へ一度だけ追加。プールは手動で6〜20種から選び、出発時固定。自動装備なし・ガチャなし。EN: Trophy grants never equip a skill or mutate a running pool. Recorded character-clear achievements are reconciled when loading a profile.
- JP: 自手番の追加投入・複数軸・形・直接攻撃の実HP減少を合算。敵手番の毒と過剰ダメージは除外、手番終了か戦闘終端で確定。EN: The optional run ledger includes actual HP loss, persists partial bonus-turn totals, and settles at stable boundaries. Run-save precedes idempotent profile grant; before/after-write failures reconcile without duplicate ownership. Ledger absent in old saves remains absent for byte-compatible continuation. New threshold observation begins on v1.12 departures.
- JP: ホーム専用のStarlight Terminalを追加。EN: Explicit music scenes keep restored/background battle state from selecting a combat track while home is shown. Existing normal/boss tracks remain unchanged.
- JP: 7タイプへ透過素材フレームを導入（計75KB）。所有者の丸/菱形の芯を維持し、新しい箱または実際のタイプ変化だけを680–850msで表示。EN: Static pixel QA at24/40/60px passed; selection/forecast rerenders do not restart all frames. Reduced motion and low-performance mode skip arrival motion.
- Verification: 1,021 automated tests, TypeScript and production build passed. The original root/lab gameplay remains guarded by prior source manifests; only explicitly listed v1.12 sources are changed. Native home audio provenance, exact loop metrics and assets are tested. Browser motion/live listening were not verified because managed preview infrastructure was unavailable. This does not substitute for mobile/device QA.

## Shared home BGM controls (1.12.1)

Home exposes BGM and a 0–100% volume slider above departure. Both home and battle observe the same SampleAudioDirector; navigation changes only the scene track, not the preference. Existing presentation settings persist volume and optional musicEnabled intent. Old settings remain valid. Restoring ON does not construct an AudioContext, fetch music or autoplay; the button offers a gesture-based resume. Effects remain independent. Home's control element survives home renders, with explicit teardown; each slider change is reflected in the other settings view. Focused UI/director tests cover these paths and one-loop home/normal/boss navigation. Browser visual/audio QA was unavailable because the required cloud browser skill was absent; no iOS or listening-quality claim.

## 1.12.2 — visible battle speed and compact audio controls

日本語: 戦闘上部に既存の2設定（通常／短縮）を常設。保存済みの短縮、ゲームの光・揺れ低減、端末の動き低減が短縮演出へ入ることを確認。ユーザー端末の原因は未確認。低減中は「低減で短縮」と表示し、希望速度・低減元は読み上げと説明にも表示する。設定を勝手に戻さず、速度・音量・BGM状態は同じ保存経路で維持する。
English: Existing normal/short budgets are unchanged: drop180/15ms, attack300+300/0+150ms, other feedback100+500/0+150ms. The animator snapshots motion once per committed action, so changes take effect at the next action. Reduced motion remains authoritative. No third speed or implicit preference migration is introduced.

日本語: 効果音はベル＋SE、BGMは音符＋BGM。OFFには斜線、読込・再試行・再開にも文字を残す。別々の音声グループと操作による再開を維持。歯車は詳細、ホームは家の記号を添え、技名は消さない。
English: All new targets are at least44px, native select retains keyboard operation, icons are decorative with named controls. The top strip reserves an explicit44px row and the existing board sizing adapts; footer audio uses44px columns without adding a row. Root/lab, saves, gameplay, sound assets, and private audience are unchanged. Automated persistence/reload, settings synchronization, audio races, timing/boundary and markup tests cover the change. Browser QA is reported separately.

## 1.12.3 — one action timeline and a precise settings gear

日本語: 実画面で短縮の「ほむらの火種」を確認すると、変換表示が残るまま相手手番へ進んでいた。HP演出150msだけを待ち、変換表示240msの終了を待っていなかったことが原因。通常も変換表示420msが行動外へ残っていた。
English: A live short-speed Ember action showed the conversion overlay during the following enemy action. The animator waited for the 150ms HP feedback but not the subsequent 240ms conversion. Normal had the corresponding 420ms tail. Both now finish the remaining cue before handing control to the next action: Ember with conversion is 390ms short / 1020ms normal. The 760ms normal activation label overlaps the action; it is not added as an extra sequential delay.

日本語: 一つの変更不可の時間表を行動開始時に取得し、投入・攻撃・数値・立ち絵・盤面技能・タイプ外周へ共有。通常/短縮の切替は次の行動から。端末や光・揺れ低減の有効化は安全のため動きのみ直ちに停止できる。設定をリセットしない。
English: One immutable profile supplies the animator and decoration helpers. Drops remain 180/15ms; attack impact stays at 300/0ms and total 600/150ms; other HP feedback remains 100+500/0+150ms. Previously 680/850ms material arrivals are now bounded by the same 180ms drop interval instead of being cut off by the next board render. Existing stage/form cinematics retain their independently captured 1100/250ms and 2100/250ms timelines. OS motion reduction remains authoritative. Action cleanup removes any unfinished decorative nodes before input is available.

日本語: 設定アイコンは中心(12,12)、45度ごとに同形8歯と円形の穴を持つSVGへ置換。24px viewBox、44px操作領域と読み上げ名を維持。SE/BGM記号、ゲーム処理・乱数・保存・旧版は変更なし。
English: The gear is generated from eight identical teeth with quarter-turn symmetry, a centered circular bore, and existing accessible button semantics. Regression tests cover all motion flag combinations, cue tails, action abort cleanup, event preservation, mid-action toggles and symmetry. Fine-grained projectile/HP visual timing cannot be claimed from the browser's discrete screenshot sampling; automated tests retain exact impact ordering.

## 1.12.4 preparation review (PDF pages 6–25)

Battle portrait dialogs use a 48px SVG close target. Home preparation uses single-tap character/board selections and reversible skill toggles, with 6–20 reward candidates and a distinct non-removable starter card. Existing battle reward markup and styles are shared by collection, gacha skill results and departure candidate cards; actual skill conditions remain visible. Legacy candidate lists are read unchanged and normalized only for new preparation/departure, never active runs.

Tree ranks use lit dots and a finite reduced-motion-safe pulse; remaining points are the only point total shown. XP energy moves to the home wallet's star button. Departure shows art, HP, link damage and expandable skill/form names. Gacha probabilities are a table; no unrelated progression or implementation prose is included. Home art dialogs, backup, and the battle reward commitment flow remain unchanged. No combat numbers, save schema, reward draws or gacha probabilities changed.

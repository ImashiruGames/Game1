# Game1 箱積みの戦場 · Prototype1.0.0


通常箱・キャラクタースキル・撃破報酬ビルド・エンドレスPvEを遊べる検証用プロトタイプです。
A deterministic PvE prototype with character skills and a finite three-enemy route, built with TypeScript, Phaser 3, and Vite.

HP・攻撃値・盤面サイズはすべて検証用です。正式バランスではありません。
All balance values and sample boards are provisional fixtures, not final game balance.

## Windowsでダブルクリック起動 / Windows double-click launch

1. ZIPを右クリックして「すべて展開」し、展開先の`game`フォルダーを開きます。ZIPの中から直接実行しないでください。
2. **Node.js 24以降とnpm**が必要です。未導入の場合は[Node.js公式ダウンロード](https://nodejs.org/en/download)から対応するWindows版を自分で導入してから戻ってください。この起動ファイルはNode.jsのインストールや管理者権限の要求を行いません。
3. `game`フォルダーの **`start-game.bat`** をダブルクリックします。場所を変えても、`package.json`や`src`などと同じフォルダー内に置いてください。
4. 初回は必要なライブラリを取得します。**インターネット接続が必要**で、数分かかることがあります。2回目以降、必要なファイルが揃っていれば取得を省きます。
5. 準備ができると通常のブラウザが自動で開きます。開かない場合は、画面に出る`http://127.0.0.1:5173/`へアクセスしてください。
6. **遊んでいる間は起動した黒いウィンドウを開いたまま**にします。終了するときは、そのウィンドウでCtrl+Cを押すか閉じます。ブラウザを閉じるだけではサーバーは停止しません。

- エラー時はウィンドウが残るので、表示された内容を確認できます。初回取得の失敗は接続・書き込み権限を確認後、もう一度ダブルクリックしてください。
- 2つ同時に起動した場合、2つ目はポート使用中で止まります。既存のGame1が動いていれば、そのURLを開いて使えます。
- 戦闘途中の保存機能はありません。ページを更新したり再起動すると、最初の状態に戻ります。
- ローカル専用です。他のコンピューターには公開しません。ネットワーク設定やファイアウォール設定は変更しません。
- **Windows実機でのダブルクリック動作は未検証です。** この開発環境はLinuxです。CRLF・引用されたパス・Nodeバージョン判定・起動引数は静的／自動検証していますが、実機テストの代わりではありません。

Extract the full ZIP, ensure Node.js 24+ and npm are installed, then double-click `game/start-game.bat`. The launcher installs missing locked dependencies, starts the existing loopback-only Vite script, and opens your default browser. Keep its console open while playing; errors remain visible. It does not install Node.js, request elevation, change network settings, or save battle progress. Actual Windows execution remains untested in this Linux environment.

## 起動 / Run

Node.js **24以降**を使用してください。 / Requires Node.js **24+**.

```sh
cd game
npm ci
npm run dev
```

表示されたローカルURL（通常 `http://127.0.0.1:5173`）を、このサーバーが動くコンピューターのブラウザで開いてください。
Open the printed localhost address in a browser on the same computer. Localhost is not a shareable hosted preview URL.

```sh
npm test           # Core + controller tests; no DOM or Phaser needed
npm run typecheck  # Strict TypeScript checking
npm run build      # Typecheck, then produce dist/
npm run preview    # Serve dist/ at http://127.0.0.1:4173
npm run check      # All unit tests + typecheck + production build
```

`file://`でHTMLを直接開かず、Viteまたは静的HTTPサーバーを使います。新しい依存関係の取得以外、ゲーム実行に外部通信は不要です。
Use HTTP serving rather than opening the HTML via `file://`. The game makes no external network requests after local installation/build.

書き込み制限のある環境でnpmの既定キャッシュが使えない場合、許可された作業領域にキャッシュを指定できます。
If npm's default cache is not writable, use an allowed workspace cache, e.g. `npm ci --cache /tmp/game1-npm-cache`.

## 操作 / Play

- 盤面の**天井辺に付いた金色の▼**を選んで、1個の箱を真下へ落とします / Select a gold ceiling-edge marker to drop one box vertically
- マウスを重ねると着地点を予測表示します / Hover to preview the landing cell
- キーボード操作は右側の「投入先一覧」を開き、TabとEnterで選びます / Expand the drop list for keyboard buttons
- 青の盤面スキルはウィンドウを開かず、盤面の行にホバーすると消去範囲と双方のダメージを予告し、クリックで使用します。左欄の行選択＋確定でも操作できます / Blue targets rows on the visible board, with an inline keyboard/touch alternative
- 赤の盤面スキルは左欄でHP消費・変換数を確認して使用します。どちらも「取消」またはEscで行動を消費せずに戻れます / Red confirms its cost inline; Cancel or Escape exits without spending a turn
- 対象選択中は通常投入をロックします。再開始・次戦移行で古い選択と予告を消します / Target mode blocks drops and resets safely with battle lifecycle changes
- ヘルスは成立した＋形の5箱だけが緑色に光ります。その後、リンクは解決順に1方向ずつ金色に光り、該当箇所の上に赤い「Nダメージ」を表示します / Health highlights the exact plus; each resolved link gets its own ordered highlight and actual damage label
- 演出短縮では移動・フェードを省略し、短い静止表示で同じ処理順を維持します / Reduced motion keeps the same order with brief stationary feedback
- プレイヤー箱は金色の **P**、敵箱は水色の **E**、中立箱は灰色の **N** / Ownership uses both letters and colors
- 3個以上の同一所有者リンクで攻撃します。今回投入した箱を含む4軸だけを判定します / Only links through the newly placed origin can attack
- 箱は攻撃後も残ります。敵は同じ共有盤面に投入します / Attacking does not consume boxes; both actors share the board
- 解決中の入力は無効です。再開始は演出中でも安全に行えます / Repeated input is locked; restart safely cancels pending presentation
- 連続対戦はエンドレスです。撃破報酬を選ぶかスキップしてから継承し、次戦へ進みます。敗北すると終了します / Endless runs pause for a reward after each victory and stop on player defeat

「設定」ではキャラクター・最初の敵・連続対戦・盤面・乱数シード・演出短縮を選べます。演出短縮以外は「この設定で再開始」で反映します。
The lab offers characters, enemies, route mode, board fixtures, a seed, and shorter animations. Apply battle settings with the explicit restart button. Reduced-motion OS preferences are respected.

## 検証シナリオ / Included fixtures

| 盤面 / Scenario | 確認すること / Purpose |
| --- | --- |
| 基本の対戦 / Standard | 6×8、プレイヤーHP30、選択した敵のHP／攻撃値 / Empty board with selected enemy profile |
| 内部の天井 / Internal ceilings | 浮いた地形の上下に別の落下区間 / Markers under internal platforms |
| 縦横リンクとオーバーキル / Cross attack | 中央へ1回投入し、縦→横の2攻撃。HP0以降も続行 / Two ordered attacks, including overkill |
| 最後の1マスで勝利 / Last drop wins | 最後の合法投入で勝利し、敵へ進まない / Victory before any blocked-enemy attack |
| 投入不能とスキップ / Blocked player | スキップ→敵の投入不能→即死相当攻撃 / Separate skip and lethal replacement |
| 敵の攻撃表 / Enemy attack table | 敵の3リンク攻撃値3を確認。小盤面なので続いてスキップ・即死相当まで進む / Enemy-specific damage, followed by the blocked-board flow |

基本設定：プレイヤーの3/4/5リンクは4/7/11。敵は選択した定義の攻撃表を使います。検証盤面では仕込まれた開始HPを優先します。6以上は5リンク相当ですが、赤の縦リンクはグローファイアの計算に置き換わります。
Player base damage is 4/7/11; enemies use their named profiles. Fixtures preserve their prepared starting HP. Grow Fire explicitly overrides the vertical attack formula.

## 構成 / Architecture

```text
start-game.bat          # Windows double-click launcher (CRLF, no Node installer)
src/
  core/                 # Framework-free deterministic rules
    types.ts            # Explicit coordinates, ownership, state, action/result contracts
    definitions.ts      # Provisional balance and gravity-stable fixtures
    validation.ts       # Reject invalid configurations before starting
    board.ts            # Ceiling intervals, legal paths, passive settling
    links.ts            # Origin-based four-axis detection
    skills.ts           # Skill availability, previews, plus-shape detection, enemy intent
    random.ts           # Seeded unbiased candidate selection
    battle.ts           # One atomic action, ordered attacks, HP/result/turn flow
    immutable.ts        # Freeze independent snapshots
    index.ts            # Small public surface
  app/
    BattleController.ts # Input lock, automatic actions, cancellation, run lifecycle
    BattleRun.ts        # Finite roster, HP/top-row carry, stage seeds
  ui/
    BoardScene.ts       # Phaser board/markers/landing preview/falling animation
    BattleShell.ts      # DOM HUD, skill dialogs, enemy intent, log, settings
    theme.ts            # Shared presentation labels/colors
  main.ts               # Composition and cancellable presentation sequence
  style.css             # Responsive screen layout
tests/
  core*.test.ts         # Rule acceptance tests
  controller.test.ts    # Input locking, restart, cancellation, repeatability
```

### 境界と拡張 / Boundaries and extension points

1. **CoreはPhaser/DOM/時刻を参照しません。** `applyAction`で1行動を同期的に解決し、凍結した次状態と順番付きイベントを返します。画面が勝敗やリンクを再判定しません。
   **Core is independent of Phaser, DOM, and wall time.** It commits an immutable state plus ordered events once per valid action.
2. **投入候補と使用可否は別です。** 地形の列ごとの区間から候補を生成し、箱で塞がれた候補も消しません。候補IDは地形座標から安定生成します。
   **Candidate geometry and availability are separate.** Boxes do not create new ceiling candidates, and blocked candidates remain visible.
3. **演出完了は行動を再実行しません。** Controllerの世代番号とAbortSignalで、再開始前の非同期処理が新戦闘を進めることを防ぎます。
   **Animation completion never replays gameplay.** Generation tokens and cancellation prevent stale callbacks from changing a restarted match.
4. **設定とルールを分けています。** HP・攻撃表・盤面・初期箱・先攻・敵パターン・シードは`definitions.ts`。箱の所有者・種類・状態は別フィールドです。
   **Data stays separate from algorithms.** Balance, terrain, starting boxes, first actor, pattern, and seed are replaceable definitions.
5. **効果の計算を小さく合成します。** HP、ゲージ、能動投入、変化、手番開始を純粋な小モジュールへ分け、通常投入と追加投入で共用します。
   **Effects compose from small pure transitions.** Shared HP, gauge, active insertion, transformation and turn-lifecycle modules avoid duplicated skill logic.

## ルール上の重要点 / Important invariants

- 起点の両側を数え、縦→横→右下がり斜め→右上がり斜めの順に1軸1回 / Count both sides, attack once per axis in the specified order
- 被攻撃者HP0後も同じ攻撃列は継続。内部HPは負値とオーバーキルを保存 / Defender death does not cancel remaining hits; exact negative HP and per-hit overkill are retained
- プレイヤーは投入・盤面スキル・使用可能な即時スキルがすべてないときだけスキップ / A player skips only when drops, board skills and usable instant skills are all unavailable
- 敵の通常投入が不能なら抽選せずHPを0にする攻撃1回。通常投入を同時に行わない / A blocked enemy replaces its drop with one lethal attack, consuming no random draw
- 受動落下は箱の位置だけを整理し、新たな能動起点・攻撃を作らない / Passive settling never creates a new active origin or attack
- 最後の投入で敵を倒したら勝利。次の敵行動はない / A winning final drop prevents the next enemy turn

## 初期版の範囲外 / Not implemented

クールダウン、未定義の追加スキル、特殊箱・状態、反射・無敵、追加手番、PvP、異形状盤面への継承、横向き射出、重力回転、複数マス箱、オンライン対戦、セーブ、ドットアニメーション。

Cooldowns, undefined extra skills, special boxes/statuses, reflection/invincibility, extra turns, PvP, different-shape carry mapping, sideways launch, gravity rotation, multi-cell boxes, networking, saves, and pixel animation remain outside this prototype.

## 検証 / Verification

**2026-10-01 の検証 / Verification:** 自動テスト、型検査、配信用ビルドは下記の `npm run check` で実行できます。最新の実行結果はコマンド出力を参照してください。Browser visual/input checks are separate from automated coverage.

`npm run check` runs the full committed automated suite plus strict typecheck and production build. Rule tests do not require a browser. Controller tests include interrupted/repeated input flows, including old animations completing after restart.

実ブラウザでの見た目・操作確認は自動ユニットテストとは別です。下記を実際の画面で確認してください。
Visual/input browser QA is separate from unit coverage. The manual checklist is:

- 初期表示、6個の天井マーク、ホバー予測、クリックとキーボード / Initial screen, six markers, hover, click, keyboard
- 内部の天井、双方の箱、HP・ログとCoreの一致 / Internal ceiling, both ownership types, matching HP/log/board
- 連打・プレイヤー落下中／敵落下中の再開始 / Repeated clicks and restart during either actor's animation
- 縦横オーバーキル、最後の投入で勝利、スキップ→即死相当 / Cross-axis overkill, last-drop win, skip→lethal replacement
- 終了後の入力ロック、同じシードの再現、狭い画面 / Terminal input lock, seeded restart, responsive layout

## 出典 / Rule authority

ver1.0の説明は、本READMEと`docs/game1_definition_redline_v1_0.*`（共通ルールの改訂定義書）、`docs/game1_content_catalog_v1_0.*`（プレイヤー・スキル・モンスターの個別カタログ）、`docs/game1_guide_v1_0.*`（操作・調整ガイド）を参照してください。作業用の計画／契約テキストも同梱します。旧版より最新の承認済み変更が優先です。
The version1.0 shared-rules specification, separate player/skill/monster catalog, and play/development guide accompany this README. Earlier working plans remain available for context.

## スキルと連続対戦（2026-10-01 試験版）

この版では設定から青／赤、最初の敵、検証盤面、シード、連続対戦を選べます。設定の変更は「この設定で再開始」で反映します。再開始ではHP・盤面・乱数・成長・撃破数を初期状態へ戻します。

- 青「痛みはお互いに」：対象の横1行を選択し、使用前の箱数による双方のダメージを確認してから使用します。行内の箱を消去し、自箱×2を敵へ、敵箱×2を自分へ同時に与えます。中立箱は消えますがダメージに数えません。空行も効果0の1手として使えます。双方がHP0ならPvE敗北です。
- 青「ヘルス」：今回の投入箱を含む自箱5個の＋形で、HPを最大値まで15回復します。起点箱は＋形のどの部分でも構いません。同じ投入につき1回だけ発動し、その後に通常のリンク攻撃を行います。形スキルはリンク方向を除外しません。
- 赤「ほむらの火種」：HPを3失った後、重複なしのランダムな敵箱を最大2個、自箱へ変えます。HP0なら変換と乱数抽選を行わず敗北します。敵箱0個でもHP3と1手を使います。
- 赤「成長する火（グローファイア）」：縦3個以上で、対応する縦の通常攻撃を「現在の3リンク火力+3」に置き換えます。縦4・5個以上でも同じ計算です。その後3リンク火力がこのステージ中だけ+1されます。縦以外の基本3リンク攻撃にも成長分を使います。
- 盤面スキルは通常投入の代わりに1手を使い、敵へ交代します。次の自分の手番でも再使用できます。盤面スキルにはクールダウンもゲージ消費もありません。変化だけが所定のゲージを消費します。
- 消去後の重力落下、所有権変更、次戦継承から新規リンクや形スキルは発動しません。

通常の連続対戦は「マルジロ → ヒキキザン → ニギリン」を循環し、自分が倒れるまで続きます。各ステージの敵最大HPは「その敵の基礎HP＋（ステージ番号−1）×10」です。開始敵を変えると、その位置から3体を循環します。メラルン選択時は独立した1敵循環の検証モードです。単独戦は設定で連続対戦を外して選べます。旧有限ルートは回帰テスト用APIとしてだけ保持しています。

| 敵 | 最大HP | 3／4／5以上リンク | 行動 |
| --- | ---: | --- | --- |
| マルジロ | 60 | 2／4／6 | 通常投入 |
| ヒキキザン | 30 | 3／10／15 | 通常投入 |
| ニギリン | 30 | 2／4／6 | 自分の5・10・15…手目は投入に代えてHP10回復（上限まで） |
| メラルン | 30 | 3／6／9 | 通常投入 |

ニギリンの回復は盤面が満杯でも実行されます。通常投入が予定されているときだけ、投入不能なら即死相当攻撃に置き換わります。

敵を倒した後は現在HPをそのまま持ち越します。上から最初に自箱が存在する横1行を選び、その行の自箱だけを同じ列位置で残して重力整理します。他の自箱・敵箱・中立箱は消去し、成長分をリセットします。現在の所有者で判定するため、奪って自箱になった箱も対象です。試験版は同じ盤面形状を維持します。

敵の追加画像は提供された背景付きPNG原本を保持しています。青／赤の原本は切り取らず表示枠だけで調整しています。メラルンの画像だけは既存の試験用背景除去版です。上部のドットアニメーションは引き続き配置用の予約スペースです。

### Quick verification / 簡易確認

`npm test` は既存の盤面・乱数・勝敗に加え、技能の発動順、相互ダメージ、自己KO、重複なし変換、回復予定、次戦継承、エンドレス進行・報酬・消耗品、再開始・中断・連打ロックを検証します。`npm run build` は型検査と配信用出力の生成を実行します。UI構造テストはブラウザー描画検査を代替しないため、実際の表示と操作はブラウザーでも確認してください。


## 変化とゲージ / Transformation and gauge

- 青は必要80・上限120、赤は必要100・上限150。ゲージは次戦へ持ち越します。左から上限に対する量を表示し、必要量未満は緑、必要量以上は虹色です。内部の表示は現在の数値だけです。
- 自分の通常手番終了で+1。新規能動投入の成立した3個以上のリンクは、各方向の実箱数×4を1回ずつ加算します。グローファイアで置き換えても重複加算しません。自分が実際に失ったHP（自己消費を含む）も同量を加算します。オーバーキル分を数えず、上限付近で倍率を下げません。
- 能動投入の形スキルと全リンク攻撃を完了した後、その投入に6個以上のリンクがあり、必要量があれば自動変化します。今回のリンク獲得分も使えます。手動ボタンはなく、1投入につき1回だけ消費し余剰を保持します。手番終了の+1はその後なので、同じ投入の変化判定へ遡りません。
- 自分または敵のHPが0になった投入では変化しません。敵を倒した場合もゲージ獲得は保持し、変化の消費をせず次戦へ渡します。変化中の再変化はありませんが、ゲージは増え続けます。
- 青：そのステージ中、自分への回復の「予定量」と同じダメージを敵へ追加します。HP満タンで実回復0でもヘルスの予定量15なら15ダメージです。回復の緑文字は実際の回復量、追加ダメージの赤文字は15を表示します。変化は攻撃後なので、発動のきっかけになった同じ投入の回復には遡って適用しません。次戦で解除します。
- 赤：次の自分の手番開始から2回、合法なエネルギー渦を一様抽選して無料の能動投入を1つ行います。通常の1手は残ります。追加投入も独自の起点で形・リンクを判定し、成長やゲージ獲得を行います。合法な渦が0なら追加投入だけをスキップし、乱数・HP・通常行動は消費しませんが残り回数は1減ります。
- 赤は2回目の追加投入を行った手番の通常行動終了まで有効です。残り回数は次戦へ持ち越します。2回目の追加投入だけで敵を倒した場合は勝利境界で解除し、3手番目へ持ち越しません。追加投入で敵を倒したら旧ステージへの通常入力を受け付けず、次戦処理を先に完了します。

Blue costs 80 (cap 120), Red 100 (cap 150). Each qualifying active axis gains raw length ×4, actual player HP loss gains ×1, and the ordinary player-turn end gains +1. One post-attack transformation gate requires an active 6+ link, sufficient charge, and both sides alive. A kill preserves charge without transformation cost. Blue adds nominal self-healing as damage until stage end. Red adds one independent active insertion at each of the next two own-turn starts, retaining the ordinary action. A blocked bonus consumes only its remaining-start count. Runtime effects and run-persistent gauge have separate lifetimes.

### 小モジュール / Composable modules

- `combatEffects.ts`: 副作用のないHP計算 / pure HP arithmetic
- `effectDispatcher.ts`: HP変化・被害充填・回復反応 / shared HP changes, charge and healing reactions
- `gauge.ts`: 定義と上限付き加算 / resource definitions and flat capped gains
- `activeDrop.ts`: 通常／無料投入が共有する起点解決 / shared active-origin resolver without turn advancement
- `transformations.ts`: 攻撃後の変化判定・終了・継承 / post-attack activation, expiry and carry
- `turnLifecycle.ts`: 1手番に1回の開始フック / idempotent start-of-turn effect
- `boardSkills.ts`: 盤面スキルの効果合成 / board-action composition
- `battle.ts`: 検証・整理・手番終了の薄い進行 / thin validated action orchestration

### 変化の検証盤面 / Transformation fixtures

「青：変化直前・縦6」は青で中央投入。「赤：変化直前・縦6」は赤で中央投入。「変化後の青：満タンのヘルス」は青で左端投入すると緑0回復→赤15ダメージ→通常リンクを確認できます。「変化後の赤：追加投入2回」は赤で再開始直後から無料投入を確認できます。これらは明示的な検証用初期値で、通常の対戦はゲージ0・未変化で始まります。

Transformation portraits use the provided original PNGs without editing, displayed whole in the same portrait frame. Activation adds a short board-outline glow; reduced motion uses a steady outline. Pixel battle animation remains unimplemented.


## 撃破報酬とビルド / Defeat rewards and builds

敵の撃破演出後に、重複しない報酬3種類を提示します。1つ選ぶかスキップすると次のステージへ進みます。候補は撃破時に1回だけ保存し、再描画・入れ替え取消では引き直しません。報酬抽選と戦闘抽選は別のシード付き乱数列です。報酬待機中は通常投入・盤面スキル・消耗品・次戦開始効果を停止します。報酬画面内の「ランを再開始」で初めから戻れます。

通常スキルは固定1枠（青ヘルス／赤グローファイア）＋自由2枠です。盤面スキルはこの3枠とは別です。自由枠が埋まったら、新しいスキルの入れ替え先を明示的に選びます。固定枠は入れ替えられません。同じ所持スキルは枠を増やさず「＋」へ1段階強化します。固定スキルも候補に出ます。すでに＋のスキルは候補から外します。

三連研磨は3リンク基礎火力＋1、大連研磨は4リンク＋1・5以上＋2です。どちらも枠を使わず、そのラン中ずっと有効です。繰り返し取得でき、通常スキルの＋上限は適用しません。段階中のグローファイア成長だけを次戦で消し、恒久的な研磨は残します。再開始では両方を初期値に戻します。

以下は試験用の仮バランスです。

| 通常スキル | 基本 → ＋ | 発動 |
| --- | --- | --- |
| ヘルス | 回復15 →20 | 自箱5個の＋形、1投入1回 |
| 成長する火 | 3リンク火力への加算3 →5 | 縦3以上。成長はどちらも＋1 |
| 蓄勢 | 終了時の合計獲得3 →4 | 通常の＋1を含む合計。内部の追加分は＋2／＋3 |
| 初撃の守り | 軽減2 →3 | 敵手番ごとの最初の正のリンク攻撃だけ。自己消費・投入不能時の即死相当は除外 |
| 横薙ぎ | 火力加算2 →4 | 横3以上の対応リンク攻撃へ1回加算 |
| 斜め撃ち | 火力加算2 →3 | 各斜め3以上の対応リンク攻撃へ1回加算 |
| 角打ち | ダメージ3 →5 | 3セルL形、回転可、1投入1回 |
| 四角打ち | ダメージ5 →8 | 2×2、1投入1回 |
| 回復ポーション | 回復予定量5 →10 | 自分の1手を消費、1回限り |
| 魔法弾 | 現在の4リンク基礎火力×2 →×3 | 自分の1手を消費、1回限り。横／斜め補正や3リンク成長は含めない |

ポーション・魔法弾も自由枠を使います。未使用の基本版を重複取得すると＋になり、使用回数は1回のままです。使い切ると枠が空き、後で再取得すると基本版になります。投入可能な渦が0でも使えます。ポーションの実回復が0でも消費します。青の変化中なら予定回復量で追加ダメージを与えます。

形スキルは実際のセル配置を図示し、回転可否も表示します。通常は90度回転を許可し、固定方向の定義は「上下固定」と表示します。新しい能動投入箱が成立形のどの部分でも構いません。同じスキルの複数形成立は1回だけ。所持スキル順で形を解決した後、既存の方向順でリンクを解決します。形はリンクを除外しません。

Run upgrades persist independently of stage growth. Three distinct seeded reward identities are committed per victory; normal duplicates upgrade in place to a single plus tier, while permanent power rewards remain repeatable. Consumables occupy flexible slots, spend an ordinary player action, and vacate the slot after one use. A reward decision always precedes next-stage carry and Red's carried start hook. Normal starter slots cannot be replaced.

### 追加モジュールとQA / Added modules and fixtures

- `app/progression.ts`: エンドレスの敵循環とHP計算
- `app/rewards.ts`: 独立乱数の候補生成、報酬適用、入れ替え条件
- `core/playerBuild.ts`: 固定／自由枠、＋強化、使用回数、恒久火力
- `core/skillCatalog.ts`: スキル名・種類・図形の定義（数値はtuning.ts）
- `core/shapePatterns.ts`: 回転・能動起点を含む形検出
- `core/instantSkills.ts`: 1手を使う消耗品の効果合成
- `ui/LoadoutView.ts` / `ui/shapeDiagram.ts`: 通常スキル枠とデータ駆動の図形
- `ui/RewardPanel.ts`: 候補を引き直さない報酬画面、古い非同期完了の遮断

「報酬：1手で撃破」は3列目で撃破。シード1は角打ち／三連研磨／四角打ち、シード7はヘルスの＋候補、シード2は魔法弾の候補が出ます。「報酬：自由枠の入れ替え」は満枠の入れ替え検証。「消耗品：ポーションと魔法弾」はHP20から2つの使い切りを検証。「形スキル：Lと2×2」は左端投入で2種類の形を順に解決。「赤：追加投入で撃破と報酬」は報酬決定まで次戦の追加投入が待機することを確認できます。


## ver1.0の調整方法 / Typed tuning

ゲームの既定挙動はv10のままです。リファクタ前に採取した102本の状態・イベント列と、同じ設定の結果が完全一致することを自動確認しています。

- 調整値の正本：`src/core/tuning.ts` の `defaultTuning`
- 個別の実験：`createTuning(overrides)` で必要な項目だけを上書きし、`BattleConfig.tuning` に渡します。既定値や呼出元のオブジェクトは変更しません。
- HP・プレイヤー基本攻撃・初期配置：従来どおり `BattleConfig.combatants` / `board` / `initialBoxes` で設定できます。名前付き敵のHP・攻撃表・回復周期はtuningの`enemies`から`createCharacterBattleConfig`が作成します。
- 調整可能な項目：盤面スキル係数、ゲージ獲得／必要量／上限、変化条件と赤の継続数、各スキルの基本／＋値・グローファイア成長量、敵データ、ステージHP加算、報酬数と研磨量
- `skills.charge` は基礎終了ゲージへの追加分です。既定値[2,3]と基礎1で、蓄勢の合計は3/4になります。UI文言も注入した値から計算します。
- 不正な負値、小数、上限不足などは開始前に拒否します。戦闘中の状態は不変です。調整を適用するには新しい設定で再開始してください。

```ts
import { createTuning, createCharacterBattleConfig, defaultConfig } from './src/core/index.ts';

const tuning = createTuning({
  skills: { health: [12, 18] },
  gauge: { limits: { blue: { cost: 60, cap: 90 } } },
  progression: { hpPerStage: 8 },
});
const config = createCharacterBattleConfig('blue', 'marujiro', {
  ...defaultConfig,
  tuning,
});
// Pass config to createBattle(...) or BattleController.restart(...).
```

Small pure helpers accept the immutable tuning explicitly or obtain it from their battle config. Omitted overrides preserve1.0 defaults. There is no dynamic script interpreter or generic rule language. Metadata stays in `skillCatalog.ts`, balance in `tuning.ts`, and resolution in small composed functions.

UI分割：`battleMarkup.ts`（構造）、`BattleSettings.ts`（設定と古い非同期適用の遮断）、`BattleLog.ts`（順序付きログ）、`BattleShell.ts`（戦闘表示と操作の調整役）。既存の`RewardPanel`・`LoadoutView`も独立しています。

検証結果：自動テスト283件、厳密なTypeScript型検査、配信用ビルド、独立監査を通過。既定挙動102ケースはリファクタ前v10の状態・イベント列と完全一致。最終公開後のブラウザー確認は、この自動検証とは分けて記録します。

## next 1.2.30: presentation responsibilities

The existing `next` gameplay, save schema and audio routing remain unchanged. Two browser-view responsibilities are now independent of the page entry point:

- `src/next/ui/battleAnimator.ts` replays already committed events in sequence. Its hooks supply rendering, audio and visual effects; it never calls the game engine or persistence. Damage feedback keeps its lead-before-HP / hold-after-HP order, and aborted actions do not add a completed-action summary.
- `src/next/ui/rewardDialog.ts` owns only the current offer's transient selection, focus and modal lifecycle. It uses the existing pure reward planner/presenter, then passes validated commands to the controller. A reload/reset clears the local selection while the controller retains the exact saved offer.

表示側の投入待ち時間は `createBattleAnimator(hooks, timing)` に設定を渡せます。既定は通常180ms／短縮15msで従来どおりです。HP・火力・ゲージなどのゲーム数値は、従来の `src/next/core/tuning.ts` と戦闘設定が引き続き所有します。演出時間を変えてもゲームの計算・乱数・保存結果へ渡しません。

`main.ts` retains the page composition, board/HUD drawing, controller wiring and save boot flow. Reward selection logic and sequential effect replay can now be tested without starting the browser entry point. No new dependency or shared game-state store was introduced.

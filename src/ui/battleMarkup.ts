import { playerPortraits, monsterPortrait } from './portraits.ts';

/** Battle structure is kept separate from behavior and tuning. */
export function battleMarkup(): string {
  return `
      <div class="app-shell">
        <header class="battle-toolbar">
          <h1><span class="brand-mark" aria-hidden="true">▧</span> 箱積みの戦場 <small>GAME1 · v1.0.0</small></h1>
          <nav class="toolbar-actions" aria-label="戦闘メニュー">
            <a class="button utility docs-link" href="/docs/index.html" target="_blank" rel="noopener">資料</a>
            <button id="open-log" class="button utility" aria-controls="log-dialog" aria-expanded="false">戦闘ログ</button>
            <button id="open-settings" class="button utility" aria-controls="settings-dialog" aria-expanded="false">設定</button>
            <button id="restart-current" class="button utility">再開始 ↻</button>
          </nav>
        </header>
        <section class="battle-stage-preview" aria-label="戦闘演出用スペース。ドットアニメーションは未実装"><div><span class="tiny-label" id="stage-label">STAGE 01</span><p id="run-status" role="status">連続対戦</p></div><span class="stage-pending">ドットアニメーション準備中</span></section>
        <main id="main" class="battle-layout" aria-label="戦闘画面">
          <aside class="status-panel player-panel" aria-label="あなたのステータスとスキル">
            <section class="combatant player" aria-labelledby="player-title">
              <div class="combatant-heading"><h2 id="player-title"><span class="owner-mark">P</span> <span id="player-name">青の子</span></h2><span class="tiny-label">PLAYER</span></div>
              <div id="player-portrait-stage" class="portrait-stage player-portrait" data-character="blue"><img id="player-portrait" src="${playerPortraits.blue.src}" alt="${playerPortraits.blue.alt}" draggable="false" /></div>
              <div class="hp-heading"><span>HP</span><strong id="player-hp">30 <i>/ 30</i></strong></div>
              <div class="hp-track"><div id="player-hp-fill"></div></div>
              <details class="attack-stat"><summary>基本攻撃</summary><p id="player-table">3リンク → 4　4 → 7　5+ → 11</p></details>
            </section>
            <section class="player-loadout" aria-label="スキルと変化">
              <div class="loadout-heading"><h2>スキル・変化</h2><span class="tiny-label" id="growth-value"></span></div>
              <div class="slot-group"><h3>盤面スキル <small>投入の代わりに1手</small></h3><button id="open-skill" class="skill-button" aria-controls="skill-target" aria-expanded="false"><strong id="board-skill-name">痛みはお互いに</strong><span id="board-skill-summary">横一列を消して相互ダメージ</span></button><section id="skill-target" class="skill-target" aria-label="盤面スキルの対象選択" hidden><p id="skill-instruction"></p><p id="skill-preview" class="skill-preview" role="status" aria-live="polite"></p><label id="skill-row-label" for="skill-row-select">対象の行<select id="skill-row-select"><option value="">行を選択</option></select></label><div class="skill-target-actions"><button id="confirm-skill" class="button primary">この行を消す</button><button id="cancel-skill" class="button secondary">取消</button></div></section></div>
              <div class="slot-group passive-group"><h3>通常スキル <small>固定1＋自由2</small></h3><div id="normal-skills"></div></div>
              <div class="slot-group transform"><h3>変化 <small id="gauge-rule">80で待機・6リンク以上</small></h3><div id="transformation-gauge" class="transformation-gauge" role="meter" aria-label="変化ゲージ" aria-valuemin="0" aria-valuemax="120" aria-valuenow="0"><div id="gauge-fill"></div><strong id="gauge-number">0</strong></div><p id="transformation-status">攻撃後に条件成立で自動発動</p></div>
            </section>
          </aside>
          <section class="board-panel" aria-label="共有盤面">
            <div class="board-stage" id="board-stage" role="img" aria-label="箱積みの共有盤面。投入先一覧ボタンからキーボードでも操作できます"></div>
            <section class="result-overlay" id="result-overlay" aria-live="polite" hidden><div class="result-card"><p class="eyebrow" id="result-kicker">VICTORY</p><h2 id="result-title">勝利</h2><p id="result-description"></p><button id="result-restart" class="button primary">同じ設定で再開始 ↻</button><small>結果表示後は、新しい行動を受け付けません</small></div></section>
          </section>
          <aside class="status-panel enemy-panel" aria-label="相手のステータスと行動予告">
            <section class="combatant enemy" aria-labelledby="enemy-title">
              <div class="combatant-heading"><h2 id="enemy-title"><span class="owner-mark">E</span> <span id="enemy-name">メラルン</span></h2><span class="tiny-label">ENEMY</span></div>
              <div class="portrait-stage enemy-portrait"><img id="enemy-portrait" src="${monsterPortrait.src}" alt="${monsterPortrait.alt}" draggable="false" /></div>
              <div class="hp-heading"><span>HP</span><strong id="enemy-hp">30 <i>/ 30</i></strong></div>
              <div class="hp-track"><div id="enemy-hp-fill"></div></div>
              <details class="attack-stat"><summary>基本攻撃</summary><p id="enemy-table">3リンク → 3　4 → 6　5+ → 9</p></details>
            </section>
            <section class="intent-card">
              <div class="intent-title"><p class="eyebrow">次の行動</p><h2 id="enemy-intent-title">通常投入</h2></div>
              <p id="enemy-intent-description">合法な天井辺からランダムに1つ</p>
              <details class="intent-warning" id="blocked-intent-warning"><summary>投入できないとき</summary><p><b>即死相当の攻撃</b>に置き換わります</p></details>
              <div class="battle-info" aria-label="手番と盤面の情報">
                <div class="turn-badge"><span>TURN <strong id="turn-number">01</strong></span><span id="turn-owner">あなたの手番</span></div>
                <span class="field-meta" id="board-dimensions">6 × 8 · ↓ 重力</span>
                <button id="open-drops" class="button secondary" aria-controls="drops-dialog" aria-expanded="false">投入先一覧</button>
                <p id="action-hint" role="status" aria-live="polite">▼ を選んで箱を投入</p>
                <div class="input-status"><span id="legal-count" class="count-badge">6 箇所</span><span id="landing-hint">▼ で着地点を予測</span></div>
              </div>
            </section>
          </aside>
        </main>
        <dialog id="reward-dialog" class="utility-dialog reward-dialog" aria-labelledby="reward-title"><div class="dialog-heading"><h2 id="reward-title">撃破報酬を1つ選択</h2></div><p class="reward-note">固定スキルは残ります。同じスキルは＋へ強化できます。</p><div id="reward-choices" class="reward-choices"></div><div id="reward-replace" hidden></div><p id="reward-error" role="alert" hidden></p><div class="reward-footer"><button id="skip-reward" class="button secondary">今回は選ばず次へ</button><button id="reward-restart" class="button utility">ランを再開始</button></div></dialog>
        <dialog id="log-dialog" class="utility-dialog log-dialog" aria-labelledby="log-title"><div class="dialog-heading"><h2 id="log-title">戦闘ログ <span id="log-counter">00 EVENTS</span></h2><button class="dialog-close" aria-label="戦闘ログを閉じる" autofocus>×</button></div><ol id="battle-log" aria-label="戦闘の処理順"></ol></dialog>
        <dialog id="settings-dialog" class="utility-dialog" aria-labelledby="settings-title"><div class="dialog-heading"><h2 id="settings-title">検証設定</h2><button class="dialog-close" aria-label="設定を閉じる" autofocus>×</button></div><div class="lab-controls"><label>キャラクター<select id="portrait-select"><option value="blue">青の子</option><option value="red">ルビィ</option></select><small>選んだキャラクターのスキルで再開始します</small></label><label>最初の敵<select id="enemy-select"><option value="marujiro">マルジロ</option><option value="hikikizan">ヒキキザン</option><option value="nigirin">ニギリン</option><option value="merarun">メラルン</option></select></label><label class="speed-option"><input id="continuous-run" type="checkbox" checked> 敵を倒したら次の対戦へ</label><label>検証盤面<select id="fixture-select"></select></label><label>乱数シード<input id="seed-input" type="number" min="0" max="4294967295" step="1" value="1"></label><label class="speed-option"><input id="reduce-motion" type="checkbox"> 演出を短くする</label><button id="apply-config" class="button secondary">この設定で再開始 ↻</button></div><p id="fixture-description"></p><p id="config-error" role="alert" hidden></p><p class="lab-note">キャラクター・敵・盤面の変更は再開始時に反映します。同じ設定・シード・入力列で再現できます。</p></dialog>

        <dialog id="drops-dialog" class="utility-dialog" aria-labelledby="drops-title"><div class="dialog-heading"><h2 id="drops-title">投入先一覧</h2><button class="dialog-close" aria-label="投入先一覧を閉じる" autofocus>×</button></div><p class="dialog-note">Tab で選択、Enter または Space で投入</p><div id="drop-options" class="drop-options"></div></dialog>
      </div>`;
}

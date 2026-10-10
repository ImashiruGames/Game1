# Game1 スキル試験場 / Skill lab 0.2

旧版とのルール比較を保ちながら、優先25案を1つずつ試せます。旧1.0画面は別保管済みで、`/` は `/next/` への入口です。実験用の仮数値であり、正式採用・正式バランスではありません。

## 開き方

1. 既存の説明どおり `start-game.bat` または `npm run dev` で起動します
2. 通常版のURLの最後に `/lab/` を付けます。通常のローカル起動なら `http://127.0.0.1:5173/lab/`
3. 上の「実験」で1案を選びます。「発動盤面」「境界盤面」は効果確認用、「自由対戦」は空の盤面です
4. 「装備なしで比較」で同じ初期盤面・HP・シードへ戻ります。もう一度押すと、直前の案を装備します
5. 盤面操作は対象選択→確認。取消・Escは手番を使いません。切断線は始点から終点の順に選びます
6. JSON保存で、以前の試行を含む全操作・HP・発動条件・乱数状態を保存できます

初期設定は折りたたまれています。キャラクター、敵、シード、自動敵行動は「試行の条件を変更」から設定できます。仕込み盤面は準備済みの能力・HPを使います。

旧1.0画面の入口と専用UIは撤去済みです。互換性比較用の旧core/appと元manifestは保持しています。実験コードは `src/lab/`、追加の検証は `tests/lab*.test.ts`。`npm run check` で全検証と両方の配信用ビルドを行います。ブラウザーの操作評価と自動の戦闘ログは別の証拠です。

English: The root now opens `/next/`; the old 1.0 UI is archived separately. Start the existing app, then open `/lab/`. Choose one proposal and use the paired reset for the exact same initial conditions. Scripted favorable/boundary boards verify mechanics; they do not establish natural activation frequency. Canceling a target is free. Exports contain reproducible state/action/event traces. The release entry and source remain separate and unchanged; no experimental skill has been promoted into production.

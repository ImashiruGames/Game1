# 戦闘速度 / Battle pacing 1.12.6

日本語: 遅・中・速は表示時間のみを変更します。「光・揺れを抑える」と端末の視差効果低減は移動・光の演出を抑えますが、選んだ速度を変更しません。変更は次の行動から反映し、既に開始した行動の弾の着弾とHP表示は同じ時刻を共有します。

English: Slow, medium and fast control presentation pacing only. App/OS reduced-motion preferences suppress motion independently, without accelerating the chosen pacing. Each committed action snapshots one immutable timing profile. Impact and displayed HP use the same boundary. No battle calculation, RNG, save, or progression rules change.

| Presentation (milliseconds) | 遅 / slow | 中 / medium | 速 / fast |
|---|---:|---:|---:|
| Drop | 270 | 180 | 15 |
| Attack lead / hold | 450 / 450 | 300 / 300 | 0 / 150 |
| Other feedback lead / hold | 150 / 750 | 100 / 500 | 0 / 150 |
| Skill name / effect | 1140 / 630 | 760 / 420 | 240 / 240 |
| Transformation total | 3150 | 2100 | 250 |
| Stage transition total | 1650 | 1100 | 250 |

日本語: 中は以前の通常、速は以前の短縮、遅は中の1.5倍の表示時間。既存shortAnimations=falseは中、trueは速として読まれ、新しいspeedがあれば優先します。保存キーは従来の演出設定のみ。進行中ランの保存は移行しません。低減時の変化・ステージ移行は静止表示で同じ表示時間を確保し、タップ省略も維持します。

English: Medium preserves the previous normal durations, fast the previous shortened durations, and slow uses 1.5× medium. Legacy shortAnimations=false maps to medium and true to fast; a valid explicit speed takes precedence. Only the existing presentation-settings record is written, never the active battle save. Static reduced-motion cinematics retain their chosen duration and can still be skipped. Interrupted presentation cancels timers and releases input without replaying committed game events.

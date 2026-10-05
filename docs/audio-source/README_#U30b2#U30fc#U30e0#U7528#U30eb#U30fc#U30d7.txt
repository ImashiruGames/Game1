Neon Undertow — ゲーム用ループ v1

02_neon_undertow_game_loop_v1.wav
48,000 Hz / stereo / PCM 24bit
2,094,545 frames / 43.63635416666666秒
loopStart 0 frame / 0秒
loopEnd 2,094,545 frame / 43.63635416666666秒（終端を含まない）

選ばれた②の譜面・楽器・和声・テンポは変更していません。
JummBox公式の未改変音源エンジンを連続4周動かし、3周の助走後の4周目を切り出しました。
残響とエコーの状態を引き継ぎ、試聴版にあった先頭と末尾のフェードは外しています。
20Hz high-passは切り出す前の全連続音声へ適用。静的gainで−18.00LUFS、true peak−2.58dBTPです。
自然な継ぎ目が周囲の通常sample変化より小さいため、クロスフェードは加えていません。

132BPM・24小節の理想長は2,094,545.4545…framesです。
実際の公式Synthの小節折返しを1sample単位で観測し、連続renderの[6,283,636, 8,378,181)を使用しました。
単一PCMループに伴う差は−0.4545sample（約9.5マイクロ秒）。音程の変更や時間伸縮は行っていません。

ゲーム側の初期設定
BGM −4.5dB、Neon攻撃SE 0dB、共通master −3dB
攻撃はフェード中も含め最大2voice。同フレームの複数hitは集約します。
このBGMとNeon攻撃3音だけの最悪ピーク合計の上界は約−2.07dBTPです。
再生開始・停止時はgainを12ms程度以上で上げ下げします。ループのたびのフェードは不要です。
AudioBufferSourceNode.loop=true を使用します。
48kHzのdecodeなら上記loopEnd、AudioContextが別sample rateへ変換した場合はdecoded AudioBuffer.durationをloopEndにして、全decoded frameを過不足なくループさせます。
MP3の遅延や末尾paddingに依存するfallback、旧oscillator BGMへのfallbackは使いません。

同名FLACはWAVと同じPCMの可逆保管用です。
native JSONとURLからJummBoxで再編集できます。
raw-f32は抽出した公式Synthの生音、master-f32は仕上げ後の量子化前原本です。
4cyclesとqa_で始まる音声は作業・検証用の大きなファイルなので、ゲーム配布ZIPへの同梱は不要です。

実聴による保証はしていません。サンプル境界、2周の連結、ピーク、無音、元譜面との一致を数値で検証しています。
詳細はasset-contract.json、render-provenance.jsonを参照してください。
公式JummBox: https://jummb.us/
Source: https://github.com/jummbus/jummbox
Commit: f745b1c83e46359227a7e324d5f05075c306ac3b

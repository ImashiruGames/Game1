import type {SampleAudioAssets} from './sampleAssets.ts';

/** 日本語: 確認済みのWAVだけを使う。音源・割当は戦闘計算から独立。
 * English: Versioned PCM assets only; no synthesized or audition-fade fallback. */
const base='/assets/audio/neon-v1/';
export const NEON_AUDIO_ASSETS:SampleAudioAssets={
 effects:{strike:{url:`${base}se01_neon_strike.wav`},crush:{url:`${base}se02_neon_crush.wav`},breaker:{url:`${base}se03_neon_breaker.wav`}},
 music:{url:`${base}02_neon_undertow_game_loop_v1.wav`,loopStartSeconds:0,loopEndSeconds:2094545/48000,startOffsetSeconds:0,loopWholeBuffer:true},
};

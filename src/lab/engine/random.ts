const UINT32_RANGE = 0x1_0000_0000;
/** 日本語: シード0も使える全周期32bit LCG。時刻やMath.randomには依存しない。
 * English: A full-period 32-bit LCG accepts seed zero and never uses time or Math.random. */
export function nextRandomUint32(state: number): number {
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}
/** 日本語: 余りの偏りを棄却抽選で避ける。空集合の呼び出しはプログラムエラー。
 * English: Rejection sampling removes modulo bias; drawing from an empty set is an error. */
export function sampleUniformIndex(state: number, count: number): { index: number; rngState: number } {
  if (!Number.isSafeInteger(count) || count < 1 || count > UINT32_RANGE) throw new Error('Random candidate count must be in 1..2^32');
  const bucketSize = Math.floor(UINT32_RANGE / count);
  const limit = bucketSize * count;
  let next = state;
  do { next = nextRandomUint32(next); } while (next >= limit);
  // 日本語: 高位側の連続バケットで選び、LCG下位ビットの短い周期を避ける。
  // English: Contiguous buckets use high bits, avoiding the short periods of LCG low bits.
  return { index: Math.floor(next / bucketSize), rngState: next };
}

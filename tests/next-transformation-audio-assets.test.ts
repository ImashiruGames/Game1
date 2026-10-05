import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CHARACTER_TRANSFORMATION_ASSETS } from '../src/next/audio/transformationAssets.ts';

test('dedicated Blue and Red PCM files match accepted native asset hashes and 0.8s stereo frame contract', () => {
  const hashes = { blue: '85a94dd41def93bf309a018239a9e6bb10348016a340d324913bf64dee0ff561', red: 'c88df5068ea91fa69fa8cad4e23cef4bf3a81e074b8b3cb6c93c362736dc5344' };
  for (const character of ['blue', 'red'] as const) {
    const asset = CHARACTER_TRANSFORMATION_ASSETS[character], wav = readFileSync(new URL(`../public${asset.url}`, import.meta.url));
    assert.equal(asset.provenance, 'dedicated-native-pcm'); assert.equal(createHash('sha256').update(wav).digest('hex'), hashes[character]);
    assert.equal(wav.length, 230502); assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    let format: Buffer | undefined, data: Buffer | undefined;
    for (let pos = 12; pos + 8 <= wav.length;) {
      const kind = wav.toString('ascii', pos, pos + 4), size = wav.readUInt32LE(pos + 4);
      if (kind === 'fmt ') format = wav.subarray(pos + 8, pos + 8 + size);
      if (kind === 'data') data = wav.subarray(pos + 8, pos + 8 + size);
      pos += 8 + size + (size % 2);
    }
    assert.ok(format); assert.ok(data);
    const tag = format.readUInt16LE(0); assert.ok(tag === 1 || tag === 65534);
    if (tag === 65534) { assert.equal(format.readUInt16LE(18), 24); assert.equal(format.readUInt32LE(24), 1); }
    assert.equal(format.readUInt16LE(2), 2);
    assert.equal(format.readUInt32LE(4), 48000); assert.equal(format.readUInt16LE(14), 24); assert.equal(data.length / 6, 38400);
    assert.deepEqual([...data.subarray(0, 6)], [0, 0, 0, 0, 0, 0]); assert.deepEqual([...data.subarray(-6)], [0, 0, 0, 0, 0, 0]);
  }
});

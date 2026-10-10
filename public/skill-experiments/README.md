# Game1 skill lab 0.2

Experimental implementations of the catalog's exact 25 priority proposals. These are not adopted production balance. Open `/lab/`; the root entry now opens `/next/`. The separately archived release1.0 UI is retired; compatibility logic, frozen traces and the original source manifest remain.

## Fair comparisons

- Exactly one proposal reserves one of two flexible slots. The fixed starter is unchanged. A043 therefore normally reduces by1, not2.
- Favorable/boundary buttons load explicit synthetic cases. They prove mechanics, not natural trigger frequency.
- Free play uses the same initial settings with and without an experiment. The paired toggle restores the preceding proposal.
- JSON export includes full initial configs, accepted/rejected actions, before/after states, actual HP events, eligible/triggered signals, drop choice snapshots and previous trials.
- Critical previews show base damage only. A057 uses an independent stream seeded `(seed XOR 0xa57f1234) >>> 0`; `sampleUniformIndex(4)` index0 is a hit. Enemy draws stay unchanged. No eligible links means no draw.
- Targeting never spends a turn; confirm spends one ordinary action. Cancel, Escape, scenario changes and restart discard the pending target.
- Manual board operations do not generate active-drop, shape, link or transformation triggers. Settling is passive.

## Explicit lab decisions

A028 reads both live HP fractions immediately before each hit. A039 caps remaining incoming primary damage after first-guard. A041 derives its reduction from the original primary amount before first-guard. A061 counts only the absolute bottom row after placement, including the new box, and affects the first primary hit. A062 sees any current owned square, not only one touching the enemy drop.

B011 requires distinct ordered endpoints on horizontal, vertical or 45-degree lines. Terrain and invalid cells stop the scan. Invalid endpoints, nonlinear segments and segments removing no boxes are rejected without cost.

D001 permits zero-actual-heal use at full HP. The use's own completion is excluded from its three subsequent normal-completion cooldown. Red bonus insertions do not advance it. The lab has individual matches, so no cooldown carry is implied. D017 treats a forced skip as a completed ordinary turn, but never treats a free insertion as one.

## Architecture and reproduction

- Retained `src/core`, `src/app`, shared portraits and compatibility helpers stay byte-identical apart from the documented Ruby label. The original baseline manifest is retained; the explicitly retired UI paths are recorded in `tests/fixtures/root-retirement.json`.
- `src/lab/engine` is a deliberately isolated snapshot; experimental changes live only here and in small lab modules
- `src/lab/tuning.ts` is the typed numerical source for experiments
- `src/lab/preparedCases.json` contains the 50 independent-review favorable/boundary cases
- `npm run check` runs existing tests, experimental tests, release-source hashes, the original102 baseline trace hashes and the same102 traces through the unequipped lab, then builds both entries

Power, trigger counts, policy outcomes and immediate choice variety are not a subjective fun score. Browser handling observations and human play feedback must remain separately labeled. No win-rate-only fun ranking is claimed.

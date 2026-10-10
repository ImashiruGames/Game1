# Root UI retirement and audit C cleanup

Source commit: `eed68074928d5be985391aeb07998c28f28cf246`. All 37 removed files matched this commit before deletion; every Git blob was verified present. No untracked data was removed.

The root `index.html` now redirects to `./next/`. `/next/` is not relocated. Lab and QA routes and their storage namespaces are unchanged. Vite configuration is unchanged to avoid restarting the user server.

Keep: `src/core`, `src/app`, `src/ui/{portraits,battlePresentation,shapeDiagram}.ts`, all shared images, lab engine, 102 frozen traces, original baseline-manifest and 33 source protection manifests. The two UI helpers are retained for tuning/shape compatibility tests.

Only the three obsolete root UI suites and the old main/Phaser render-path assertion were retired; current next/lab/QA regression suites remain. The replacement route and Pages behavior have dedicated tests.

Recovery: restore only selected paths from the source commit after checking for newer edits, for example `git restore --source=eed68074928d5be985391aeb07998c28f28cf246 -- <relative-path>`. Do not apply this to unrelated files.

## Removed files

| Path | Category | Bytes | HEAD blob |
|---|---|---:|---|
| `balance-autoplay.json` | c | 59210 | `15f700aea97a82d834ad7f8fcf8a76dfffddbb2d` |
| `public/audio-asset-preview/assets/audioAssetPreview-BcLwL8L5.js` | c | 192426 | `be7c915fd5699779ea6e60ed9f38e56c9c29562e` |
| `public/audio-asset-preview/assets/audioAssetPreview-BL_R5HH0.css` | c | 63291 | `85cf77b3587d5972ffe255dd9ef26832f02440d2` |
| `public/audio-asset-preview/assets/audioAssetPreview-BPMV-KFD.css` | c | 65840 | `1aa59ab6b6d83f7d11f4769c67d04e30b66e081e` |
| `public/audio-asset-preview/assets/audioAssetPreview-BRYznvCw.js` | c | 191414 | `2ff098b15364c86c64948500b0d315ffe1fbd3a3` |
| `public/audio-asset-preview/assets/audioAssetPreview-BsjAfzfB.js` | c | 201143 | `9b11f822fa64f2b3673001763fa817c37cd8f83a` |
| `public/audio-asset-preview/assets/audioAssetPreview-CbU8mUYG.js` | c | 192836 | `5120f51a6df5f7d37df686b0cf6754057f58cd9a` |
| `public/audio-asset-preview/assets/audioAssetPreview-CFMmPo6F.js` | c | 191212 | `62cb9215c47bb702ed660563529ead5c0a20159a` |
| `public/audio-asset-preview/assets/audioAssetPreview-CLV3uVlz.css` | c | 65723 | `97b343f25379af4d7d2dec1df2d56d08b09a9ca7` |
| `public/audio-asset-preview/assets/audioAssetPreview-CM-8x3rj.css` | c | 65093 | `bd11c5e85e601f696af006e9b73a787779b937c0` |
| `public/audio-asset-preview/assets/audioAssetPreview-CTeYP_Kc.js` | c | 201087 | `25e323576100a09e1f116324d9bc5a889b5f42d2` |
| `public/audio-asset-preview/assets/audioAssetPreview-CXkn5LwB.js` | c | 181820 | `c4f983bfe3616225af89e5e1d11e6d42579e8fd6` |
| `public/audio-asset-preview/assets/audioAssetPreview-CzMPZjkT.css` | c | 66664 | `ebe8535efe235296c52b25f373526d1fc1d154ec` |
| `public/audio-asset-preview/assets/audioAssetPreview-D5MdFvhK.js` | c | 193575 | `d27e7733c1cf325533d05a6a438d68fffbed1949` |
| `public/audio-asset-preview/assets/audioAssetPreview-Dc5oK_d0.js` | c | 200710 | `593ee201af899114bf1254b67cb6b83d02d65da6` |
| `public/audio-asset-preview/assets/audioAssetPreview-Dez2EOjC.js` | c | 204370 | `00d981ec06549d742ed4328820c60219ab5d4bbb` |
| `public/audio-asset-preview/assets/audioAssetPreview-DPbvi_QK.js` | c | 204164 | `e7e773388b4806bba10e874c3fd2101d0e58342a` |
| `public/audio-asset-preview/assets/audioAssetPreview-DruWvBys.css` | c | 63915 | `fa12790d3fce526090eac28c738d0c8010bd34ef` |
| `public/audio-asset-preview/assets/audioAssetPreview-DuXcabAx.css` | c | 56741 | `4d05c3fec4b53e6eac7059a591b536c588f6839f` |
| `public/audio-asset-preview/assets/audioAssetPreview-UnKPsOy6.js` | c | 200710 | `9992d113642cd1c6ba3318f9fac91f12bf47ccd8` |
| `public/audio-asset-preview/assets/mother-core-QusaYGB-.png` | c | 231140 | `132bd832f82882c0df6689acb12bc71d2a121ac9` |
| `public/audio-asset-preview/assets/speed-core-BMlHLkla.png` | c | 185604 | `bea793dc4f014e1fad1044b1f2873ce6c2283aad` |
| `src/main.ts` | old | 6550 | `d03d3dd97766e86d2ea104ce8b358113bb815fa5` |
| `src/style.css` | old | 22558 | `22c0ecc5f494a49386589a83e7df3d9a1c77a16d` |
| `src/ui/BattleLog.ts` | old | 4402 | `ee5c59f798f2fcf2cc83968616bba33717213ed2` |
| `src/ui/battleMarkup.ts` | old | 9734 | `861832977b1bdbf3d70e9637e06e78ff931c6b99` |
| `src/ui/BattleSettings.ts` | old | 3552 | `38edd88d7287853d53d0f2addc3daea895840d72` |
| `src/ui/BattleShell.ts` | old | 22377 | `05aa8ff9ba250650ebc234e5d28c317b12a939c5` |
| `src/ui/BoardScene.ts` | old | 16050 | `94d777d0f4de3bb4ef14f97f192deffe0fce6769` |
| `src/ui/boardViewport.ts` | old | 791 | `7d99a8a8398c6cb8e0743acbc97ec2dfab2a0e64` |
| `src/ui/dom.ts` | old | 223 | `fac78c4e1cec817345c8e617fd41262f7ed528fe` |
| `src/ui/LoadoutView.ts` | old | 3152 | `e50dd7980269a8fee6300acd723a907b035e4a35` |
| `src/ui/RewardPanel.ts` | old | 5463 | `5dc494c759a0443a887318766889fc6e43309f14` |
| `src/ui/theme.ts` | old | 541 | `82812b91c79d15d06cebfa8474a4967d10fb0629` |
| `tests/reward-ui.test.ts` | tests | 4834 | `75bfafb960702c7fb9c3f493d9604be8554f4b9d` |
| `tests/ui-layout.test.ts` | tests | 9176 | `c906ee2c9165e4ec0a9fed82e16413b6bf09f2b5` |
| `tests/ui-lifecycle.test.ts` | tests | 10789 | `3643a4023d57c99531691b15457c883ba4f7e0e8` |

Total removed: 3398880 bytes. Category C: 3278688 bytes.

Validation results are reported in the task; old verification receipts remain historical evidence.

## Validation

- Related compatibility and retirement tests: 64 passed.
- Full npm run check: 1452 passed, 0 failed; TypeScript and Vite build passed. The 24 removed assertions belonged to the retired root UI; 4 replacement route/Pages/isolation tests were added.
- Original baseline-manifest and all 33 source protection manifests unchanged.
- src/next, src/core, src/app, shared portraits/assets, Vite/TypeScript/package configuration unchanged.
- Static imports including Vite query suffixes: no missing targets.
- Normal dist and isolated Pages /Game1/ copy: all 6 requested entries and 138 reachable static resources present; no v1.0.html. Pages processing rewrote 22 text files in the temporary copy only.
- Existing server HTTP check: 127.0.0.1:5195 returned ECONNREFUSED. No server was started, stopped or restarted. Browser inventory was empty, so visual/runtime browser verification is not claimed.
- No user game tab, save data, old_game, commit, push or publication operations.

Full check log: TEMP/game1-root-cleanup-final-check.log. Related check log: TEMP/game1-cleanup-related.log.

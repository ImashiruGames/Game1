# Home — Starlight Terminal

Original home-exclusive BGM for game1. 16 bars in 4/4 at 80 BPM, exactly 48 seconds. E-major / relative C-sharp-minor harmony links the existing cyber palette while giving the home screen a warmer and more spacious identity.

The recognizable E–G-sharp–B / F-sharp–E phrase is answered by a descending C-sharp-minor figure. Four-bar phrases have deliberate rests; the middle eight rise into a contrasting upper register, then the signature returns. Six native JummBox channels provide soft FM bass, extended windowlight chords, a bell-like lead, sparse satellite answers, gentle landing pulses, and quiet clock dust. There is no battle four-on-the-floor drive or ominous boss build.

## Deliverables
- `../../public/assets/audio/home-v1/home_starlight_terminal_v1.flac`: lossless primary, stereo 48 kHz
- `../../public/assets/audio/home-v1/home_starlight_terminal_v1.wav`: PCM16 stereo 48 kHz fallback
- `projects/home_starlight_terminal_v1.jummbox.json`: fully editable native JummBox song
- `projects/home_starlight_terminal_v1.jummbox.url.txt`: native JummBox editor URL
- `checks/validation.json`: measured loudness, peaks, loop boundary, file hashes
- `checks/render-provenance.json`: renderer identity and roundtrip verification
- `official/provenance.json` and `official/LICENSE.md`: pinned upstream source hashes and license

## Provenance and reproduction
All audio voices and effects were rendered by the unmodified official JummBox Synth, commit f745b1c83e46359227a7e324d5f05075c306ac3b (same upstream version as the existing battle assets). Official source was downloaded from the URLs in `official/provenance.json`, and every source SHA-256 was checked before TypeScript compilation. No replacement oscillator or ad-hoc waveform synthesizer was used.

`compose.py` writes the original piano-roll score and instrument settings as a native project. `render.cjs` imports that project with the official Song class, exports canonical JSON and the native compact URL, verifies compact roundtrip, and renders four continuous cycles through Synth. Node globals only supply the browser title and the standard exported beepbox namespace; upstream source is unchanged. `master.py` extracts a settled cycle and applies a 40 ms smooth opening blend with its actual next-cycle continuation, preserving the exact musical duration. ffmpeg applies a static +14.26 dB mastering gain and encodes the two lossless delivery formats. No limiter, resynthesis, or lossy encoding is involved.

The files are structurally and numerically validated. Subjective audible listening was not performed in this environment; do not describe this as a listening approval. Loop validation reports the exact sample jump at the repeated-file boundary compared with ordinary adjacent-sample differences.

Runtime: load either complete file, loop the entire decoded buffer from 0 to 48 seconds, and use it only for the home scene. Route changes, mute/background handling and transition crossfades belong to the runtime audio controller.

## Repository integration
The shipping audio lives in `public/assets/audio/home-v1/`. Original export labels in `checks/validation.json` retain their `audio/` prefix. Renderer source and compiled intermediates are deliberately not vendored here: retrieve the pinned official files listed in the provenance manifest and compile them into `compiled/` before running the render harness from this directory. The score and mastering scripts are retained as reproducibility references.

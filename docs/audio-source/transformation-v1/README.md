# Dedicated transformation cues

Blue “Cognitive Ascension” and Red “Flame Ascension” use newly authored rising-charge/release notes in native JummBox projects. The official JummBox Synth produces the PCM; no audio synthesis code is bundled in the game.

The sources reuse approved instrument definitions as timbre templates, not pre-rendered attack recordings. Each cue is0.8seconds,48kHz24-bitstereo. Postprocessing is30Hz high-pass, fixed gain to−12.1dBTP and4ms/30ms edge fades. Game output still uses the existing FX/master gains.

The supplied JSON is normalized by the official app and the URL can reopen the native project. Numeric peak/clip/edge checks passed; subjective listening and realiPhone playback were not performed. These cues do not alter battle rules or saves.

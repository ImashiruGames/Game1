# Type material frames v1

Seven generated transparent 160×160 WebP material borders, 74,764 bytes combined. Normal boxes retain the clean ownership container. Each border preserves the generated transparent center, with round player and diamond enemy cores visible. The source assets live in `src/next/assets/box-frames/`.

Static QA: `frame-sheet.png` shows 24/40/60px materials. `owner-composite.png` composites the actual ownership SVG with the materials at those sizes. Every generated source has alpha 0–255 and central half-square alpha at most 1/255. Raster resizing/compression preserves transparency.

The material arrival lasts 680–850ms once, then rests. Only new box identities or actual type changes receive the presentation marker; selecting a column or opening a forecast does not replay all borders. Reduced-motion, shortened/low-performance presentation, ghosts and projections skip the effect. Existing drop/ownership animation and all box mechanics remain unchanged.

Browser motion and subjective animation quality were not verified because browser preview was unavailable. Static pixel inspection and automated markup/arrival-lifecycle checks are the available evidence.

# Isolated save QA route

`/save-preview/` is the separate QA build of Game1 1.2, with its own save key and Web Lock. `/next/` uses the production namespace. Rebuild with `npx vite build --config vite.save-preview.config.ts`; copy the resulting entry and assets into `public/save-preview/`. The static viewport wrapper tests 390×640 and390×600 without claiming iOS Safari coverage.

The archive patch records the original implementation against commit c1f2c116a91ceb03d5672cd7260bf8060da686e7. The current source is integrated under src/next. Do not apply the patch again to the integrated tree. The preview diagnostics simulate a single write failure; they are absent from the production UI. Old preview rule saves are explicitly rejected and retained until a confirmed new run.

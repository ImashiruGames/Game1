import { defineConfig } from 'vite';

export default defineConfig({
  // 日本語: 配布先の階層に依存しない相対参照。English: Keep built assets relative to the app.
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600, rolldownOptions: { input: { main: 'index.html', lab: 'lab/index.html', next: 'next/index.html', energyQa: 'energy-qa/index.html' } } },
});

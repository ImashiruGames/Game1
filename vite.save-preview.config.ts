import {defineConfig} from 'vite';
export default defineConfig({
  base:'/save-preview/',
  publicDir:false,
  build:{target:'es2022',outDir:'dist-save-preview',emptyOutDir:true,rolldownOptions:{input:{savePreview:'save-preview/index.html'}}},
});

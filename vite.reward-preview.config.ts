import {defineConfig} from 'vite';
export default defineConfig({
  base:'/build-card-preview/',
  publicDir:false,
  build:{target:'es2022',outDir:'dist-build-card-preview',emptyOutDir:true,rolldownOptions:{input:{rewardPreview:'build-card-preview/index.html'}}},
});

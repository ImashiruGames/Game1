import {defineConfig} from 'vite';
export default defineConfig({base:'/audio-asset-preview/',publicDir:false,build:{target:'es2022',outDir:'dist-audio-asset-preview',emptyOutDir:true,rolldownOptions:{input:{audioAssetPreview:'audio-asset-preview/index.html'}}}});

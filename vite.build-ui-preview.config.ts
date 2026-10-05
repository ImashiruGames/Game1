import {defineConfig} from 'vite';
export default defineConfig({base:'/build-ui-preview/',publicDir:false,build:{target:'es2022',outDir:'dist-build-ui-preview',emptyOutDir:true,rolldownOptions:{input:{buildUiPreview:'build-ui-preview/index.html'}}}});

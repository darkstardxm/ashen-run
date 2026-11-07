import { defineConfig } from 'vite';
// /assets is served as the public root: assets/art/... -> ./art/... in the build.
export default defineConfig({ base: './', publicDir: 'assets', build: { outDir: 'dist', target: 'es2020' } });

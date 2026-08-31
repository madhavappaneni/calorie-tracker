import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages project path (spec §3) so hashed asset URLs
// resolve under https://madhavappaneni.github.io/calorie-tracker/
export default defineConfig({
  base: '/calorie-tracker/',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});

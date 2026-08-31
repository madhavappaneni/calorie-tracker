import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages project path (spec §3) so hashed asset URLs
// resolve under https://madhavappaneni.github.io/calorie-tracker/
export default defineConfig({
  base: '/calorie-tracker/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Without this the CSS minifier rewrites media queries to range syntax
    // (`@media (width<=639px)`), which Safari below 16.4 does not parse — it
    // would drop the phone layout and dark mode wholesale on an older iPhone.
    cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'],
  },
});

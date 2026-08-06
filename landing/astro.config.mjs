// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages deployment configuration
  site: 'https://CharlieCardenasToledo.github.io',
  base: '/instructional-designer-skill/', // Required for GitHub Pages subdirectory deployment
  vite: {
    plugins: [tailwindcss()],
  },
});

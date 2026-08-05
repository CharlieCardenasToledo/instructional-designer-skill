// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://CharlieCardenasToledo.github.io',
  base: '/instructional-designer-skill',
  vite: {
    plugins: [tailwindcss()],
  },
});
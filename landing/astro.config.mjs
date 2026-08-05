// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const isProd = process.env.CI === 'true';

export default defineConfig({
  site: 'https://CharlieCardenasToledo.github.io',
  base: isProd ? '/instructional-designer-skill' : '/',
  vite: {
    plugins: [tailwindcss()],
  },
});
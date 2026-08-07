// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Custom domain deployment (penke.charliecardenastoledo.com)
  site: 'http://penke.charliecardenastoledo.com',
  base: '/', // Assets served from root domain, not subdirectory
  vite: {
    plugins: [tailwindcss()],
  },
});

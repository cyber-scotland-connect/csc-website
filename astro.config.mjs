import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const isGithubPages = process.env.GITHUB_ACTIONS === 'true';

// https://astro.build/config
export default defineConfig({
  site: 'https://cyber-scotland-connect.github.io',
  base: isGithubPages ? '/csc-website' : '/',
  vite: {
    plugins: [tailwindcss()],
  },
});

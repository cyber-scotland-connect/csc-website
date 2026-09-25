import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

const isGithubPages = process.env.GITHUB_ACTIONS === 'true';
const commitSha = process.env.GITHUB_SHA ?? 'local';

// https://astro.build/config
export default defineConfig({
  site: 'https://cyberscotlandconnect.com',
  base: '/',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      __COMMIT_SHA__: JSON.stringify(commitSha),
    },
  },
});

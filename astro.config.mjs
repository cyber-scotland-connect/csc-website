import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

const commitSha = process.env.GITHUB_SHA ?? 'local';
const redirectSlugs = ['/leaders', '/discord', '/support', '/payitforward', '/speak'];

// https://astro.build/config
export default defineConfig({
  site: 'https://cyberscotlandconnect.com',
  base: '/',
  integrations: [
    sitemap({
      filter: (page) => !redirectSlugs.some((slug) => page.includes(slug)),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    define: {
      __COMMIT_SHA__: JSON.stringify(commitSha),
    },
  },
});

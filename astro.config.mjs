import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { ARTICLE_REDIRECTS } from './src/lib/article-redirects.ts';
import { SITE_URL } from './src/lib/constants.ts';

export default defineConfig({
  site: SITE_URL,
  integrations: [mdx()],
  redirects: ARTICLE_REDIRECTS,
});

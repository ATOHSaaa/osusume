import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { SITE_URL } from './src/lib/constants.ts';

export default defineConfig({
  site: SITE_URL,
  integrations: [mdx()],
});

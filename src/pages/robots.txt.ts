import { SITEMAP_PATH, SITE_URL } from '../lib/constants';
import { absoluteUrl } from '../lib/site-url';
import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  const site = context.site ?? SITE_URL;
  const sitemapUrl = absoluteUrl(SITEMAP_PATH, site);

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

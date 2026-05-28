import { getCollection } from 'astro:content';
import {
  AUTHOR_LIST_PATH,
  GENRE_LIST_PATH,
  SITE_URL,
} from '../lib/constants';
import { sortArticlesByUpdated } from '../lib/articles';
import { absoluteUrl } from '../lib/site-url';
import type { APIContext } from 'astro';

function formatLastmod(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(context: APIContext) {
  const site = context.site ?? SITE_URL;
  const articles = (await getCollection('articles')).sort(sortArticlesByUpdated);
  const latestUpdate = articles[0]?.data.updated_at ?? new Date();

  const staticPages = [
    { path: '/', lastmod: latestUpdate },
    { path: AUTHOR_LIST_PATH, lastmod: latestUpdate },
    { path: GENRE_LIST_PATH, lastmod: latestUpdate },
  ];

  const urls = [
    ...staticPages.map(({ path, lastmod }) => ({
      loc: absoluteUrl(path, site),
      lastmod: formatLastmod(lastmod),
    })),
    ...articles.map((article) => ({
      loc: absoluteUrl(`/articles/${article.slug}/`, site),
      lastmod: formatLastmod(article.data.updated_at),
    })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}

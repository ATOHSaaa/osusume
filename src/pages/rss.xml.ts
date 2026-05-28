import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../lib/constants';
import { sortArticlesByUpdated } from '../lib/articles';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const articles = (await getCollection('articles')).sort(sortArticlesByUpdated);

  return rss({
    title: `${SITE_NAME} — 本のおすすめランキング`,
    description: SITE_DESCRIPTION,
    site: context.site ?? SITE_URL,
    language: 'ja',
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
    },
    customData: `<atom:link href="${new URL('rss.xml', context.site ?? `${SITE_URL}/`).href}" rel="self" type="application/rss+xml" />`,
    items: articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.updated_at,
      link: `/articles/${article.slug}/`,
      categories: article.data.tags,
    })),
  });
}

import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { generateArticleOgImage } from '../../../lib/og-image';

export const getStaticPaths = (async () => {
  const articles = await getCollection('articles');

  return articles.map((article) => ({
    params: { slug: article.slug },
    props: { article },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { article } = props as {
    article: Awaited<ReturnType<typeof getCollection<'articles'>>>[number];
  };

  const png = await generateArticleOgImage({
    title: article.data.title,
    description: article.data.description,
    author: article.data.author,
    coverImageUrl: article.data.books[0]?.imageUrl,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

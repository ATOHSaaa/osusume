import type { APIRoute, GetStaticPaths } from 'astro';
import { AWARD_BY_SLUG } from '../../../lib/awards/registry';
import type { AwardDefinition } from '../../../lib/awards/types';
import { generatePageOgImage } from '../../../lib/og-image';

export const getStaticPaths = (() => {
  return [...AWARD_BY_SLUG.values()].map((award) => ({
    params: { slug: award.slug },
    props: { award },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { award } = props as { award: AwardDefinition };

  const png = await generatePageOgImage({
    title: `${award.name}受賞作一覧`,
    subtitle: award.description,
    badge: '文学賞',
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

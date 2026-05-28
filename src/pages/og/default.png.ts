import type { APIRoute } from 'astro';
import { generateDefaultOgImage } from '../../lib/og-image';

export const GET: APIRoute = async () => {
  const png = await generateDefaultOgImage();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

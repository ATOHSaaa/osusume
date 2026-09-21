import type { APIRoute } from 'astro';
import { generateLogoPng } from '../../lib/og-image';

export const GET: APIRoute = async () => {
  const png = await generateLogoPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

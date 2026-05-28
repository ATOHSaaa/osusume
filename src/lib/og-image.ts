import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import sharp from 'sharp';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './constants';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_PATH = '/og/default.png';

const libDir = dirname(fileURLToPath(import.meta.url));
const fontDir = join(libDir, '../../node_modules/@fontsource/noto-sans-jp/files');

type SatoriNode = {
  type: string;
  props: Record<string, unknown>;
  children?: SatoriNode[] | string;
};

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
};

let fontsPromise: Promise<OgFont[]> | null = null;

async function loadFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(fontDir, 'noto-sans-jp-japanese-400-normal.woff')),
      readFile(join(fontDir, 'noto-sans-jp-japanese-700-normal.woff')),
    ]).then(([regular, bold]) => [
      {
        name: 'Noto Sans JP',
        data: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength),
        weight: 400,
        style: 'normal',
      },
      {
        name: 'Noto Sans JP',
        data: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength),
        weight: 700,
        style: 'normal',
      },
    ]);
  }

  return fontsPromise;
}

export function getArticleOgImagePath(slug: string): string {
  return `/og/articles/${slug}.png`;
}

/** Amazon 書影 URL を OG 用の大きめサイズへ */
export function getLargerAmazonImageUrl(url: string): string {
  return url.replace(/_S[CLXY]\d+_/g, '_SL500_');
}

async function fetchImageAsDataUrl(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;

  try {
    const response = await fetch(getLargerAmazonImageUrl(url), {
      headers: { 'User-Agent': 'FirstBooksOgImage/1.0' },
    });
    if (!response.ok) return undefined;

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) return undefined;

    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function getTitleFontSize(title: string): number {
  if (title.length > 42) return 40;
  if (title.length > 32) return 46;
  if (title.length > 24) return 52;
  return 58;
}

function buildBaseLayout(options: {
  title: string;
  subtitle: string;
  badge?: string;
  coverDataUrl?: string;
  footer?: string;
}): SatoriNode {
  const titleFontSize = getTitleFontSize(options.title);

  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        padding: '56px 64px',
        backgroundColor: '#faf9f7',
        fontFamily: 'Noto Sans JP',
      },
    },
    children: [
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
            paddingRight: options.coverDataUrl ? 48 : 0,
          },
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              },
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  },
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 28,
                        fontWeight: 700,
                        color: '#c2410c',
                        letterSpacing: '0.04em',
                      },
                    },
                    children: SITE_NAME,
                  },
                  ...(options.badge
                    ? [
                        {
                          type: 'div',
                          props: {
                            style: {
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#ffffff',
                              backgroundColor: '#c2410c',
                              borderRadius: 999,
                              padding: '6px 14px',
                            },
                          },
                          children: options.badge,
                        },
                      ]
                    : []),
                ],
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: titleFontSize,
                    fontWeight: 700,
                    color: '#1a1a1a',
                    lineHeight: 1.25,
                    maxWidth: options.coverDataUrl ? 620 : 980,
                  },
                },
                children: truncateText(options.title, 56),
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 26,
                    color: '#6b7280',
                    lineHeight: 1.5,
                    maxWidth: options.coverDataUrl ? 620 : 980,
                  },
                },
                children: truncateText(options.subtitle, 72),
              },
            ],
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 22,
                color: '#9ca3af',
              },
            },
            children: options.footer ?? new URL(SITE_URL).host,
          },
        ],
      },
      ...(options.coverDataUrl
        ? [
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 320,
                },
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 280,
                      height: 420,
                      backgroundColor: '#ffffff',
                      borderRadius: 16,
                      boxShadow: '0 24px 48px rgba(0, 0, 0, 0.14)',
                      overflow: 'hidden',
                    },
                  },
                  children: [
                    {
                      type: 'img',
                      props: {
                        src: options.coverDataUrl,
                        width: 280,
                        height: 420,
                        style: {
                          objectFit: 'contain',
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ]
        : []),
    ],
  };
}

async function renderOgPng(element: SatoriNode): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(element, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function generateDefaultOgImage(): Promise<Buffer> {
  return renderOgPng(
    buildBaseLayout({
      title: '本のおすすめランキング',
      subtitle: SITE_DESCRIPTION,
      footer: new URL(SITE_URL).host,
    })
  );
}

export async function generateArticleOgImage(options: {
  title: string;
  description: string;
  author: string;
  coverImageUrl?: string;
}): Promise<Buffer> {
  const coverDataUrl = await fetchImageAsDataUrl(options.coverImageUrl);

  return renderOgPng(
    buildBaseLayout({
      title: options.title,
      subtitle: truncateText(options.description, 72),
      badge: options.author,
      coverDataUrl,
      footer: new URL(SITE_URL).host,
    })
  );
}

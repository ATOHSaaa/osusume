import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import sharp from 'sharp';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './constants';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const DEFAULT_OG_IMAGE_PATH = '/og/default.png';
export const SITE_LOGO_PATH = '/og/logo.png';
export const SITE_LOGO_WIDTH = 512;
export const SITE_LOGO_HEIGHT = 512;

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
  lang?: 'ja-JP';
};

let fontsPromise: Promise<OgFont[]> | null = null;

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function loadFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(fontDir, 'noto-sans-jp-latin-400-normal.woff')),
      readFile(join(fontDir, 'noto-sans-jp-latin-700-normal.woff')),
      readFile(join(fontDir, 'noto-sans-jp-japanese-400-normal.woff')),
      readFile(join(fontDir, 'noto-sans-jp-japanese-700-normal.woff')),
    ]).then(([latinRegular, latinBold, japaneseRegular, japaneseBold]) => [
      { name: 'Noto Sans JP', data: bufferToArrayBuffer(latinRegular), weight: 400, style: 'normal' },
      { name: 'Noto Sans JP', data: bufferToArrayBuffer(latinBold), weight: 700, style: 'normal' },
      {
        name: 'Noto Sans JP Japanese',
        data: bufferToArrayBuffer(japaneseRegular),
        weight: 400,
        style: 'normal',
        lang: 'ja-JP' as const,
      },
      {
        name: 'Noto Sans JP Japanese',
        data: bufferToArrayBuffer(japaneseBold),
        weight: 700,
        style: 'normal',
        lang: 'ja-JP' as const,
      },
    ]);
  }

  return fontsPromise;
}

/** Satori は React 要素形式（children は props 内）を要求する */
function toSatoriElement(node: SatoriNode | string): SatoriNode | string {
  if (typeof node === 'string') return node;

  const nested = node.children ?? node.props.children;
  const children = Array.isArray(nested) ? nested.map(toSatoriElement) : nested;

  return {
    type: node.type,
    props: {
      ...node.props,
      ...(children !== undefined ? { children } : {}),
    },
  };
}

export function getArticleOgImagePath(slug: string): string {
  return `/og/articles/${slug}.png`;
}

export function getAwardOgImagePath(slug: string): string {
  return `/og/awards/${slug}.png`;
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
    const png = await sharp(buffer)
      .rotate()
      .resize(560, 840, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
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
        fontFamily: 'Noto Sans JP, Noto Sans JP Japanese',
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
  const svg = await satori(toSatoriElement(element), {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts,
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function generateArticleOgImage(options: {
  title: string;
  description: string;
  author: string;
  coverImageUrl?: string;
}): Promise<Buffer> {
  const coverDataUrl = await fetchImageAsDataUrl(options.coverImageUrl);
  const layout = {
    title: options.title,
    subtitle: truncateText(options.description, 72),
    badge: options.author,
    footer: new URL(SITE_URL).host,
  };

  try {
    return await renderOgPng(
      buildBaseLayout({
        ...layout,
        coverDataUrl,
      })
    );
  } catch (error) {
    if (!coverDataUrl) throw error;
    return renderOgPng(buildBaseLayout(layout));
  }
}

export async function generatePageOgImage(options: {
  title: string;
  subtitle: string;
  badge?: string;
}): Promise<Buffer> {
  return renderOgPng(
    buildBaseLayout({
      title: options.title,
      subtitle: truncateText(options.subtitle, 72),
      badge: options.badge,
      footer: new URL(SITE_URL).host,
    })
  );
}

export async function generateDefaultOgImage(): Promise<Buffer> {
  return generatePageOgImage({
    title: 'おすすめ小説・漫画のランキング',
    subtitle: SITE_DESCRIPTION,
    badge: 'おすすめ本',
  });
}

export async function generateLogoPng(): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(toSatoriElement({
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#c2410c',
        fontFamily: 'Noto Sans JP, Noto Sans JP Japanese',
      },
    },
    children: [
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 28,
          },
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                width: 180,
              },
            },
            children: [
              { type: 'div', props: { style: { height: 18, width: '100%', backgroundColor: '#ffffff' } }, children: '' },
              { type: 'div', props: { style: { height: 18, width: '75%', backgroundColor: '#ffffff' } }, children: '' },
              { type: 'div', props: { style: { height: 18, width: '88%', backgroundColor: '#ffffff' } }, children: '' },
            ],
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 48,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.04em',
              },
            },
            children: SITE_NAME,
          },
        ],
      },
    ],
  }), {
    width: SITE_LOGO_WIDTH,
    height: SITE_LOGO_HEIGHT,
    fonts,
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

import {
  AUTHOR_LIST_PATH,
  AWARDS_HUB_PATH,
  GENRE_LIST_PATH,
  MANGA_LIST_PATH,
  MAX_BOOKS,
  SITE_NAME,
} from './constants';
import { absoluteUrl } from './site-url';
import {
  getArticleOgImagePath,
  SITE_LOGO_HEIGHT,
  SITE_LOGO_PATH,
  SITE_LOGO_WIDTH,
} from './og-image';

type JsonLd = Record<string, unknown>;

export interface BreadcrumbItem {
  name: string;
  path: string;
}

interface ArticleBook {
  title: string;
  author?: string;
  amazonUrl?: string;
  imageUrl?: string;
}

function buildPublisher(site: URL | string | undefined): JsonLd {
  return {
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/', site),
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl(SITE_LOGO_PATH, site),
      width: SITE_LOGO_WIDTH,
      height: SITE_LOGO_HEIGHT,
    },
  };
}

export function buildOrganizationJsonLd(site: URL | string | undefined): JsonLd {
  return {
    '@context': 'https://schema.org',
    ...buildPublisher(site),
  };
}

export function buildWebSiteJsonLd(
  site: URL | string | undefined,
  description: string
): JsonLd {
  const origin = absoluteUrl('/', site);

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: origin,
    description,
    inLanguage: 'ja-JP',
    publisher: buildPublisher(site),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbJsonLd(
  site: URL | string | undefined,
  items: BreadcrumbItem[]
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, site),
    })),
  };
}

export function buildArticleJsonLd(options: {
  site: URL | string | undefined;
  title: string;
  description: string;
  author: string;
  path: string;
  publishedAt: Date;
  updatedAt: Date;
  imageUrl?: string;
  keywords?: string[];
  articleSection?: string;
}): JsonLd {
  const pageUrl = absoluteUrl(options.path, options.site);

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: options.title,
    description: options.description,
    datePublished: options.publishedAt.toISOString(),
    dateModified: options.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: options.author,
    },
    publisher: buildPublisher(options.site),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
    url: pageUrl,
    inLanguage: 'ja-JP',
    ...(options.imageUrl && { image: [options.imageUrl] }),
    ...(options.keywords?.length && { keywords: options.keywords.join(',') }),
    ...(options.articleSection && { articleSection: options.articleSection }),
  };
}

export function buildItemListJsonLd(options: {
  site: URL | string | undefined;
  title: string;
  path: string;
  books: ArticleBook[];
  limit?: number;
}): JsonLd {
  const rankedBooks =
    options.limit === undefined
      ? options.books.slice(0, MAX_BOOKS)
      : options.books.slice(0, options.limit);

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: options.title,
    url: absoluteUrl(options.path, options.site),
    numberOfItems: rankedBooks.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: rankedBooks.map((book, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Book',
        name: book.title,
        ...(book.author && {
          author: {
            '@type': 'Person',
            name: book.author,
          },
        }),
        ...(book.amazonUrl && { url: book.amazonUrl }),
        ...(book.imageUrl && { image: book.imageUrl }),
      },
    })),
  };
}

export function articleCategoryMeta(kind: 'author' | 'genre' | 'manga'): {
  path: string;
  name: string;
} {
  if (kind === 'genre') {
    return { path: GENRE_LIST_PATH, name: 'ジャンル別のおすすめ' };
  }
  if (kind === 'manga') {
    return { path: MANGA_LIST_PATH, name: '漫画のおすすめ' };
  }
  return { path: AUTHOR_LIST_PATH, name: '作家別のおすすめ' };
}

export function buildArticlePageJsonLd(options: {
  site: URL | string | undefined;
  title: string;
  description: string;
  author: string;
  path: string;
  publishedAt: Date;
  updatedAt: Date;
  kind: 'author' | 'genre' | 'manga';
  books: ArticleBook[];
  keywords?: string[];
}): JsonLd[] {
  const category = articleCategoryMeta(options.kind);
  const slug = options.path.replace(/^\/articles\//, '').replace(/\/$/, '');
  const ogImageUrl = absoluteUrl(getArticleOgImagePath(slug), options.site);

  return [
    buildBreadcrumbJsonLd(options.site, [
      { name: 'ホーム', path: '/' },
      { name: category.name, path: category.path },
      { name: options.title, path: options.path },
    ]),
    buildArticleJsonLd({
      site: options.site,
      title: options.title,
      description: options.description,
      author: options.author,
      path: options.path,
      publishedAt: options.publishedAt,
      updatedAt: options.updatedAt,
      imageUrl: ogImageUrl,
      keywords: options.keywords,
      articleSection: category.name,
    }),
    buildItemListJsonLd({
      site: options.site,
      title: options.title,
      path: options.path,
      books: options.books,
    }),
  ];
}

export function buildCategoryPageJsonLd(options: {
  site: URL | string | undefined;
  title: string;
  description: string;
  path: string;
  parents?: BreadcrumbItem[];
  pageType?: 'CollectionPage' | 'AboutPage' | 'ContactPage' | 'WebPage';
  awardName?: string;
  books?: ArticleBook[];
}): JsonLd[] {
  const crumbs: BreadcrumbItem[] = [
    { name: 'ホーム', path: '/' },
    ...(options.parents ?? []),
    { name: options.title, path: options.path },
  ];

  const schemas: JsonLd[] = [
    buildBreadcrumbJsonLd(options.site, crumbs),
    {
      '@context': 'https://schema.org',
      '@type': options.pageType ?? 'CollectionPage',
      name: options.title,
      description: options.description,
      url: absoluteUrl(options.path, options.site),
      inLanguage: 'ja-JP',
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: absoluteUrl('/', options.site),
      },
      ...(options.awardName && {
        about: {
          '@type': 'Award',
          name: options.awardName,
        },
      }),
    },
  ];

  if (options.books?.length) {
    schemas.push(
      buildItemListJsonLd({
        site: options.site,
        title: options.title,
        path: options.path,
        books: options.books,
        limit: options.books.length,
      })
    );
  }

  return schemas;
}

export function awardHubBreadcrumb(): BreadcrumbItem {
  return { name: '文学賞・新人賞のまとめ', path: AWARDS_HUB_PATH };
}

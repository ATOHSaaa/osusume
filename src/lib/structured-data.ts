import {
  AUTHOR_LIST_PATH,
  GENRE_LIST_PATH,
  MAX_BOOKS,
  SITE_NAME,
} from './constants';
import { absoluteUrl } from './site-url';
import { getArticleOgImagePath } from './og-image';

type JsonLd = Record<string, unknown>;

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface ArticleBook {
  title: string;
  author?: string;
  amazonUrl?: string;
  imageUrl?: string;
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
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
    url: pageUrl,
    inLanguage: 'ja-JP',
    ...(options.imageUrl && { image: [options.imageUrl] }),
  };
}

export function buildItemListJsonLd(options: {
  site: URL | string | undefined;
  title: string;
  path: string;
  books: ArticleBook[];
}): JsonLd {
  const rankedBooks = options.books.slice(0, MAX_BOOKS);

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

export function buildArticlePageJsonLd(options: {
  site: URL | string | undefined;
  title: string;
  description: string;
  author: string;
  path: string;
  publishedAt: Date;
  updatedAt: Date;
  kind: 'author' | 'genre';
  books: ArticleBook[];
}): JsonLd[] {
  const categoryPath = options.kind === 'genre' ? GENRE_LIST_PATH : AUTHOR_LIST_PATH;
  const categoryName = options.kind === 'genre' ? 'ジャンル別のおすすめ' : '作家別のおすすめ';
  const slug = options.path.replace(/^\/articles\//, '').replace(/\/$/, '');
  const ogImageUrl = absoluteUrl(getArticleOgImagePath(slug), options.site);

  return [
    buildBreadcrumbJsonLd(options.site, [
      { name: 'ホーム', path: '/' },
      { name: categoryName, path: categoryPath },
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
}): JsonLd[] {
  return [
    buildBreadcrumbJsonLd(options.site, [
      { name: 'ホーム', path: '/' },
      { name: options.title, path: options.path },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: options.title,
      description: options.description,
      url: absoluteUrl(options.path, options.site),
      inLanguage: 'ja-JP',
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: absoluteUrl('/', options.site),
      },
    },
  ];
}

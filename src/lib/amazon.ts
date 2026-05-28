import {
  ApiClient,
  DefaultApi,
  SearchItemsRequestContent,
} from 'amazon-creator-api-sdk';
import { AMAZON_ENRICH_CANDIDATE_LIMIT, MAX_BOOKS } from './constants';
import { isAdultContent } from './adult-content';
import { isMatchingAuthor } from './author-match';
import {
  cleanBookTitleForSearch,
  detectBookFormat,
  getFormatPriority,
  getSeriesVolumePenalty,
  isForeignEditionProduct,
  isGuideOrCommentaryProduct,
  isLaterSeriesVolume,
  isMangaProduct,
  isYouthAbridgedProduct,
  pickPreferredSearchItem,
} from './book-format';
import {
  getKnownBookAuthor,
  isBookByOtherAuthor,
  isExcludedBook,
  resolveCanonicalBookTitle,
} from './book-extractor';
import type { AmazonProduct, BookMention } from './types';

let apiClient: DefaultApi | null = null;

function trim(value: string | undefined): string | undefined {
  return value?.trim();
}

function getConfig() {
  const credentialId = trim(process.env.AMAZON_CREDENTIAL_ID);
  const credentialSecret = trim(process.env.AMAZON_CREDENTIAL_SECRET);
  const version = trim(process.env.AMAZON_CREDENTIAL_VERSION) ?? '3.3';
  const partnerTag = trim(process.env.AMAZON_PARTNER_TAG);
  const marketplace = trim(process.env.AMAZON_MARKETPLACE) ?? 'www.amazon.co.jp';

  if (!credentialId || !credentialSecret || !partnerTag) {
    return null;
  }

  return { credentialId, credentialSecret, version, partnerTag, marketplace };
}

function getApi(): DefaultApi | null {
  const config = getConfig();
  if (!config) return null;

  if (!apiClient) {
    const client = new ApiClient();
    client.credentialId = config.credentialId;
    client.credentialSecret = config.credentialSecret;
    client.version = config.version;
    apiClient = new DefaultApi(client);
  }

  return apiClient;
}

function buildAffiliateUrl(detailUrl: string, partnerTag: string): string {
  try {
    const url = new URL(detailUrl);
    url.searchParams.set('tag', partnerTag);
    return url.toString();
  } catch {
    return detailUrl;
  }
}

interface SearchItem {
  asin?: string;
  detailPageURL?: string;
  images?: {
    primary?: {
      medium?: { url?: string };
      large?: { url?: string };
    };
  };
  itemInfo?: {
    title?: { displayValue?: string };
    byLineInfo?: {
      contributors?: Array<{ name?: string; role?: string }>;
    };
    classifications?: {
      binding?: { displayValue?: string };
      productGroup?: { displayValue?: string };
    };
  };
  offersV2?: {
    listings?: Array<{
      price?: {
        money?: { displayAmount?: string };
      };
    }>;
  };
}

function getItemAuthors(item: SearchItem): string | undefined {
  const contributors = item.itemInfo?.byLineInfo?.contributors ?? [];
  const names = contributors
    .map((c) => c.name?.trim())
    .filter((name): name is string => Boolean(name));

  if (names.length > 0) return [...new Set(names)].join('、');
  return undefined;
}

function toFormatSource(item: SearchItem) {
  return {
    title: item.itemInfo?.title?.displayValue,
    binding: item.itemInfo?.classifications?.binding?.displayValue,
    productGroup: item.itemInfo?.classifications?.productGroup?.displayValue,
    author: getItemAuthors(item),
  };
}

function parseSearchItem(
  item: SearchItem,
  partnerTag: string
): AmazonProduct | null {
  const asin = item.asin;
  const title = item.itemInfo?.title?.displayValue;
  const detailUrl = item.detailPageURL;

  if (!asin || !title) return null;

  const author = getItemAuthors(item);

  const imageUrl =
    item.images?.primary?.medium?.url ??
    item.images?.primary?.large?.url;

  const price =
    item.offersV2?.listings?.[0]?.price?.money?.displayAmount;

  return {
    asin,
    title,
    author,
    imageUrl,
    price,
    amazonUrl: detailUrl
      ? buildAffiliateUrl(detailUrl, partnerTag)
      : `https://www.amazon.co.jp/dp/${asin}?tag=${partnerTag}`,
  };
}

export async function searchAmazonBook(
  bookTitle: string,
  authorName?: string
): Promise<AmazonProduct | null> {
  const config = getConfig();
  const api = getApi();

  if (!config || !api) return null;

  const canonicalTitle = resolveCanonicalBookTitle(bookTitle);
  const keywords = cleanBookTitleForSearch(canonicalTitle);
  if (!keywords) return null;

  let product = await searchAmazonByKeywords(
    api,
    config,
    keywords,
    canonicalTitle,
    authorName
  );

  if (authorName) {
    await sleep(600);
    const withAuthor = await searchAmazonByKeywords(
      api,
      config,
      `${keywords} ${authorName}`,
      bookTitle,
      authorName
    );
    product = pickBetterProduct(product, withAuthor, authorName);
  }

  return product && isProductAcceptable(product, authorName) ? product : null;
}

function isProductAcceptable(
  product: AmazonProduct,
  expectedAuthor?: string
): boolean {
  if (isAdultContent({ title: product.title })) return false;
  if (isMangaProduct({ title: product.title })) return false;
  if (isGuideOrCommentaryProduct({ title: product.title })) return false;
  if (isYouthAbridgedProduct({ title: product.title })) return false;
  if (isForeignEditionProduct({ title: product.title })) return false;
  if (/レンタル落ち|中古品/.test(product.title)) return false;
  if (!expectedAuthor || !product.author) return true;
  return isMatchingAuthor(expectedAuthor, product.author);
}

function pickBetterProduct(
  a: AmazonProduct | null,
  b: AmazonProduct | null,
  expectedAuthor?: string
): AmazonProduct | null {
  const priorityA = a ? productScore(a, expectedAuthor) : Infinity;
  const priorityB = b ? productScore(b, expectedAuthor) : Infinity;

  if (priorityA === Infinity && priorityB === Infinity) return null;
  if (priorityA <= priorityB) return a;
  return b;
}

function productScore(product: AmazonProduct, expectedAuthor?: string): number {
  if (isAdultContent({ title: product.title })) return Infinity;
  const format = detectBookFormat({ title: product.title });
  if (format === 'excluded' || format === 'bundle') return Infinity;
  if (isMangaProduct({ title: product.title })) return Infinity;
  if (isGuideOrCommentaryProduct({ title: product.title })) return Infinity;
  if (isYouthAbridgedProduct({ title: product.title })) return Infinity;
  if (isForeignEditionProduct({ title: product.title })) return Infinity;
  if (expectedAuthor && product.author && !isMatchingAuthor(expectedAuthor, product.author)) {
    return Infinity;
  }
  return getFormatPriority(format) + getSeriesVolumePenalty(product.title);
}

async function searchAmazonByKeywords(
  api: DefaultApi,
  config: NonNullable<ReturnType<typeof getConfig>>,
  keywords: string,
  bookTitle: string,
  expectedAuthor?: string
): Promise<AmazonProduct | null> {
  const request = new SearchItemsRequestContent();
  request.partnerTag = config.partnerTag;
  request.keywords = keywords;
  request.searchIndex = 'Books';
  request.itemCount = 10;
  request.resources = [
    'images.primary.medium',
    'itemInfo.title',
    'itemInfo.byLineInfo',
    'itemInfo.classifications',
    'offersV2.listings.price',
  ];

  try {
    const response = await api.searchItems(config.marketplace, {
      searchItemsRequestContent: request,
    });

    const items = response.searchResult?.items ?? [];
    if (items.length === 0) return null;

    const candidates = items.map((item) => ({
      item,
      ...toFormatSource(item),
    }));

    const preferred = pickPreferredSearchItem(candidates, bookTitle, expectedAuthor);
    if (!preferred) return null;

    return parseSearchItem(preferred.item, config.partnerTag);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown Amazon API error';
    console.warn(`Amazon 検索失敗 (${bookTitle}):`, message);
    return null;
  }
}

export async function enrichBooksWithAmazon(
  books: BookMention[],
  authorName: string | undefined,
  limit = MAX_BOOKS
): Promise<Array<BookMention & Partial<AmazonProduct>>> {
  const config = getConfig();

  if (!config) {
    return [];
  }

  const enriched: Array<BookMention & Partial<AmazonProduct>> = [];
  const candidates = books.slice(0, AMAZON_ENRICH_CANDIDATE_LIMIT);

  for (const book of candidates) {
    if (isExcludedBook(book.title)) continue;
    if (isLaterSeriesVolume(book.title)) continue;
    if (isAdultContent(book.title)) continue;
    if (authorName && isBookByOtherAuthor(book.title, authorName)) continue;
    if (enriched.length >= limit) break;

    const expectedAuthor = authorName ?? getKnownBookAuthor(book.title);

    process.stdout.write(`  Amazon検索: ${book.title}\n`);
    let product = await searchAmazonBook(book.title, expectedAuthor);
    if (
      product &&
      (isExcludedBook(product.title) ||
        isLaterSeriesVolume(product.title) ||
        isAdultContent(product.title) ||
        isMangaProduct({ title: product.title }) ||
        isGuideOrCommentaryProduct({ title: product.title }) ||
        isYouthAbridgedProduct({ title: product.title }) ||
        !isProductAcceptable(product, expectedAuthor))
    ) {
      product = null;
    }

    if (!isValidAmazonProduct(product)) {
      const skipReason = isAdultContent(book.title)
        ? '成人向け'
        : 'Amazon商品未検出';
      console.warn(`  スキップ（${skipReason}）: ${book.title}`);
      await sleep(1100);
      continue;
    }

    enriched.push({
      ...book,
      ...product,
    });

    await sleep(1100);
  }

  return enriched;
}

function isValidAmazonProduct(product: AmazonProduct | null): product is AmazonProduct {
  if (!product?.asin || !product.amazonUrl) return false;
  return /\/dp\//.test(product.amazonUrl);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAmazonConfigured(): boolean {
  return getConfig() !== null;
}

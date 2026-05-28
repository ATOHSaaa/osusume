import { DDGS } from '@phukon/duckduckgo-search';
import type { SearchResult } from './types';

const DEFAULT_REGION = 'jp-jp';

/** 検索結果から恒久的に除外するドメイン（ホスト名の完全一致またはサブドメイン） */
export const EXCLUDED_SEARCH_DOMAINS = [
  'kakuyomu.jp',
  'pixiv.net',
  'teller.jp',
  'alphapolis.co.jp',
  'x.com',
  'yurinavi.com',
  'caita.ai',
  'glnovel.com',
  'amazon.co.jp',
  'estar.jp',
  'l-love.jp',
  'berrys-cafe.jp',
  'novel.prcm.jp',
] as const;

export function isExcludedSearchDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return EXCLUDED_SEARCH_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function extractSiteName(url: string, fallback?: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return fallback ?? hostname;
  } catch {
    return fallback ?? url;
  }
}

function isValidResultUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function normalizeSnippet(body: string, maxLength = 200): string {
  const cleaned = body
    .replace(/\s+/g, ' ')
    .replace(/Feedback$/i, '')
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength)}…`;
}

/**
 * DuckDuckGo で Web 検索を行う。
 * API キー不要（@phukon/duckduckgo-search 経由）。
 *
 * 注: api.duckduckgo.com は Instant Answer 専用のため、
 * 通常の検索結果取得には HTML バックエンドを使用する。
 */
export async function searchWeb(
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  const ddgs = new DDGS({ timeout: 20_000 });

  const rawResults = await ddgs.text({
    keywords: query,
    region: process.env.DDG_REGION ?? DEFAULT_REGION,
    safesearch: 'moderate',
    backend: 'html',
    maxResults: limit + EXCLUDED_SEARCH_DOMAINS.length + 15,
  });

  const seen = new Set<string>();
  const results: SearchResult[] = [];
  let excludedCount = 0;

  for (const item of rawResults) {
    if (!isValidResultUrl(item.href)) continue;
    if (isExcludedSearchDomain(item.href)) {
      excludedCount += 1;
      continue;
    }
    if (seen.has(item.href)) continue;

    seen.add(item.href);
    results.push({
      title: item.title.trim(),
      url: item.href,
      snippet: normalizeSnippet(item.body),
      siteName: extractSiteName(item.href),
    });

    if (results.length >= limit) break;
  }

  if (results.length === 0) {
    const excludedNote =
      excludedCount > 0
        ? `（除外ドメイン ${EXCLUDED_SEARCH_DOMAINS.join(', ')} により ${excludedCount} 件をスキップ）`
        : '';
    throw new Error(
      `DuckDuckGo 検索結果が見つかりませんでした${excludedNote}。しばらく待ってから再試行してください`
    );
  }

  return results;
}

/** @deprecated searchWeb を使用してください */
export const searchGoogle = searchWeb;

export function buildAuthorQuery(authorName: string): string {
  return `${authorName} おすすめ`;
}

/** @deprecated buildGenreSubject を使用してください */
export function buildGenreQuery(genreInput: string): string {
  const trimmed = genreInput.trim();
  if (/おすすめ/.test(trimmed)) return trimmed;
  if (/小説|漫画|ライトノベル|ノベル|作品/.test(trimmed)) {
    return `${trimmed} おすすめ`;
  }
  return `${trimmed} 小説 おすすめ`;
}

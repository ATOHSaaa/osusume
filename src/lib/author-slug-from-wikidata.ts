import { ARTICLE_SLUG_SUFFIX } from './constants';

function romanizeForSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ō/g, 'o')
    .replace(/ū/g, 'u')
    .replace(/ā/g, 'a')
    .replace(/ē/g, 'e')
    .replace(/ī/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 英語ラベル（名 姓）を slug 用の「姓-名」に変換 */
export function englishLabelToSlugBase(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const family = parts[parts.length - 1];
    const given = parts.slice(0, -1).join('-');
    return romanizeForSlug(`${family}-${given}`);
  }
  return romanizeForSlug(label);
}

async function wikipediaFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL('https://ja.wikipedia.org/w/api.php');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'osusume-bot/1.0 (book recommendation site)' },
  });
  if (!res.ok) throw new Error(`Wikipedia API HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function getWikidataIdFromTitle(title: string): Promise<string | null> {
  type Response = {
    query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> };
  };
  const data = await wikipediaFetch<Response>({
    action: 'query',
    prop: 'pageprops',
    ppprop: 'wikibase_item',
    titles: title,
    format: 'json',
  });
  const pages = data.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  return page?.pageprops?.wikibase_item ?? null;
}

async function searchWikipediaTitle(authorName: string): Promise<string | null> {
  type Response = {
    query?: { search?: Array<{ title: string }> };
  };
  const data = await wikipediaFetch<Response>({
    action: 'query',
    list: 'search',
    srsearch: authorName,
    format: 'json',
    srlimit: '5',
  });
  const results = data.query?.search ?? [];
  const exact = results.find((r) => r.title === authorName);
  if (exact) return exact.title;
  const prefix = results.find((r) => r.title.startsWith(authorName));
  return prefix?.title ?? results[0]?.title ?? null;
}

async function getEnglishLabel(wikidataId: string): Promise<string | null> {
  const res = await fetch(
    `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
    { headers: { 'User-Agent': 'osusume-bot/1.0' } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    entities?: Record<string, { labels?: { en?: { value?: string } } }>;
  };
  const entity = data.entities?.[wikidataId];
  return entity?.labels?.en?.value ?? null;
}

/** 作家名から記事 slug ベース（recommended-books 除く）を推定 */
export async function resolveAuthorSlugBase(authorName: string): Promise<string | null> {
  let wikidataId = await getWikidataIdFromTitle(authorName);
  if (!wikidataId) {
    const title = await searchWikipediaTitle(authorName);
    if (!title) return null;
    wikidataId = await getWikidataIdFromTitle(title);
  }
  if (!wikidataId) return null;

  const enLabel = await getEnglishLabel(wikidataId);
  if (!enLabel) return null;

  const base = englishLabelToSlugBase(enLabel);
  return base || null;
}

export function buildAuthorArticleSlug(slugBase: string): string {
  return `${slugBase}-${ARTICLE_SLUG_SUFFIX}`;
}

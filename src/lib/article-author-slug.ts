import type { CollectionEntry } from 'astro:content';
import { normalizeAuthorName } from './awards/normalize';
import { getAuthorSlugOverride } from './author-slug-from-wikidata';

const SUSPICIOUS_SLUG_PATTERNS = [
  /^\d/,
  /winner/,
  /vancouver/,
  /national-route/,
  /life-theater/,
];

function scoreAuthorArticle(article: CollectionEntry<'articles'>): number {
  const slug = article.slug;
  let score = 0;

  if (!slug.includes('winner')) score += 100;

  const override = getAuthorSlugOverride(article.data.author);
  if (override && slug === override) score += 200;

  const bookCount = article.data.books?.length ?? 0;
  score += Math.min(bookCount, 10);

  if (SUSPICIOUS_SLUG_PATTERNS.some((pattern) => pattern.test(slug))) {
    score -= 500;
  }

  return score;
}

/** 同一作家名の記事が複数あるとき、最も信頼できる slug を選ぶ */
export function buildAuthorSlugByName(
  articles: CollectionEntry<'articles'>[]
): Map<string, string> {
  const candidates = new Map<string, CollectionEntry<'articles'>[]>();

  for (const article of articles) {
    if (article.data.kind !== 'author') continue;
    const key = normalizeAuthorName(article.data.author);
    const list = candidates.get(key) ?? [];
    list.push(article);
    candidates.set(key, list);
  }

  const slugByName = new Map<string, string>();
  for (const [authorKey, list] of candidates) {
    const best = [...list].sort((a, b) => scoreAuthorArticle(b) - scoreAuthorArticle(a))[0];
    if (best) slugByName.set(authorKey, best.slug);
  }

  return slugByName;
}

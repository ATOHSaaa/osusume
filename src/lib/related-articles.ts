import { normalizeBookTitleForMatch } from './book-format';
import type { ArticleEntry } from './articles';

export const RELATED_ARTICLES_LIMIT = 4;

interface ScoredArticle {
  article: ArticleEntry;
  score: number;
}

interface RankedBook {
  key: string;
  rank: number;
}

function getBookKey(book: { asin?: string; title: string }): string {
  const asin = book.asin?.trim();
  if (asin) return `asin:${asin}`;

  const normalized = normalizeBookTitleForMatch(book.title);
  if (normalized.length >= 2) return `title:${normalized}`;

  return `title:${book.title.trim()}`;
}

function getRankWeight(rankA: number, rankB: number): number {
  if (rankA <= 3 && rankB <= 3) return 3;
  if (rankA <= 6 && rankB <= 6) return 2;
  return 1;
}

function buildRankedBooks(article: ArticleEntry): RankedBook[] {
  return article.data.books.map((book, index) => ({
    key: getBookKey(book),
    rank: index + 1,
  }));
}

function scoreBookOverlap(current: ArticleEntry, candidate: ArticleEntry): number {
  const candidateRanks = new Map(
    buildRankedBooks(candidate).map(({ key, rank }) => [key, rank])
  );

  let score = 0;

  for (const { key, rank } of buildRankedBooks(current)) {
    const otherRank = candidateRanks.get(key);
    if (otherRank === undefined) continue;
    score += getRankWeight(rank, otherRank);
  }

  return score;
}

function compareScoredArticles(a: ScoredArticle, b: ScoredArticle): number {
  if (b.score !== a.score) return b.score - a.score;

  const updatedDiff =
    b.article.data.updated_at.valueOf() - a.article.data.updated_at.valueOf();
  if (updatedDiff !== 0) return updatedDiff;

  return a.article.slug.localeCompare(b.article.slug, 'ja');
}

function compareByUpdatedAt(a: ArticleEntry, b: ArticleEntry): number {
  const updatedDiff = b.data.updated_at.valueOf() - a.data.updated_at.valueOf();
  if (updatedDiff !== 0) return updatedDiff;
  return a.slug.localeCompare(b.slug, 'ja');
}

export function getRelatedArticles(
  current: ArticleEntry,
  allArticles: ArticleEntry[],
  limit = RELATED_ARTICLES_LIMIT
): ArticleEntry[] {
  const others = allArticles.filter((article) => article.slug !== current.slug);
  const scored = others
    .map((article) => ({
      article,
      score: scoreBookOverlap(current, article),
    }))
    .sort(compareScoredArticles);

  const selected: ArticleEntry[] = [];
  const pickedSlugs = new Set<string>();

  for (const { article, score } of scored) {
    if (score <= 0 || selected.length >= limit) break;
    selected.push(article);
    pickedSlugs.add(article.slug);
  }

  if (selected.length < limit) {
    const sameKind = others
      .filter(
        (article) =>
          !pickedSlugs.has(article.slug) && article.data.kind === current.data.kind
      )
      .sort(compareByUpdatedAt);

    for (const article of sameKind) {
      if (selected.length >= limit) break;
      selected.push(article);
      pickedSlugs.add(article.slug);
    }
  }

  if (selected.length < limit) {
    const oppositeKind = others
      .filter(
        (article) =>
          !pickedSlugs.has(article.slug) && article.data.kind !== current.data.kind
      )
      .sort(compareByUpdatedAt);

    for (const article of oppositeKind) {
      if (selected.length >= limit) break;
      selected.push(article);
    }
  }

  return selected;
}

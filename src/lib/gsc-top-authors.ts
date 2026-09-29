import gscTopAuthorsData from '../data/gsc-top-authors.json';
import type { ArticleEntry } from './articles';
import { sortArticlesByUpdated } from './articles';
import { ARTICLE_LIST_LIMIT } from './constants';

export interface GscTopAuthorEntry {
  slug: string;
  path: string;
  clicks: number;
  impressions: number;
}

export interface SidebarAuthorItem {
  article: ArticleEntry;
  rank: number;
  clicks: number;
}

const gscTopAuthors = gscTopAuthorsData as {
  generated_at?: string;
  period?: {
    start?: string;
    end?: string;
    weeks?: number;
    source?: string;
  };
  authors: GscTopAuthorEntry[];
};

export function getGscTopAuthorEntries(): GscTopAuthorEntry[] {
  return gscTopAuthors.authors ?? [];
}

export function pickSidebarAuthorArticles(
  authorArticles: ArticleEntry[],
  limit = ARTICLE_LIST_LIMIT
): SidebarAuthorItem[] {
  const bySlug = new Map(authorArticles.map((article) => [article.slug, article]));
  const picked = new Map<string, SidebarAuthorItem>();

  for (const entry of getGscTopAuthorEntries()) {
    const article = bySlug.get(entry.slug);
    if (!article || article.data.kind !== 'author') continue;

    picked.set(entry.slug, {
      article,
      rank: picked.size + 1,
      clicks: entry.clicks,
    });
    if (picked.size >= limit) break;
  }

  if (picked.size < limit) {
    for (const article of [...authorArticles].sort(sortArticlesByUpdated)) {
      if (picked.has(article.slug) || article.data.kind !== 'author') continue;
      picked.set(article.slug, {
        article,
        rank: picked.size + 1,
        clicks: 0,
      });
      if (picked.size >= limit) break;
    }
  }

  return [...picked.values()];
}

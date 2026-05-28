import type { CollectionEntry } from 'astro:content';

export type ArticleEntry = CollectionEntry<'articles'>;

export const sortArticlesByUpdated = (a: ArticleEntry, b: ArticleEntry) =>
  b.data.updated_at.valueOf() - a.data.updated_at.valueOf();

export const sortArticlesByAuthor = (a: ArticleEntry, b: ArticleEntry) =>
  a.data.author.localeCompare(b.data.author, 'ja');

export function getAuthorArticles(articles: ArticleEntry[]) {
  return articles.filter((a) => a.data.kind !== 'genre').sort(sortArticlesByUpdated);
}

export function getGenreArticles(articles: ArticleEntry[]) {
  return articles.filter((a) => a.data.kind === 'genre').sort(sortArticlesByUpdated);
}

import type { CollectionEntry } from 'astro:content';
import { MAX_BOOKS } from './constants';

export type ArticleEntry = CollectionEntry<'articles'>;

export const sortArticlesByUpdated = (a: ArticleEntry, b: ArticleEntry) =>
  b.data.updated_at.valueOf() - a.data.updated_at.valueOf();

export const sortArticlesByAuthor = (a: ArticleEntry, b: ArticleEntry) =>
  a.data.author.localeCompare(b.data.author, 'ja');

export function getAuthorArticles(articles: ArticleEntry[]) {
  return articles.filter((a) => a.data.kind === 'author').sort(sortArticlesByUpdated);
}

/** ランキングが MAX_BOOKS 件そろっている作家記事（トップページ掲載用） */
export function getAuthorArticlesWithFullRanking(articles: ArticleEntry[]) {
  return getAuthorArticles(articles).filter((a) => a.data.books.length === MAX_BOOKS);
}

export function getGenreArticles(articles: ArticleEntry[]) {
  return articles.filter((a) => a.data.kind === 'genre').sort(sortArticlesByUpdated);
}

export function getMangaArticles(articles: ArticleEntry[]) {
  return articles.filter((a) => a.data.kind === 'manga').sort(sortArticlesByUpdated);
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickSidebarAuthorArticles } from './gsc-top-authors';
import type { ArticleEntry } from './articles';

function makeArticle(slug: string, author: string, kind: 'author' | 'genre' = 'author'): ArticleEntry {
  const now = new Date('2026-01-01');
  return {
    id: slug,
    slug,
    collection: 'articles',
    data: {
      title: `${author}のおすすめ`,
      kind,
      author,
      description: 'test',
      published_at: now,
      updated_at: now,
      tags: [],
      sources: [],
      books: [],
    },
  } as ArticleEntry;
}

describe('pickSidebarAuthorArticles', () => {
  it('GSC データにある作家記事をクリック順で返す', () => {
    const articles = [
      makeArticle('akagawa-jiro-recommended-books', '赤川次郎'),
      makeArticle('dark-fantasy-recommended-books', 'ダークファンタジー小説', 'genre'),
      makeArticle('zzz-unknown-recommended-books', '未知の作家'),
    ];

    const items = pickSidebarAuthorArticles(articles, 3);
    assert.ok(items.length > 0);
    assert.equal(items[0]?.article.slug, 'akagawa-jiro-recommended-books');
    assert.equal(items[0]?.rank, 1);
    assert.ok(!items.some((item) => item.article.data.kind === 'genre'));
  });
});

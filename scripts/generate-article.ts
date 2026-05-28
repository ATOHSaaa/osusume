/**
 * 記事生成後は docs/ARTICLE_GENERATION_CHECKLIST.md を確認すること。
 * ランキングは最大 1位〜10位（MAX_BOOKS 件）。Amazon 未検出で10件未満でも掲載可。
 *
 * 作家: npm run generate -- "伊坂幸太郎" [slug]
 * ジャンル: npm run generate -- --genre "百合" [slug]
 * ジャンル（検索語指定）: npm run generate -- --genre "百合 小説 おすすめ" [slug]
 */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildAuthorSubject,
  buildGenreSubject,
  getArticleBody,
  getArticleDescription,
  getArticleTags,
  getArticleTitle,
  getAmazonAuthorFilter,
  type ArticleSubject,
} from '../src/lib/article-subject';
import { searchWeb } from '../src/lib/search';
import { scrapeSearchResults } from '../src/lib/scraper';
import { extractBooks } from '../src/lib/book-extractor';
import { enrichBooksWithAmazon, isAmazonConfigured } from '../src/lib/amazon';
import {
  ARTICLE_SLUG_SUFFIX,
  AUTHOR_SEARCH_LIMIT,
  GENRE_SEARCH_LIMIT,
  MAX_BOOKS,
} from '../src/lib/constants';
import type { GeneratedArticle } from '../src/lib/types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u4e00-\u9faf]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function buildArticleSlug(subject: ArticleSubject, slugBase?: string): string {
  const base = slugify(slugBase ?? subject.label);
  if (!base) {
    throw new Error(
      `スラッグが空です。英数字の slug を指定してください（例: npm run generate -- "${subject.label}" natsume-soseki）`
    );
  }
  return `${base}-${ARTICLE_SLUG_SUFFIX}`;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? '';
}

function formatDateField(date: string): string {
  return `"${date}"`;
}

function escapeYamlString(str: string): string {
  return str.replace(/"/g, '\\"');
}

function readExistingPublishedAt(content: string): string | null {
  const match = content.match(/^published_at:\s*(.+)$/m);
  if (!match?.[1]) return null;

  return match[1].trim().replace(/^"+|"+$/g, '');
}

function buildFrontmatter(
  article: GeneratedArticle,
  publishedAt: string,
  updatedAt: string
): string {
  const sourcesYaml = article.sources
    .map(
      (s) =>
        `    - title: "${escapeYamlString(s.title)}"\n      url: "${s.url}"\n      siteName: "${escapeYamlString(s.siteName ?? '')}"`
    )
    .join('\n');

  const booksYaml = article.books
    .map((b) => {
      const fields = [
        `    - title: "${escapeYamlString(b.title)}"`,
        `      count: ${b.count}`,
      ];
      if (b.asin) fields.push(`      asin: "${b.asin}"`);
      if (b.amazonUrl) fields.push(`      amazonUrl: "${b.amazonUrl}"`);
      if (b.imageUrl) fields.push(`      imageUrl: "${b.imageUrl}"`);
      if (b.price) fields.push(`      price: "${escapeYamlString(b.price)}"`);
      if (b.author || article.kind === 'genre') {
        fields.push(`      author: "${escapeYamlString(b.author ?? '')}"`);
      }
      return fields.join('\n');
    })
    .join('\n');

  const tagsYaml = article.tags.map((t) => `"${escapeYamlString(t)}"`).join(', ');

  return `---
title: "${escapeYamlString(article.title)}"
kind: ${article.kind}
author: "${escapeYamlString(article.author)}"
description: "${escapeYamlString(article.description)}"
published_at: ${formatDateField(publishedAt)}
updated_at: ${formatDateField(updatedAt)}
tags: [${tagsYaml}]
sources:
${sourcesYaml}
books:
${booksYaml}
---

`;
}

function parseCliArgs(argv: string[]): {
  subject: ArticleSubject;
  slugBase?: string;
} {
  if (argv[0] === '--genre') {
    const genreInput = argv[1];
    const slugBase = argv[2];

    if (!genreInput) {
      throw new Error(
        'ジャンル名を指定してください: npm run generate -- --genre "百合" [slug]'
      );
    }

    return { subject: buildGenreSubject(genreInput), slugBase };
  }

  const authorName = argv[0];
  const slugBase = argv[1];

  if (!authorName) {
    throw new Error(
      '使い方:\n' +
        '  作家: npm run generate -- "伊坂幸太郎" [slug]\n' +
        '  ジャンル: npm run generate -- --genre "百合" [slug]'
    );
  }

  return { subject: buildAuthorSubject(authorName), slugBase };
}

async function generateArticle(subject: ArticleSubject, slugBase?: string): Promise<string> {
  const kindLabel = subject.kind === 'genre' ? 'ジャンル' : '作家';
  console.log(`\n📚 「${subject.label}」のおすすめ記事を生成中（${kindLabel}）...\n`);

  console.log(`🔍 DuckDuckGo 検索: "${subject.searchQuery}"`);

  const searchLimit =
    subject.kind === 'genre' ? GENRE_SEARCH_LIMIT : AUTHOR_SEARCH_LIMIT;
  const searchResults = await searchWeb(subject.searchQuery, searchLimit);
  console.log(`✅ ${searchResults.length}件の検索結果を取得（上限 ${searchLimit}）\n`);

  console.log('📄 記事ページを取得中...');
  const pages = await scrapeSearchResults(searchResults);
  console.log(`✅ ${pages.length}件のページを解析\n`);

  if (pages.length === 0) {
    throw new Error('記事ページの取得に失敗しました');
  }

  console.log('📖 書籍名を抽出中...');
  const books = await extractBooks(pages, subject);
  console.log(`✅ ${books.length}件の書籍名を検出\n`);

  if (books.length === 0) {
    throw new Error(
      '書籍名を抽出できませんでした。OPENAI_API_KEY を設定すると精度が向上します'
    );
  }

  const amazonAuthor = getAmazonAuthorFilter(subject);

  if (!isAmazonConfigured()) {
    throw new Error(
      'Amazon Creators API が未設定です。商品照合ゲートのため .env に AMAZON_* を設定してください。'
    );
  }

  console.log('🛒 Amazon Creators API で商品情報を取得中（照合成功のみ採用）...');

  const enrichedBooks = await enrichBooksWithAmazon(books, amazonAuthor);

  if (enrichedBooks.length === 0) {
    throw new Error(
      'Amazon で確認できた作品がありません。抽出候補を確認し、除外ルールを見直してください。'
    );
  }

  if (enrichedBooks.length < MAX_BOOKS) {
    console.warn(
      `⚠️ Amazon で確認できた作品が${enrichedBooks.length}件（目標${MAX_BOOKS}件）。` +
        `${enrichedBooks.length}件で記事を生成します。`
    );
  }

  const article: GeneratedArticle = {
    kind: subject.kind,
    author: subject.label,
    title: getArticleTitle(subject),
    description: getArticleDescription(subject),
    tags: getArticleTags(subject),
    sources: searchResults,
    books: enrichedBooks,
  };

  const slug = buildArticleSlug(subject, slugBase);
  const outDir = join(process.cwd(), 'src/content/articles');
  await mkdir(outDir, { recursive: true });

  const filePath = join(outDir, `${slug}.mdx`);
  const now = formatDate(new Date());

  let publishedAt = now;
  try {
    const existing = await readFile(filePath, 'utf-8');
    const previous = readExistingPublishedAt(existing);
    if (previous) publishedAt = previous;
  } catch {
    // 新規記事
  }

  const frontmatter = buildFrontmatter(article, publishedAt, now);
  const body = getArticleBody(subject, searchResults.length);
  await writeFile(filePath, frontmatter + body, 'utf-8');

  console.log(`\n✨ 記事を生成しました: ${filePath}\n`);
  return filePath;
}

const { subject, slugBase } = parseCliArgs(process.argv.slice(2));

generateArticle(subject, slugBase).catch((err) => {
  console.error('❌ エラー:', err instanceof Error ? err.message : err);
  process.exit(1);
});

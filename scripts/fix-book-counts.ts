/**
 * 既存 MDX の参考 URL を再取得し、言及記事数（count）だけを正しい値に更新する。
 * 同一記事内の重複言及は1件として数える（book-extractor.ts の修正後ロジック）。
 */
import 'dotenv/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArticleSubject } from '../src/lib/article-subject';
import { extractBooks, normalizeTitle } from '../src/lib/book-extractor';
import { scrapeSearchResults } from '../src/lib/scraper';
import type { ArticleKind, SearchResult } from '../src/lib/types';

interface MdxBook {
  title: string;
  count: number;
  blockStart: number;
  countStart: number;
  countEnd: number;
}

interface ParsedMdx {
  filePath: string;
  content: string;
  kind: ArticleKind;
  label: string;
  sources: SearchResult[];
  books: MdxBook[];
}

function unescapeYamlString(str: string): string {
  return str.replace(/\\"/g, '"');
}

function parseYamlString(line: string): string | null {
  const match = line.match(/:\s*"(.*)"\s*$/);
  if (!match?.[1]) return null;
  return unescapeYamlString(match[1]);
}

function parseMdx(content: string, filePath: string): ParsedMdx {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath}: frontmatter が見つかりません`);
  }

  const frontmatter = match[1];
  const kind = (frontmatter.match(/^kind:\s*(\w+)/m)?.[1] ?? 'author') as ArticleKind;
  const authorMatch = frontmatter.match(/^author:\s*"(.*)"\s*$/m);
  const label = authorMatch ? unescapeYamlString(authorMatch[1]) : '';

  const sources: SearchResult[] = [];
  const sourceBlocks = frontmatter.match(
    /    - title: "[^"]*"\n      url: "[^"]*"(?:\n      siteName: "[^"]*")?/g
  );
  for (const block of sourceBlocks ?? []) {
    const title = parseYamlString(block.match(/title: "([^"]*)"/)?.[0] ?? '');
    const url = parseYamlString(block.match(/url: "([^"]*)"/)?.[0] ?? '');
    const siteName = parseYamlString(block.match(/siteName: "([^"]*)"/)?.[0] ?? '');
    if (title && url) {
      sources.push({
        title,
        url,
        snippet: '',
        siteName: siteName ?? undefined,
      });
    }
  }

  const books: MdxBook[] = [];
  const booksStart = frontmatter.indexOf('books:\n');
  if (booksStart === -1) {
    throw new Error(`${filePath}: books セクションが見つかりません`);
  }

  const booksSection = frontmatter.slice(booksStart);
  const bookTitlePattern = /^    - title: "(.*)"\r?\n      count: (\d+)/gm;
  let bookMatch: RegExpExecArray | null;

  while ((bookMatch = bookTitlePattern.exec(booksSection)) !== null) {
    const title = unescapeYamlString(bookMatch[1]);
    const count = Number(bookMatch[2]);
    const blockStart = booksStart + bookMatch.index;
    const countPrefix = bookMatch[0].match(/\n      count: /);
    const countValueStart =
      blockStart +
      (countPrefix?.index ?? bookMatch[0].length) +
      (countPrefix?.[0].length ?? 0);
    const countStart = countValueStart;
    const countEnd = countStart + bookMatch[2].length;

    books.push({
      title,
      count,
      blockStart,
      countStart,
      countEnd,
    });
  }

  return {
    filePath,
    content,
    kind,
    label,
    sources,
    books,
  };
}

function buildSubject(parsed: ParsedMdx): ArticleSubject {
  return {
    kind: parsed.kind,
    label: parsed.label,
    searchQuery: '',
  };
}

function findCountForBook(
  bookTitle: string,
  extracted: Awaited<ReturnType<typeof extractBooks>>,
  sourceLimit: number
): number {
  const key = normalizeTitle(bookTitle);
  const exact = extracted.find((item) => normalizeTitle(item.title) === key);
  if (exact) return exact.count;

  const partial = extracted.find((item) => {
    const itemKey = normalizeTitle(item.title);
    return itemKey.includes(key) || key.includes(itemKey);
  });
  if (partial) return partial.count;

  return 0;
}

function applyCountUpdates(content: string, updates: MdxBook[]): string {
  const sorted = [...updates].sort((a, b) => b.countStart - a.countStart);
  let next = content;

  for (const book of sorted) {
    next =
      next.slice(0, book.countStart) +
      String(book.count) +
      next.slice(book.countEnd);
  }

  return next;
}

function updateUpdatedAt(content: string): string {
  const today = new Date().toISOString().split('T')[0];
  return content.replace(
    /^updated_at:\s*.+$/m,
    `updated_at: "${today}"`
  );
}

async function fixArticle(filePath: string): Promise<{ changed: number; file: string }> {
  const content = await readFile(filePath, 'utf-8');
  const parsed = parseMdx(content, filePath);

  if (parsed.sources.length === 0 || parsed.books.length === 0) {
    return { changed: 0, file: filePath };
  }

  console.log(`\n📄 ${filePath.split('/').pop()} (${parsed.sources.length} 参考URL)`);
  const pages = await scrapeSearchResults(parsed.sources);

  if (pages.length === 0) {
    console.warn('  ⚠️ ページ取得失敗 — count を参考URL数で上限のみ適用');
    const capped = parsed.books.map((book) => ({
      ...book,
      count: Math.min(book.count, parsed.sources.length),
    }));
    const changedBooks = capped.filter((book, i) => book.count !== parsed.books[i].count);
    if (changedBooks.length === 0) return { changed: 0, file: filePath };

    let next = applyCountUpdates(content, changedBooks);
    next = updateUpdatedAt(next);
    await writeFile(filePath, next, 'utf-8');
    return { changed: changedBooks.length, file: filePath };
  }

  const extracted = await extractBooks(pages, buildSubject(parsed));
  const countMap = new Map(
    extracted.map((item) => [normalizeTitle(item.title), item.count])
  );

  const updatedBooks: MdxBook[] = [];
  for (const book of parsed.books) {
    const key = normalizeTitle(book.title);
    let newCount =
      countMap.get(key) ??
      findCountForBook(book.title, extracted, parsed.sources.length);

    if (newCount === 0) {
      newCount = Math.min(book.count, parsed.sources.length);
    } else {
      newCount = Math.min(newCount, parsed.sources.length);
    }

    if (newCount !== book.count) {
      updatedBooks.push({ ...book, count: newCount });
      console.log(`  ✏️ ${book.title}: ${book.count} → ${newCount}`);
    }
  }

  if (updatedBooks.length === 0) {
    console.log('  ✅ 変更なし');
    return { changed: 0, file: filePath };
  }

  let next = applyCountUpdates(content, updatedBooks);
  next = updateUpdatedAt(next);
  await writeFile(filePath, next, 'utf-8');
  return { changed: updatedBooks.length, file: filePath };
}

async function main() {
  const articlesDir = join(process.cwd(), 'src/content/articles');
  const only = process.argv.includes('--only')
    ? process.argv[process.argv.indexOf('--only') + 1]
    : null;

  const files = (await readdir(articlesDir))
    .filter((name) => name.endsWith('.mdx'))
    .filter((name) => !only || name.startsWith(only))
    .sort();

  console.log(`🔧 ${files.length} 件の記事の count を再集計します...\n`);

  let totalChanged = 0;
  let filesChanged = 0;

  for (const file of files) {
    const filePath = join(articlesDir, file);
    try {
      const result = await fixArticle(filePath);
      if (result.changed > 0) {
        totalChanged += result.changed;
        filesChanged += 1;
      }
    } catch (err) {
      console.error(
        `  ❌ ${file}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(
    `\n✨ 完了: ${filesChanged} 記事 / ${totalChanged} 件の count を更新しました`
  );
}

main().catch((err) => {
  console.error('❌ エラー:', err instanceof Error ? err.message : err);
  process.exit(1);
});

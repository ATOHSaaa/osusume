/**
 * 作家記事の meta description を、代表作名入りの SEO 向け文面に一括更新する。
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAuthorMetaDescription } from '../src/lib/author-meta-description';

function unescapeYamlString(str: string): string {
  return str.replace(/\\"/g, '"');
}

function escapeYamlString(str: string): string {
  return str.replace(/"/g, '\\"');
}

function parseAuthorAndBooks(content: string): {
  author: string;
  books: string[];
} | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  if (!/^kind:\s*author\s*$/m.test(frontmatter)) return null;

  const authorMatch = frontmatter.match(/^author:\s*"(.*)"\s*$/m);
  if (!authorMatch?.[1]) return null;

  const books: string[] = [];
  const booksSection = frontmatter.match(/^books:\n([\s\S]*)$/m)?.[1] ?? '';
  const bookTitlePattern = /^    - title: "(.*)"\r?\n      count: \d+/gm;
  let bookMatch: RegExpExecArray | null;

  while ((bookMatch = bookTitlePattern.exec(booksSection)) !== null) {
    books.push(unescapeYamlString(bookMatch[1]));
  }

  return {
    author: unescapeYamlString(authorMatch[1]),
    books,
  };
}

function replaceDescription(content: string, description: string): string {
  const escaped = escapeYamlString(description);
  if (!/^description:\s*"/m.test(content)) {
    throw new Error('description フィールドが見つかりません');
  }

  return content.replace(
    /^description:\s*".*"\s*$/m,
    `description: "${escaped}"`
  );
}

async function main() {
  const articlesDir = join(process.cwd(), 'src/content/articles');
  const files = (await readdir(articlesDir)).filter((file) => file.endsWith('.mdx'));

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = join(articlesDir, file);
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseAuthorAndBooks(content);

    if (!parsed) {
      skipped += 1;
      continue;
    }

    const description = buildAuthorMetaDescription(parsed.author, parsed.books);
    const current = content.match(/^description:\s*"(.*)"\s*$/m)?.[1];
    if (current === escapeYamlString(description)) {
      skipped += 1;
      continue;
    }

    const next = replaceDescription(content, description);
    await writeFile(filePath, next, 'utf-8');
    updated += 1;
  }

  console.log(`更新: ${updated}件 / スキップ: ${skipped}件`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

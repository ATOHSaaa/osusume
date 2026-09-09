/**
 * 文学賞・新人賞の受賞作家おすすめ記事を一括生成する。
 *
 * 実行例:
 *   npx tsx scripts/generate-prize-winner-articles.ts --slug=shincho --dry-run
 *   npx tsx scripts/generate-prize-winner-articles.ts --slug=yomiuri --limit=10
 *   npx tsx scripts/generate-prize-winner-articles.ts --all --limit=5
 */
import 'dotenv/config';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AWARDS } from '../src/lib/awards/registry';
import { normalizeAuthorName } from '../src/lib/awards/normalize';
import { buildAuthorSubject } from '../src/lib/article-subject';
import {
  buildAuthorArticleSlug,
  resolveAuthorSlugBase,
} from '../src/lib/author-slug-from-wikidata';
import { ARTICLE_SLUG_SUFFIX } from '../src/lib/constants';
import { generateArticle } from './generate-article';

interface PrizeData {
  entries: Array<{ session: number; author: string }>;
}

interface ProgressLog {
  generated: string[];
  skippedExisting: string[];
  failed: Array<{ author: string; reason: string }>;
}

const ARTICLES_DIR = join(process.cwd(), 'src/content/articles');

/** 作家記事を作らない受賞者（出版社など） */
const SKIP_AUTHOR_NAMES = new Set(['早川書房']);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadExistingAuthorArticles(): Map<string, string> {
  const slugByAuthor = new Map<string, string>();
  const suffix = `-${ARTICLE_SLUG_SUFFIX}`;

  for (const file of readdirSync(ARTICLES_DIR)) {
    if (!file.endsWith('.mdx')) continue;
    const content = readFileSync(join(ARTICLES_DIR, file), 'utf-8');
    const kind = content.match(/^kind:\s*(\w+)/m)?.[1] ?? 'author';
    const author = content.match(/^author:\s*"?([^"\n]+)"?/m)?.[1];
    if (kind === 'author' && author) {
      const slugBase = file.endsWith(`${suffix}.mdx`)
        ? file.slice(0, -(suffix.length + '.mdx'.length))
        : file.replace(/\.mdx$/, '');
      slugByAuthor.set(normalizeAuthorName(author), slugBase);
    }
  }
  return slugByAuthor;
}

function loadProgress(logPath: string): ProgressLog {
  if (!existsSync(logPath)) {
    return { generated: [], skippedExisting: [], failed: [] };
  }
  return JSON.parse(readFileSync(logPath, 'utf-8')) as ProgressLog;
}

function saveProgress(logPath: string, log: ProgressLog): void {
  writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`, 'utf-8');
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  slug?: string;
  all: boolean;
  limit?: number;
  delayMs: number;
  order: 'newest' | 'oldest';
  regenerate: boolean;
} {
  const slugArg = argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);
  const limitArg = argv.find((a) => a.startsWith('--limit='))?.slice('--limit='.length);
  const delayArg = argv.find((a) => a.startsWith('--delay='))?.slice('--delay='.length);
  return {
    dryRun: argv.includes('--dry-run'),
    slug: slugArg,
    all: argv.includes('--all'),
    limit: limitArg ? Number(limitArg) : undefined,
    delayMs: delayArg ? Number(delayArg) : 5000,
    order: argv.includes('--order=oldest') ? 'oldest' : 'newest',
    regenerate: argv.includes('--regenerate'),
  };
}

function uniqueAuthorsByLatestSession(
  entries: PrizeData['entries'],
  order: 'newest' | 'oldest'
): string[] {
  const latestSession = new Map<string, number>();
  const displayName = new Map<string, string>();

  for (const entry of entries) {
    const key = normalizeAuthorName(entry.author);
    displayName.set(key, entry.author);
    const prev = latestSession.get(key);
    if (prev === undefined || entry.session > prev) {
      latestSession.set(key, entry.session);
    }
  }

  return [...latestSession.entries()]
    .sort((a, b) =>
      order === 'newest' ? b[1] - a[1] || a[0].localeCompare(b[0], 'ja') : a[1] - b[1]
    )
    .map(([key]) => displayName.get(key) ?? key);
}

async function main(): Promise<void> {
  const { dryRun, slug, all, limit, delayMs, order, regenerate } = parseArgs(process.argv.slice(2));
  const newAwardSlugs = [
    'yomiuri',
    'edogawa-ranpo',
    'kawabata',
    'japan-sf',
    'bungaku-kai',
    'shincho',
    'bungei',
    'all-yomimono',
    'subaru',
    'honkaku-mystery',
    'mephisto',
  ];
  const targets = slug
    ? AWARDS.filter((a) => a.slug === slug)
    : all
      ? AWARDS.filter((a) => newAwardSlugs.includes(a.slug))
      : [];

  if (targets.length === 0) {
    throw new Error('対象賞がありません。--slug= または --all を指定してください。');
  }

  const existingArticles = loadExistingAuthorArticles();

  for (const award of targets) {
    const dataPath = join(process.cwd(), `src/data/${award.prizeDataFile}`);
    const logPath = join(process.cwd(), `scripts/${award.slug}-winner-article-progress.json`);
    const data: PrizeData = JSON.parse(readFileSync(dataPath, 'utf-8'));
    const progress = loadProgress(logPath);

    let authors = uniqueAuthorsByLatestSession(data.entries, order);
    const withoutArticle = authors.filter((name) => !existingArticles.has(normalizeAuthorName(name)));
    authors = regenerate ? authors : withoutArticle;
    if (limit) authors = authors.slice(0, limit);

    console.log(`\n=== ${award.name}: ${authors.length}名 ===`);

    for (const authorName of authors) {
      if (SKIP_AUTHOR_NAMES.has(authorName)) {
        console.log(`  − スキップ（非作家）: ${authorName}`);
        continue;
      }

      const authorKey = normalizeAuthorName(authorName);
      let slugBase = existingArticles.get(authorKey);

      if (!slugBase) {
        await sleep(1500);
        slugBase = (await resolveAuthorSlugBase(authorName)) ?? undefined;
      }

      if (!slugBase) {
        console.log(`  ✗ ${authorName}: Wikidata から slug を取得できませんでした`);
        progress.failed.push({ author: authorName, reason: 'slug not found' });
        saveProgress(logPath, progress);
        continue;
      }

      const articleSlug = buildAuthorArticleSlug(slugBase);
      const filePath = join(ARTICLES_DIR, `${articleSlug}.mdx`);

      if (existsSync(filePath) && !regenerate) {
        console.log(`  − スキップ（既存）: ${authorName}`);
        progress.skippedExisting.push(authorName);
        saveProgress(logPath, progress);
        continue;
      }

      if (dryRun) {
        console.log(`  [dry-run] ${authorName} → ${slugBase}`);
        continue;
      }

      try {
        await generateArticle(buildAuthorSubject(authorName), slugBase);
        progress.generated.push(authorName);
        existingArticles.set(authorKey, slugBase);
        console.log(`  ✓ ${authorName}`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        progress.failed.push({ author: authorName, reason });
        console.log(`  ✗ ${authorName}: ${reason}`);
      }

      saveProgress(logPath, progress);
      await sleep(delayMs);
    }
  }

  console.log('\n完了');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

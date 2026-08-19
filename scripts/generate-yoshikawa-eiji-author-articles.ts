/**
 * 吉川英治文学賞受賞作・候補作に登場する作家のおすすめ記事を一括生成する。
 *
 * 実行例:
 *   npx tsx scripts/generate-yoshikawa-eiji-author-articles.ts --dry-run
 *   npx tsx scripts/generate-yoshikawa-eiji-author-articles.ts --limit 5
 *   npx tsx scripts/generate-yoshikawa-eiji-author-articles.ts --all
 *   npx tsx scripts/generate-yoshikawa-eiji-author-articles.ts --author "森村誠一"
 */
import 'dotenv/config';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAuthorSubject } from '../src/lib/article-subject';
import {
  buildAuthorArticleSlug,
  resolveAuthorSlugBase,
} from '../src/lib/author-slug-from-wikidata';
import { ARTICLE_SLUG_SUFFIX } from '../src/lib/constants';
import { normalizeAuthorName } from '../src/lib/yoshikawa-eiji-prize';
import { generateArticle } from './generate-article';

interface YoshikawaEntry {
  session: number;
  author: string;
}

interface YoshikawaData {
  entries: YoshikawaEntry[];
}

interface ProgressLog {
  generated: string[];
  skippedExisting: string[];
  failed: Array<{ author: string; reason: string }>;
}

const ARTICLES_DIR = join(process.cwd(), 'src/content/articles');
const PRIZE_PATH = join(process.cwd(), 'src/data/yoshikawa-eiji-prize.json');
const NOMINEE_PATH = join(process.cwd(), 'src/data/yoshikawa-eiji-nominee.json');
const LOG_PATH = join(process.cwd(), 'scripts/yoshikawa-eiji-author-article-progress.json');

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

function loadProgress(): ProgressLog {
  if (!existsSync(LOG_PATH)) {
    return { generated: [], skippedExisting: [], failed: [] };
  }
  return JSON.parse(readFileSync(LOG_PATH, 'utf-8')) as ProgressLog;
}

function saveProgress(log: ProgressLog): void {
  writeFileSync(LOG_PATH, `${JSON.stringify(log, null, 2)}\n`, 'utf-8');
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  limit?: number;
  author?: string;
  delayMs: number;
  order: 'newest' | 'oldest';
  regenerate: boolean;
  all: boolean;
  resetFailed: boolean;
} {
  let dryRun = false;
  let limit: number | undefined;
  let author: string | undefined;
  let delayMs = 3000;
  let order: 'newest' | 'oldest' = 'newest';
  let regenerate = false;
  let all = false;
  let resetFailed = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--limit') limit = Number(argv[++i]);
    else if (arg === '--author') author = argv[++i];
    else if (arg === '--delay') delayMs = Number(argv[++i]);
    else if (arg === '--order') order = argv[++i] === 'oldest' ? 'oldest' : 'newest';
    else if (arg === '--regenerate') regenerate = true;
    else if (arg === '--all') all = true;
    else if (arg === '--reset-failed') resetFailed = true;
  }

  return { dryRun, limit, author, delayMs, order, regenerate, all, resetFailed };
}

function loadAllEntries(): YoshikawaEntry[] {
  const prize = JSON.parse(readFileSync(PRIZE_PATH, 'utf-8')) as YoshikawaData;
  const nominee = JSON.parse(readFileSync(NOMINEE_PATH, 'utf-8')) as YoshikawaData;
  return [...prize.entries, ...nominee.entries];
}

function sortAuthorsByLatestSession(
  entries: YoshikawaEntry[],
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

  const authors = [...latestSession.keys()].map((key) => displayName.get(key)!);
  authors.sort((a, b) => {
    const diff =
      (latestSession.get(normalizeAuthorName(b)) ?? 0) -
      (latestSession.get(normalizeAuthorName(a)) ?? 0);
    return order === 'newest' ? diff : -diff;
  });

  return authors;
}

async function main(): Promise<void> {
  const {
    dryRun,
    limit,
    author: singleAuthor,
    delayMs,
    order,
    regenerate,
    all,
    resetFailed,
  } = parseArgs(process.argv.slice(2));
  const entries = loadAllEntries();
  const authors = sortAuthorsByLatestSession(entries, order);
  const existingArticles = loadExistingAuthorArticles();
  const progress = loadProgress();

  if (resetFailed) {
    progress.failed = [];
    saveProgress(progress);
  }

  const failedAuthors = new Set(progress.failed.map((f) => f.author));
  const withArticle = authors.filter((name) =>
    existingArticles.has(normalizeAuthorName(name))
  );
  const withoutArticle = authors.filter(
    (name) => !existingArticles.has(normalizeAuthorName(name))
  );

  let targets: string[];

  if (singleAuthor) {
    targets = [singleAuthor];
  } else if (regenerate && !all) {
    targets = withArticle;
  } else if (all && regenerate) {
    targets = authors.filter((name) => !failedAuthors.has(name));
  } else if (all) {
    targets = withoutArticle.filter((name) => !failedAuthors.has(name));
  } else {
    targets = withoutArticle.filter((name) => !failedAuthors.has(name));
  }

  if (limit !== undefined && limit > 0 && !all) {
    targets = targets.slice(0, limit);
  }

  const orderLabel = order === 'newest' ? '登場回が新しい順' : '登場回が古い順';
  const modeLabel = regenerate
    ? all
      ? '全員（既存は再生成）'
      : '既存記事の再生成'
    : all
      ? '未作成分を全員'
      : '未作成分';

  console.log(`吉川英治文学賞関連作家: ${authors.length}人`);
  console.log(`記事あり: ${withArticle.length}人 / 未作成: ${withoutArticle.length}人`);
  console.log(`モード: ${modeLabel}`);
  console.log(`並び順: ${orderLabel}`);
  console.log(`生成対象: ${targets.length}人${dryRun ? '（dry-run）' : ''}\n`);

  if (targets.length === 0) {
    console.log('生成対象がありません。');
    return;
  }

  let done = 0;

  for (const authorName of targets) {
    done++;
    console.log(`\n[${done}/${targets.length}] ${authorName}`);

    const authorKey = normalizeAuthorName(authorName);
    const existingSlug = existingArticles.get(authorKey);
    let slugBase = existingSlug;

    if (!slugBase) {
      await sleep(1500);
      slugBase = (await resolveAuthorSlugBase(authorName)) ?? undefined;
    }

    if (!slugBase) {
      const reason = 'Wikidata から slug を取得できませんでした';
      console.log(`  ✗ ${reason}`);
      progress.failed.push({ author: authorName, reason });
      saveProgress(progress);
      await sleep(500);
      continue;
    }

    let slug = buildAuthorArticleSlug(slugBase);
    let filePath = join(ARTICLES_DIR, `${slug}.mdx`);

    if (existsSync(filePath) && !regenerate) {
      const existingAuthor = readFileSync(filePath, 'utf-8').match(
        /^author:\s*"?([^"\n]+)"?/m
      )?.[1];
      if (
        existingAuthor &&
        normalizeAuthorName(existingAuthor) !== authorKey
      ) {
        slugBase = `${slugBase}-alt`;
        slug = buildAuthorArticleSlug(slugBase);
        filePath = join(ARTICLES_DIR, `${slug}.mdx`);
      }
    }

    const isRegenerate = regenerate && existsSync(filePath);

    if (existsSync(filePath) && !regenerate) {
      console.log(`  − スキップ（${slug} は既存）`);
      progress.skippedExisting.push(authorName);
      saveProgress(progress);
      continue;
    }

    console.log(`  slug: ${slugBase}${isRegenerate ? '（再生成）' : ''}`);

    if (dryRun) continue;

    try {
      const subject = buildAuthorSubject(authorName);
      await generateArticle(subject, slugBase);
      progress.generated.push(authorName);
      existingArticles.set(authorKey, slugBase);
      saveProgress(progress);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${reason}`);
      progress.failed.push({ author: authorName, reason });
      saveProgress(progress);
    }

    await sleep(delayMs);
  }

  console.log('\n--- サマリー ---');
  console.log(`成功: ${progress.generated.length}`);
  console.log(`失敗: ${progress.failed.length}`);
  console.log(`ログ: ${LOG_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

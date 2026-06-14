/**
 * 直木賞受賞者のおすすめ記事を一括生成する。
 *
 * 実行例:
 *   npx tsx scripts/generate-naoki-winner-articles.ts --dry-run
 *   npx tsx scripts/generate-naoki-winner-articles.ts --limit 5
 *   npx tsx scripts/generate-naoki-winner-articles.ts --limit 10 --order oldest
 *   npx tsx scripts/generate-naoki-winner-articles.ts --regenerate
 *   npx tsx scripts/generate-naoki-winner-articles.ts --all --regenerate --reset-failed
 *   npx tsx scripts/generate-naoki-winner-articles.ts --author "池波正太郎"
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
import { normalizeAuthorName } from '../src/lib/naoki-prize';
import { generateArticle } from './generate-article';

interface NaokiData {
  entries: Array<{ session: number; author: string }>;
}

interface ProgressLog {
  generated: string[];
  skippedExisting: string[];
  failed: Array<{ author: string; reason: string }>;
}

const ARTICLES_DIR = join(process.cwd(), 'src/content/articles');
const DATA_PATH = join(process.cwd(), 'src/data/naoki-prize.json');
const LOG_PATH = join(process.cwd(), 'scripts/naoki-winner-article-progress.json');

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadExistingAuthorArticles(): Map<string, string> {
  const slugByAuthor = new Map<string, string>();
  const suffix = `-${ARTICLE_SLUG_SUFFIX}`;

  for (const file of readdirSync(ARTICLES_DIR)) {
    if (!file.endsWith('.mdx')) continue;
    const content = readFileSync(join(ARTICLES_DIR, file), 'utf-8');
    const kind = content.match(/^kind:\s*(\w+)/m)?.[1];
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

/** 各作家の最新受賞回で並べ替えた作家名リスト */
function sortAuthorsByLatestSession(
  entries: NaokiData['entries'],
  order: 'newest' | 'oldest'
): string[] {
  const latestSession = new Map<string, number>();

  for (const entry of entries) {
    const prev = latestSession.get(entry.author);
    if (prev === undefined || entry.session > prev) {
      latestSession.set(entry.author, entry.session);
    }
  }

  const authors = [...latestSession.keys()];
  authors.sort((a, b) => {
    const diff = (latestSession.get(b) ?? 0) - (latestSession.get(a) ?? 0);
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
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as NaokiData;
  const authors = sortAuthorsByLatestSession(data.entries, order);
  const existingArticles = loadExistingAuthorArticles();
  const progress = loadProgress();

  if (resetFailed) {
    progress.failed = [];
    saveProgress(progress);
  }

  const failedAuthors = new Set(progress.failed.map((f) => f.author));
  const naokiWithArticle = authors.filter((name) =>
    existingArticles.has(normalizeAuthorName(name))
  );
  const naokiWithoutArticle = authors.filter(
    (name) => !existingArticles.has(normalizeAuthorName(name))
  );

  let targets: string[];

  if (singleAuthor) {
    targets = [singleAuthor];
  } else if (regenerate && !all) {
    targets = naokiWithArticle;
  } else if (all && regenerate) {
    targets = authors.filter((name) => !failedAuthors.has(name));
  } else if (all) {
    targets = naokiWithoutArticle.filter((name) => !failedAuthors.has(name));
  } else {
    targets = naokiWithoutArticle.filter((name) => !failedAuthors.has(name));
  }

  if (limit !== undefined && limit > 0 && !all) {
    targets = targets.slice(0, limit);
  }

  const orderLabel = order === 'newest' ? '受賞が新しい順' : '受賞が古い順';
  const modeLabel = regenerate
    ? all
      ? '全員（既存は再生成）'
      : '既存記事の再生成'
    : all
      ? '未作成分を全員'
      : '未作成分';

  console.log(`直木賞受賞者: ${authors.length}人`);
  console.log(`記事あり: ${naokiWithArticle.length}人 / 未作成: ${naokiWithoutArticle.length}人`);
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

    const slug = buildAuthorArticleSlug(slugBase);
    const filePath = join(ARTICLES_DIR, `${slug}.mdx`);
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

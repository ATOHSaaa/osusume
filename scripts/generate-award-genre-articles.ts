/**
 * 文学賞・新人賞のジャンル記事（おすすめランキング MDX）を一括生成する。
 *
 * 実行例:
 *   npx tsx scripts/generate-award-genre-articles.ts --dry-run
 *   npx tsx scripts/generate-award-genre-articles.ts --slug akutagawa
 *   npx tsx scripts/generate-award-genre-articles.ts --all
 */
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AWARDS } from '../src/lib/awards/registry';
import { ARTICLE_SLUG_SUFFIX } from '../src/lib/constants';
import { buildGenreSubject } from '../src/lib/article-subject';
import { generateArticle } from './generate-article';

const ARTICLES_DIR = join(process.cwd(), 'src/content/articles');

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]): { dryRun: boolean; slug?: string; all: boolean; delayMs: number } {
  const slugArg = argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);
  const delayArg = argv.find((a) => a.startsWith('--delay='))?.slice('--delay='.length);
  return {
    dryRun: argv.includes('--dry-run'),
    slug: slugArg,
    all: argv.includes('--all'),
    delayMs: delayArg ? Number(delayArg) : 5000,
  };
}

async function main(): Promise<void> {
  const { dryRun, slug, all, delayMs } = parseArgs(process.argv.slice(2));
  const targets = slug
    ? AWARDS.filter((a) => a.slug === slug)
    : all
      ? AWARDS
      : AWARDS.filter((a) => a.slug !== 'honya-taisho');

  if (targets.length === 0) {
    throw new Error('対象賞がありません。--slug または --all を指定してください。');
  }

  for (const award of targets) {
    const articleSlug = `${award.genreSlug}-${ARTICLE_SLUG_SUFFIX}`;
    const filePath = join(ARTICLES_DIR, `${articleSlug}.mdx`);

    if (existsSync(filePath)) {
      console.log(`スキップ（既存）: ${award.name} → ${articleSlug}`);
      continue;
    }

    console.log(`\n=== ${award.name} ジャンル記事生成 ===`);
    if (dryRun) {
      console.log(`  検索: ${award.genreSearchQuery}`);
      console.log(`  slug: ${articleSlug}`);
      continue;
    }

    await generateArticle(buildGenreSubject(award.genreSearchQuery), award.genreSlug);

    console.log(`  ✓ ${articleSlug}`);
    await sleep(delayMs);
  }

  console.log('\n完了');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

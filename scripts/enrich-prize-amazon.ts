/**
 * 芥川賞・直木賞の未リンク受賞作を Amazon 照合する共通スクリプト。
 *
 * 実行:
 *   npx tsx scripts/enrich-prize-amazon.ts --akutagawa
 *   npx tsx scripts/enrich-prize-amazon.ts --naoki
 *   npx tsx scripts/enrich-prize-amazon.ts --all
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isAmazonConfigured, searchAmazonBook } from '../src/lib/amazon.ts';
import { buildPrizeSearchTitles } from '../src/lib/prize-amazon.ts';

interface PrizeEntry {
  session: number;
  period: string;
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

interface PrizeData {
  source: string;
  fetchedAt: string;
  amazonEnrichedAt?: string;
  entries: PrizeEntry[];
}

const PRIZES = {
  akutagawa: resolve('src/data/akutagawa-prize.json'),
  naoki: resolve('src/data/naoki-prize.json'),
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]): Array<keyof typeof PRIZES> {
  const all = argv.includes('--all');
  const targets: Array<keyof typeof PRIZES> = [];
  if (all || argv.includes('--akutagawa')) targets.push('akutagawa');
  if (all || argv.includes('--naoki')) targets.push('naoki');
  if (targets.length === 0) {
    throw new Error('使い方: npx tsx scripts/enrich-prize-amazon.ts --akutagawa|--naoki|--all');
  }
  return targets;
}

async function enrichFile(label: string, path: string): Promise<void> {
  const data: PrizeData = JSON.parse(readFileSync(path, 'utf-8'));
  let matched = 0;
  let skipped = 0;
  let newlyMatched = 0;

  const missing = data.entries.filter((e) => !e.amazonUrl || !e.asin);
  console.log(`\n=== ${label}: 未リンク ${missing.length}件 / 全${data.entries.length}件 ===\n`);

  for (let i = 0; i < data.entries.length; i++) {
    const entry = data.entries[i];
    if (entry.amazonUrl && entry.asin) {
      matched++;
      continue;
    }

    const labelLine = `第${entry.session}回 ${entry.author}『${entry.title}』`;
    process.stdout.write(`[${i + 1}/${data.entries.length}] ${labelLine}\n`);

    const titles = buildPrizeSearchTitles(entry.title);
    let product = null;

    for (const title of titles) {
      console.log(`  検索: ${title}`);
      product = await searchAmazonBook(title, entry.author);
      if (product?.asin && product.amazonUrl) break;
      await sleep(700);
    }

    if (product?.asin && product.amazonUrl) {
      entry.asin = product.asin;
      entry.amazonUrl = product.amazonUrl;
      entry.price = product.price;
      matched++;
      newlyMatched++;
      console.log(`  ✓ ${product.asin} ${product.title}`);
    } else {
      delete entry.asin;
      delete entry.amazonUrl;
      delete entry.price;
      skipped++;
      console.log('  − 未検出');
    }

    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
    await sleep(1100);
  }

  data.amazonEnrichedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');

  console.log(
    `\n${label} 完了: リンク ${matched}件 / 全${data.entries.length}件（今回新規 ${newlyMatched}件 / 未検出 ${skipped}件）`
  );
}

async function main(): Promise<void> {
  if (!isAmazonConfigured()) {
    throw new Error('Amazon Creators API が未設定です (.env)');
  }

  for (const key of parseArgs(process.argv.slice(2))) {
    await enrichFile(key, PRIZES[key]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

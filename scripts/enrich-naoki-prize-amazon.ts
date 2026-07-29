/**
 * 直木賞受賞作を Amazon Creators API で照合し JSON にリンクを付与する。
 * 実行: npx tsx scripts/enrich-naoki-prize-amazon.ts
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

const DATA_PATH = resolve('src/data/naoki-prize.json');

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  if (!isAmazonConfigured()) {
    throw new Error('Amazon Creators API が未設定です (.env)');
  }

  const data: PrizeData = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  let matched = 0;
  let skipped = 0;

  for (let i = 0; i < data.entries.length; i++) {
    const entry = data.entries[i];
    const label = `第${entry.session}回 ${entry.author}『${entry.title}』`;

    if (entry.amazonUrl && entry.asin) {
      matched++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${data.entries.length}] ${label}\n`);
    let product = null;
    for (const title of buildPrizeSearchTitles(entry.title)) {
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
      console.log(`  ✓ ${product.asin} ${product.title}`);
    } else {
      delete entry.asin;
      delete entry.amazonUrl;
      delete entry.price;
      skipped++;
      console.log('  − 未検出');
    }

    writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
    await sleep(1100);
  }

  data.amazonEnrichedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');

  console.log(`\n完了: Amazonリンク ${matched}件 / 全${data.entries.length}件（未検出 ${skipped}件）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

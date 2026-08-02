/**
 * 芥川賞・直木賞の未リンク受賞作を Amazon 照合する共通スクリプト。
 *
 * 実行:
 *   npx tsx scripts/enrich-prize-amazon.ts --akutagawa
 *   npx tsx scripts/enrich-prize-amazon.ts --naoki
 *   npx tsx scripts/enrich-prize-amazon.ts --naoki-nominee
 *   npx tsx scripts/enrich-prize-amazon.ts --all
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isAmazonConfigured, getAmazonPartnerTag, searchAmazonBook } from '../src/lib/amazon.ts';
import {
  buildAmazonSearchAffiliateUrl,
  buildPrizeSearchTitles,
} from '../src/lib/prize-amazon.ts';

interface PrizeEntry {
  session: number;
  period: string;
  author: string;
  title: string;
  won?: boolean;
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
  'naoki-nominee': resolve('src/data/naoki-nominee.json'),
} as const;

function normalizePrizeKey(session: number, author: string, title: string): string {
  const norm = (value: string) =>
    value.replace(/\s+/g, '').replace(/[「『」』]/g, '').replace(/ 他$/, '');
  return `${session}|${norm(author)}|${norm(title)}`;
}

function normalizeAuthorTitleKey(author: string, title: string): string {
  const norm = (value: string) =>
    value.replace(/\s+/g, '').replace(/[「『」』]/g, '').replace(/ 他$/, '');
  return `${norm(author)}|${norm(title)}`;
}

function seedNaokiNomineeFromWinners(data: PrizeData): number {
  const winners: PrizeData = JSON.parse(readFileSync(PRIZES.naoki, 'utf-8'));
  const winnerByKey = new Map<string, PrizeEntry>();

  for (const entry of winners.entries) {
    if (!entry.amazonUrl || !entry.asin) continue;
    winnerByKey.set(normalizePrizeKey(entry.session, entry.author, entry.title), entry);
  }

  let seeded = 0;
  for (const entry of data.entries) {
    if (entry.amazonUrl && entry.asin) continue;
    const winner = winnerByKey.get(normalizePrizeKey(entry.session, entry.author, entry.title));
    if (!winner?.amazonUrl || !winner.asin) continue;
    entry.asin = winner.asin;
    entry.amazonUrl = winner.amazonUrl;
    entry.price = winner.price;
    seeded++;
  }

  return seeded;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]): Array<keyof typeof PRIZES> {
  const all = argv.includes('--all');
  const targets: Array<keyof typeof PRIZES> = [];
  if (all || argv.includes('--akutagawa')) targets.push('akutagawa');
  if (all || argv.includes('--naoki')) targets.push('naoki');
  if (all || argv.includes('--naoki-nominee')) targets.push('naoki-nominee');
  if (targets.length === 0) {
    throw new Error(
      '使い方: npx tsx scripts/enrich-prize-amazon.ts --akutagawa|--naoki|--naoki-nominee|--all'
    );
  }
  return targets;
}

async function enrichFile(key: keyof typeof PRIZES, path: string): Promise<void> {
  const data: PrizeData = JSON.parse(readFileSync(path, 'utf-8'));
  const partnerTag = getAmazonPartnerTag();
  if (!partnerTag) {
    throw new Error('Amazon Creators API が未設定です (.env)');
  }

  let matched = 0;
  let skipped = 0;
  let newlyMatched = 0;
  let searchFallback = 0;
  const productByAuthorTitle = new Map<
    string,
    Pick<PrizeEntry, 'asin' | 'amazonUrl' | 'price'>
  >();

  for (const entry of data.entries) {
    if (!entry.amazonUrl) continue;
    productByAuthorTitle.set(normalizeAuthorTitleKey(entry.author, entry.title), {
      asin: entry.asin,
      amazonUrl: entry.amazonUrl,
      price: entry.price,
    });
  }

  if (key === 'naoki-nominee') {
    const seeded = seedNaokiNomineeFromWinners(data);
    if (seeded > 0) {
      for (const entry of data.entries) {
        if (!entry.amazonUrl) continue;
        productByAuthorTitle.set(normalizeAuthorTitleKey(entry.author, entry.title), {
          asin: entry.asin,
          amazonUrl: entry.amazonUrl,
          price: entry.price,
        });
      }
      writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
      console.log(`\n=== naoki-nominee: 受賞作データから ${seeded}件をコピー ===`);
    }
  }

  const missing = data.entries.filter((e) => !e.amazonUrl || !e.asin);
  console.log(`\n=== ${key}: 未リンク ${missing.length}件 / 全${data.entries.length}件 ===\n`);

  for (let i = 0; i < data.entries.length; i++) {
    const entry = data.entries[i];
    if (entry.amazonUrl && entry.asin) {
      matched++;
      continue;
    }

    if (entry.amazonUrl && key === 'naoki-nominee') {
      matched++;
      continue;
    }

    const authorTitleKey = normalizeAuthorTitleKey(entry.author, entry.title);
    const cached = productByAuthorTitle.get(authorTitleKey);
    if (cached?.amazonUrl && cached.asin) {
      entry.asin = cached.asin;
      entry.amazonUrl = cached.amazonUrl;
      entry.price = cached.price;
      matched++;
      newlyMatched++;
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
      productByAuthorTitle.set(authorTitleKey, {
        asin: entry.asin,
        amazonUrl: entry.amazonUrl,
        price: entry.price,
      });
      matched++;
      newlyMatched++;
      console.log(`  ✓ ${product.asin} ${product.title}`);
    } else if (key === 'naoki-nominee') {
      entry.amazonUrl = buildAmazonSearchAffiliateUrl(
        entry.title,
        entry.author,
        partnerTag
      );
      delete entry.asin;
      delete entry.price;
      productByAuthorTitle.set(authorTitleKey, { amazonUrl: entry.amazonUrl });
      matched++;
      searchFallback++;
      newlyMatched++;
      console.log(`  ↪ 検索リンク: ${entry.amazonUrl}`);
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
    `\n${key} 完了: リンク ${matched}件 / 全${data.entries.length}件（今回新規 ${newlyMatched}件 / 検索リンク ${searchFallback}件 / 未検出 ${skipped}件）`
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

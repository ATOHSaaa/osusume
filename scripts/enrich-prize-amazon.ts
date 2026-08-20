/**
 * 芥川賞・直木賞の未リンク受賞作を Amazon 照合する共通スクリプト。
 *
 * 実行:
 *   npx tsx scripts/enrich-prize-amazon.ts --akutagawa
 *   npx tsx scripts/enrich-prize-amazon.ts --naoki
 *   npx tsx scripts/enrich-prize-amazon.ts --naoki-nominee
 *   npx tsx scripts/enrich-prize-amazon.ts --akutagawa-nominee
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
import { findYoshikawaEijiPrizeOverride } from '../src/lib/yoshikawa-eiji-amazon-overrides.ts';

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
  'akutagawa-nominee': resolve('src/data/akutagawa-nominee.json'),
  'honya-taisho': resolve('src/data/honya-taisho-prize.json'),
  'honya-taisho-nominee': resolve('src/data/honya-taisho-nominee.json'),
  'yoshikawa-eiji': resolve('src/data/yoshikawa-eiji-prize.json'),
  'yoshikawa-eiji-nominee': resolve('src/data/yoshikawa-eiji-nominee.json'),
  'noma-bungei': resolve('src/data/noma-bungei-prize.json'),
  'noma-bungei-nominee': resolve('src/data/noma-bungei-nominee.json'),
  'tanizaki-junichiro': resolve('src/data/tanizaki-junichiro-prize.json'),
  'tanizaki-junichiro-nominee': resolve('src/data/tanizaki-junichiro-nominee.json'),
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

function seedNomineeFromWinners(
  data: PrizeData,
  winnersPath: string
): number {
  const winners: PrizeData = JSON.parse(readFileSync(winnersPath, 'utf-8'));
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

function buildAsinAffiliateUrl(asin: string, partnerTag: string): string {
  const url = new URL(`https://www.amazon.co.jp/dp/${asin}`);
  url.searchParams.set('tag', partnerTag);
  url.searchParams.set('linkCode', 'osi');
  url.searchParams.set('th', '1');
  url.searchParams.set('psc', '1');
  return url.toString();
}

function seedPrizeFromNominee(data: PrizeData, nomineePath: string): number {
  const nominee: PrizeData = JSON.parse(readFileSync(nomineePath, 'utf-8'));
  let seeded = 0;

  for (const entry of data.entries) {
    if (entry.amazonUrl) continue;
    const match = nominee.entries.find(
      (n) =>
        normalizePrizeKey(n.session, n.author, n.title) ===
        normalizePrizeKey(entry.session, entry.author, entry.title)
    );
    if (!match?.amazonUrl) continue;
    entry.amazonUrl = match.amazonUrl;
    entry.asin = match.asin;
    entry.price = match.price;
    seeded++;
  }

  return seeded;
}

async function searchAmazonBookWithRetry(
  title: string,
  author: string,
  maxAttempts = 3
): Promise<Awaited<ReturnType<typeof searchAmazonBook>> | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const product = await searchAmazonBook(title, author);
      if (product?.asin && product.amazonUrl) return product;
      return product;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) {
        console.log(`  ⚠ 検索エラー: ${message}`);
        return null;
      }
      console.log(`  ⚠ 検索エラー — 再試行 (${attempt}/${maxAttempts})...`);
      await sleep(1500 * attempt);
    }
  }
  return null;
}

function buildEntrySearchTitles(entry: PrizeEntry): string[] {
  const titles = buildPrizeSearchTitles(entry.title);
  const override =
    entry.session !== undefined
      ? findYoshikawaEijiPrizeOverride(entry.session, entry.author, entry.title)
      : undefined;
  if (override?.searchTitles) {
    for (const t of override.searchTitles) {
      if (!titles.includes(t)) titles.push(t);
    }
  }
  return titles;
}

function usesSearchFallback(key: keyof typeof PRIZES): boolean {
  return (
    key === 'naoki-nominee' ||
    key === 'akutagawa-nominee' ||
    key === 'honya-taisho-nominee' ||
    key === 'yoshikawa-eiji-nominee' ||
    key === 'yoshikawa-eiji' ||
    key === 'noma-bungei-nominee' ||
    key === 'noma-bungei' ||
    key === 'tanizaki-junichiro-nominee' ||
    key === 'tanizaki-junichiro'
  );
}

function parseArgs(argv: string[]): {
  targets: Array<keyof typeof PRIZES>;
  upgradeAsin: boolean;
} {
  const all = argv.includes('--all');
  const targets: Array<keyof typeof PRIZES> = [];
  if (all || argv.includes('--akutagawa')) targets.push('akutagawa');
  if (all || argv.includes('--naoki')) targets.push('naoki');
  if (argv.includes('--naoki-nominee')) targets.push('naoki-nominee');
  if (argv.includes('--akutagawa-nominee')) targets.push('akutagawa-nominee');
  if (all || argv.includes('--honya-taisho')) targets.push('honya-taisho');
  if (argv.includes('--honya-taisho-nominee')) targets.push('honya-taisho-nominee');
  if (all || argv.includes('--yoshikawa-eiji')) targets.push('yoshikawa-eiji');
  if (argv.includes('--yoshikawa-eiji-nominee')) targets.push('yoshikawa-eiji-nominee');
  if (all || argv.includes('--noma-bungei')) targets.push('noma-bungei');
  if (argv.includes('--noma-bungei-nominee')) targets.push('noma-bungei-nominee');
  if (all || argv.includes('--tanizaki-junichiro')) targets.push('tanizaki-junichiro');
  if (argv.includes('--tanizaki-junichiro-nominee')) targets.push('tanizaki-junichiro-nominee');
  if (targets.length === 0) {
    throw new Error(
      '使い方: npx tsx scripts/enrich-prize-amazon.ts --akutagawa|--naoki|--naoki-nominee|--akutagawa-nominee|--honya-taisho|--honya-taisho-nominee|--yoshikawa-eiji|--yoshikawa-eiji-nominee|--noma-bungei|--noma-bungei-nominee|--tanizaki-junichiro|--tanizaki-junichiro-nominee|--all [--upgrade-asin]'
    );
  }
  return { targets, upgradeAsin: argv.includes('--upgrade-asin') };
}

async function enrichFile(
  key: keyof typeof PRIZES,
  path: string,
  upgradeAsin: boolean
): Promise<void> {
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
    const seeded = seedNomineeFromWinners(data, PRIZES.naoki);
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

  if (key === 'akutagawa-nominee') {
    const seeded = seedNomineeFromWinners(data, PRIZES.akutagawa);
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
      console.log(`\n=== akutagawa-nominee: 受賞作データから ${seeded}件をコピー ===`);
    }
  }

  if (key === 'honya-taisho-nominee') {
    const seeded = seedNomineeFromWinners(data, PRIZES['honya-taisho']);
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
      console.log(`\n=== honya-taisho-nominee: 受賞作データから ${seeded}件をコピー ===`);
    }
  }

  if (key === 'yoshikawa-eiji-nominee') {
    const seeded = seedNomineeFromWinners(data, PRIZES['yoshikawa-eiji']);
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
      console.log(`\n=== yoshikawa-eiji-nominee: 受賞作データから ${seeded}件をコピー ===`);
    }
  }

  if (key === 'yoshikawa-eiji') {
    const seeded = seedPrizeFromNominee(data, PRIZES['yoshikawa-eiji-nominee']);
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
      console.log(`\n=== yoshikawa-eiji: 候補作データから ${seeded}件をコピー ===`);
    }
  }

  if (key === 'noma-bungei-nominee') {
    const seeded = seedNomineeFromWinners(data, PRIZES['noma-bungei']);
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
      console.log(`\n=== noma-bungei-nominee: 受賞作データから ${seeded}件をコピー ===`);
    }
  }

  if (key === 'noma-bungei') {
    const seeded = seedPrizeFromNominee(data, PRIZES['noma-bungei-nominee']);
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
      console.log(`\n=== noma-bungei: 候補作データから ${seeded}件をコピー ===`);
    }
  }

  if (key === 'tanizaki-junichiro-nominee') {
    const seeded = seedNomineeFromWinners(data, PRIZES['tanizaki-junichiro']);
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
      console.log(`\n=== tanizaki-junichiro-nominee: 受賞作データから ${seeded}件をコピー ===`);
    }
  }

  if (key === 'tanizaki-junichiro') {
    const seeded = seedPrizeFromNominee(data, PRIZES['tanizaki-junichiro-nominee']);
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
      console.log(`\n=== tanizaki-junichiro: 候補作データから ${seeded}件をコピー ===`);
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

    if (
      entry.amazonUrl &&
      !upgradeAsin &&
      usesSearchFallback(key)
    ) {
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

    const override = findYoshikawaEijiPrizeOverride(
      entry.session,
      entry.author,
      entry.title
    );
    if (override?.asin && key === 'yoshikawa-eiji') {
      entry.asin = override.asin;
      entry.amazonUrl = buildAsinAffiliateUrl(override.asin, partnerTag);
      delete entry.price;
      productByAuthorTitle.set(authorTitleKey, {
        asin: entry.asin,
        amazonUrl: entry.amazonUrl,
      });
      matched++;
      newlyMatched++;
      console.log(`  ✓ (手動ASIN) ${override.asin}`);
      writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
      await sleep(300);
      continue;
    }

    const titles = buildEntrySearchTitles(entry);
    let product = null;

    for (const title of titles) {
      console.log(`  検索: ${title}`);
      product = await searchAmazonBookWithRetry(title, entry.author);
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
    } else if (usesSearchFallback(key)) {
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

  const { targets, upgradeAsin } = parseArgs(process.argv.slice(2));

  for (const key of targets) {
    await enrichFile(key, PRIZES[key], upgradeAsin);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

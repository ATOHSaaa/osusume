/**
 * 候補作データに Amazon 検索アソシエイトリンクを一括付与する。
 * 実行: npx tsx scripts/seed-nominee-search-affiliate.ts --akutagawa-nominee
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAmazonPartnerTag } from '../src/lib/amazon.ts';
import { buildAmazonSearchAffiliateUrl } from '../src/lib/prize-amazon.ts';

const FILES = {
  'akutagawa-nominee': resolve('src/data/akutagawa-nominee.json'),
  'naoki-nominee': resolve('src/data/naoki-nominee.json'),
} as const;

function main(): void {
  const key = process.argv[2]?.replace(/^--/, '');
  if (key !== 'akutagawa-nominee' && key !== 'naoki-nominee') {
    throw new Error(
      '使い方: npx tsx scripts/seed-nominee-search-affiliate.ts --akutagawa-nominee|--naoki-nominee'
    );
  }

  const partnerTag = getAmazonPartnerTag();
  if (!partnerTag) {
    throw new Error('AMAZON_PARTNER_TAG が未設定です (.env)');
  }

  const path = FILES[key];
  const data = JSON.parse(readFileSync(path, 'utf-8')) as {
    fetchedAt: string;
    amazonEnrichedAt?: string;
    entries: Array<{
      author: string;
      title: string;
      amazonUrl?: string;
      asin?: string;
      price?: string;
    }>;
  };

  let added = 0;
  for (const entry of data.entries) {
    if (entry.amazonUrl) continue;
    entry.amazonUrl = buildAmazonSearchAffiliateUrl(
      entry.title,
      entry.author,
      partnerTag
    );
    delete entry.asin;
    delete entry.price;
    added++;
  }

  data.amazonEnrichedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  console.log(`${key}: ${added}件に検索アソシエイトリンクを付与（全${data.entries.length}件）`);
}

main();

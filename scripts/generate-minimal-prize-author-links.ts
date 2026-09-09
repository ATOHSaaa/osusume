/**
 * 受賞作データから作家記事のスタブを生成し、文学賞の作者リンクを埋める。
 *
 * 実行例:
 *   npx tsx scripts/generate-minimal-prize-author-links.ts --slug=all-yomimono
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AWARD_BY_SLUG } from '../src/lib/awards/registry';
import { normalizeAuthorName } from '../src/lib/awards/normalize';
import { buildAuthorArticleSlug } from '../src/lib/author-slug-from-wikidata';
import { ARTICLE_SLUG_SUFFIX } from '../src/lib/constants';

interface PrizeEntry {
  session: number;
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

interface PrizeData {
  entries: PrizeEntry[];
}

const ARTICLES_DIR = join(process.cwd(), 'src/content/articles');

const KANA_ROMAN: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri',
  る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゃ: 'ya', ゅ: 'yu', ょ: 'yo', っ: '', ー: '', '・': ' ', ' ': ' ',
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
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

async function fetchWikiPage(
  title: string
): Promise<{ intro: string | null; exists: boolean; wikidataId: string | null }> {
  const url = new URL('https://ja.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'extracts|pageprops');
  url.searchParams.set('exintro', '1');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('ppprop', 'wikibase_item');
  url.searchParams.set('titles', title);
  url.searchParams.set('format', 'json');
  const res = await fetch(url, { headers: { 'User-Agent': 'osusume-bot/1.0' } });
  if (!res.ok) return { intro: null, exists: false, wikidataId: null };
  const data = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        { missing?: string; extract?: string; pageprops?: { wikibase_item?: string } }
      >;
    };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return { intro: null, exists: false, wikidataId: null };
  return {
    intro: page.extract ?? null,
    exists: true,
    wikidataId: page.pageprops?.wikibase_item ?? null,
  };
}

async function getEnglishLabel(wikidataId: string): Promise<string | null> {
  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`, {
    headers: { 'User-Agent': 'osusume-bot/1.0' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    entities?: Record<string, { labels?: { en?: { value?: string } } }>;
  };
  return data.entities?.[wikidataId]?.labels?.en?.value ?? null;
}

function kanaToRomaji(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (ch === 'っ' && next) {
      const r = KANA_ROMAN[next];
      if (r) {
        out += r[0];
        continue;
      }
    }
    out += KANA_ROMAN[ch] ?? ch;
  }
  return out
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function readingToSlug(reading: string): string {
  const parts = reading.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const family = kanaToRomaji(parts[0]);
    const given = parts.slice(1).map(kanaToRomaji).join('-');
    return `${family}-${given}`;
  }
  return kanaToRomaji(reading);
}

async function resolveSlug(author: string): Promise<string | null> {
  const { intro, exists, wikidataId } = await fetchWikiPage(author);
  if (!exists) return null;

  if (wikidataId) {
    const enLabel = await getEnglishLabel(wikidataId);
    if (enLabel) {
      const parts = enLabel.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const family = parts[parts.length - 1].toLowerCase();
        const given = parts.slice(0, -1).join('-').toLowerCase();
        return `${family}-${given}`.replace(/[^a-z0-9-]+/g, '-');
      }
    }
  }

  const match = intro?.match(/（([ぁ-ん・\s]+)/);
  if (match) {
    const slug = readingToSlug(match[1]);
    if (slug) return slug;
  }

  return null;
}

function buildMdx(author: string, entry: PrizeEntry, today: string, awardName: string): string {
  const bookLines = entry.asin
    ? `books:
    - title: "${escapeYaml(entry.title)}"
      count: 1
      asin: "${entry.asin}"
      amazonUrl: "${entry.amazonUrl ?? `https://www.amazon.co.jp/dp/${entry.asin}?tag=osusume-tadeku-22`}"
      price: "${entry.price ?? ''}"
      author: "${escapeYaml(author)}"`
    : 'books: []';

  return `---
title: "${escapeYaml(author)}のおすすめ作品ランキング"
kind: author
author: "${escapeYaml(author)}"
description: "${escapeYaml(author)}の人気作品をWeb記事から集計。言及頻度の高いおすすめ本をランキング形式で紹介します。"
published_at: "${today}"
updated_at: "${today}"
tags: ["おすすめ", "${escapeYaml(author)}"]
sources:
    - title: "${escapeYaml(author)} - Wikipedia"
      url: "https://ja.wikipedia.org/wiki/${encodeURIComponent(author)}"
      siteName: "ja.wikipedia.org"
${bookLines}
---

${author}の作品で、${awardName}受賞作を中心におすすめをまとめています。
`;
}

async function main(): Promise<void> {
  const slug = process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);
  if (!slug) throw new Error('--slug= を指定してください');

  const award = AWARD_BY_SLUG.get(slug);
  if (!award) throw new Error(`Unknown award: ${slug}`);

  const dataPath = join(process.cwd(), `src/data/${award.prizeDataFile}`);
  const data: PrizeData = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const existing = loadExistingAuthorArticles();
  const byAuthor = new Map<string, PrizeEntry>();

  for (const entry of data.entries) {
    const key = normalizeAuthorName(entry.author);
    if (!byAuthor.has(key)) byAuthor.set(key, entry);
  }

  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  const failed: string[] = [];

  for (const [key, entry] of byAuthor) {
    if (existing.has(key)) continue;

    const author = entry.author.replace(/\[注\s*\d+\]/g, '').trim();
    if (!author || entry.title === '受賞作なし') continue;
    await sleep(2500);
    let slugBase = await resolveSlug(author);
    if (!slugBase) {
      slugBase = `${slug}-winner-${entry.session}`;
      console.log(`  ~ ${author}: Wikipedia なし -> ${slugBase}`);
    }

    const articleSlug = buildAuthorArticleSlug(slugBase);
    const filePath = join(ARTICLES_DIR, `${articleSlug}.mdx`);
    if (existsSync(filePath)) {
      existing.set(key, slugBase);
      continue;
    }

    writeFileSync(filePath, buildMdx(author, entry, today, award.name), 'utf-8');
    existing.set(key, slugBase);
    created++;
    console.log(`  ✓ ${author} -> ${articleSlug}`);
  }

  console.log(`\n${award.name}: ${created}件作成 / 失敗 ${failed.length}件`);
  if (failed.length > 0) console.log(failed.join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * 「芥川賞のすべて」から芥川賞候補作一覧を取得し JSON を生成する。
 * 実行: npx tsx scripts/fetch-akutagawa-nominee-data.ts
 */
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AkutagawaNomineeEntry {
  session: number;
  period: string;
  author: string;
  title: string;
  won: boolean;
}

const SOURCE_BASE = 'https://prizesworld.com/akutagawa/ichiran';
const OUTPUT_PATH = resolve('src/data/akutagawa-nominee.json');

const PAGE_RANGES = [
  'ichiran1-20.htm',
  'ichiran21-40.htm',
  'ichiran41-60.htm',
  'ichiran61-80.htm',
  'ichiran81-100.htm',
  'ichiran101-120.htm',
  'ichiran121-140.htm',
  'ichiran141-160.htm',
  'ichiran161-180.htm',
];

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeAuthor(name: string): string {
  return cleanText(name).replace(/\s+/g, '');
}

function normalizeTitle(raw: string): string {
  let title = cleanText(raw).replace(/<[^>]+>/g, '');
  title = title.replace(/^[「『]+/, '').replace(/[」』]+$/, '').trim();
  title = title.replace(/[」』](その他|\(|他)/g, '$1');
  title = title.replace(/その他$/, ' 他');
  return title;
}

function extractPeriod(yearText: string): string {
  const match = yearText.match(/(\d{4})年(上半期|下半期)/);
  if (match) return `${match[1]}年${match[2]}`;
  return cleanText(yearText);
}

function parseSessionFromId(id: string): number | null {
  const match = id.match(/^list(\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseNovelTitle($: cheerio.CheerioAPI, cell: cheerio.Cheerio<cheerio.Element>): string {
  const novelCell = cell.find('.div_novel').first();
  if (novelCell.length > 0) {
    return normalizeTitle(novelCell.text());
  }

  const combined = cell.find('.cell_novel_and_media').first();
  if (combined.length > 0) {
    return normalizeTitle(combined.text());
  }

  return '';
}

function parsePage(html: string, sourceUrl: string): AkutagawaNomineeEntry[] {
  const $ = cheerio.load(html);
  const entries: AkutagawaNomineeEntry[] = [];

  $('div.ls_verseheader[id^="list"]').each((_, header) => {
    const session = parseSessionFromId($(header).attr('id') ?? '');
    if (session === null) return;

    const verseTable = $(header).nextAll('table.ls_verse').first();
    const period = extractPeriod(
      verseTable.find('h2.ls_verse_title_year').first().text()
    );

    let currentKind: 'winner' | 'nominee' | 'preliminary' | null = null;

    verseTable.find('table.ls_novel tr').each((__, row) => {
      const cells = $(row).find('td');
      if (cells.length === 0) return;

      const kindCell = cells.filter((_, cell) => {
        const className = $(cell).attr('class') ?? '';
        return className.includes('cell_win_nomi');
      });

      if (kindCell.length > 0) {
        const className = kindCell.first().attr('class') ?? '';
        const label = cleanText(kindCell.first().text());

        if (className.includes('col_win') || label === '受賞') {
          currentKind = 'winner';
        } else if (className.includes('col_nomi_prelim') || label === '予選候補') {
          currentKind = 'preliminary';
        } else if (className.includes('col_nomi') || label === '候補') {
          currentKind = 'nominee';
        } else if (cells.filter('.cell_no_winner').length > 0) {
          currentKind = null;
        }
      }

      if (currentKind !== 'winner' && currentKind !== 'nominee') return;

      const authorCell = cells.filter('.cell_author');
      if (authorCell.length === 0) return;

      const author = normalizeAuthor(authorCell.first().text());
      if (!author) return;

      const novelCell = cells.filter('.cell_novel, .cell_novel_and_media');
      const title = novelCell.length > 0 ? parseNovelTitle($, novelCell.first()) : '';
      if (!title) return;

      entries.push({
        session,
        period,
        author,
        title,
        won: currentKind === 'winner',
      });
    });
  });

  if (entries.length === 0) {
    throw new Error(`No entries parsed from ${sourceUrl}`);
  }

  return entries;
}

async function main(): Promise<void> {
  const allEntries: AkutagawaNomineeEntry[] = [];

  for (const page of PAGE_RANGES) {
    const url = `${SOURCE_BASE}/${page}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'osusume-bot/1.0 (book recommendation site)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

    const html = await res.text();
    const entries = parsePage(html, url);
    console.log(`  ${entries.length} entries`);
    allEntries.push(...entries);
    await new Promise((r) => setTimeout(r, 500));
  }

  allEntries.sort((a, b) => a.session - b.session || Number(b.won) - Number(a.won));

  if (allEntries.length < 400) {
    throw new Error(`Expected 400+ entries, got ${allEntries.length}`);
  }

  const payload = {
    source: SOURCE_BASE,
    fetchedAt: new Date().toISOString().slice(0, 10),
    entries: allEntries,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${allEntries.length} entries to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

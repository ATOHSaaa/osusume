/**
 * Wikipedia「本屋大賞」各回テーブルを取得し、受賞作・ノミネート作の JSON を生成する。
 * 実行: npx tsx scripts/fetch-honya-taisho-data.ts
 */
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface HonyaTaishoWork {
  session: number;
  period: string;
  author: string;
  title: string;
}

export interface HonyaTaishoNomineeWork extends HonyaTaishoWork {
  won: boolean;
}

const WIKIPEDIA_URL = 'https://ja.wikipedia.org/wiki/%E6%9C%AC%E5%B1%8B%E5%A4%A7%E8%B3%9E';
const PRIZE_OUTPUT_PATH = resolve('src/data/honya-taisho-prize.json');
const NOMINEE_OUTPUT_PATH = resolve('src/data/honya-taisho-nominee.json');

function cleanText(text: string): string {
  return text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

function parseSessionFromHeading(text: string): { session: number; period: string } | null {
  const m = text.match(/(\d{4})年.*第(\d+)回/);
  if (!m) return null;
  return { period: `${m[1]}年`, session: Number(m[2]) };
}

function cleanTitle(title: string): string {
  return title
    .replace(/^[\s「『]+/, '')
    .replace(/[\s」』]+$/, '')
    .trim();
}

function parseRank(value: string): number | null {
  const m = value.match(/^(\d+)/);
  if (!m) return null;
  const rank = Number(m[1]);
  return Number.isFinite(rank) ? rank : null;
}

function parseTable(
  $: cheerio.CheerioAPI,
  table: cheerio.Element,
  session: number,
  period: string
): { winners: HonyaTaishoWork[]; nominees: HonyaTaishoNomineeWork[] } {
  const headers = $(table)
    .find('tr')
    .first()
    .find('th')
    .map((_, th) => cleanText($(th).text()))
    .get();

  const hasDepartment = headers.includes('部門');
  const rankIndex = headers.indexOf('順位');
  const titleIndex = headers.indexOf('受賞作');
  const authorIndex = headers.indexOf('著者');
  const departmentIndex = headers.indexOf('部門');

  if (rankIndex < 0 || titleIndex < 0 || authorIndex < 0) {
    return { winners: [], nominees: [] };
  }

  const winners: HonyaTaishoWork[] = [];
  const nominees: HonyaTaishoNomineeWork[] = [];
  let currentDepartment = '';

  $(table)
    .find('tr')
    .slice(1)
    .each((_, row) => {
      const cells = $(row)
        .find('th, td')
        .map((_, cell) => cleanText($(cell).text()))
        .get();

      const shifted = hasDepartment && cells.length < headers.length;
      const ri = rankIndex - (shifted ? 1 : 0);
      const ti = titleIndex - (shifted ? 1 : 0);
      const ai = authorIndex - (shifted ? 1 : 0);

      if (cells.length < ai + 1) return;

      if (hasDepartment) {
        if (!shifted && departmentIndex < cells.length && cells[departmentIndex]) {
          currentDepartment = cells[departmentIndex];
        }
        if (currentDepartment !== '本屋大賞') return;
      }

      const rank = parseRank(cells[ri]);
      if (rank === null || rank < 1 || rank > 4) return;

      const title = cleanTitle(cells[ti]);
      const author = cells[ai];
      if (!title || !author) return;

      const work: HonyaTaishoWork = { session, period, author, title };
      const nominee: HonyaTaishoNomineeWork = { ...work, won: rank === 1 };

      nominees.push(nominee);
      if (rank === 1) winners.push(work);
    });

  return { winners, nominees };
}

function parsePage(html: string): {
  winners: HonyaTaishoWork[];
  nominees: HonyaTaishoNomineeWork[];
} {
  const $ = cheerio.load(html);
  const winners: HonyaTaishoWork[] = [];
  const nominees: HonyaTaishoNomineeWork[] = [];

  const headings = $('h3')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter((text) => /第\d+回/.test(text));

  const tables = $('table.wikitable').toArray();

  if (headings.length !== tables.length) {
    throw new Error(
      `見出し数(${headings.length})とテーブル数(${tables.length})が一致しません`
    );
  }

  for (let i = 0; i < tables.length; i++) {
    const parsed = parseSessionFromHeading(headings[i]);
    if (!parsed) {
      throw new Error(`見出しを解析できません: ${headings[i]}`);
    }
    const { winners: w, nominees: n } = parseTable($, tables[i], parsed.session, parsed.period);
    winners.push(...w);
    nominees.push(...n);
  }

  return { winners, nominees };
}

async function main(): Promise<void> {
  console.log(`Fetching ${WIKIPEDIA_URL}...`);
  const res = await fetch(WIKIPEDIA_URL, {
    headers: { 'User-Agent': 'osusume-bot/1.0 (book recommendation site)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const { winners, nominees } = parsePage(await res.text());

  if (winners.length < 20) {
    throw new Error(`Expected 20+ winners, got ${winners.length}`);
  }
  if (nominees.length < 80) {
    throw new Error(`Expected 80+ nominees, got ${nominees.length}`);
  }

  const fetchedAt = new Date().toISOString().slice(0, 10);

  writeFileSync(
    PRIZE_OUTPUT_PATH,
    `${JSON.stringify({ source: WIKIPEDIA_URL, fetchedAt, entries: winners }, null, 2)}\n`,
    'utf-8'
  );
  writeFileSync(
    NOMINEE_OUTPUT_PATH,
    `${JSON.stringify({ source: WIKIPEDIA_URL, fetchedAt, entries: nominees }, null, 2)}\n`,
    'utf-8'
  );

  console.log(`Wrote ${winners.length} winners to ${PRIZE_OUTPUT_PATH}`);
  console.log(`Wrote ${nominees.length} nominees to ${NOMINEE_OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

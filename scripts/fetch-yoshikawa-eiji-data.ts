/**
 * Wikipedia「吉川英治文学賞」から受賞作・候補作 JSON を生成する。
 * 実行: npx tsx scripts/fetch-yoshikawa-eiji-data.ts
 */
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface YoshikawaEijiWork {
  session: number;
  period: string;
  author: string;
  title: string;
}

export interface YoshikawaEijiNomineeWork extends YoshikawaEijiWork {
  won: boolean;
}

const WIKIPEDIA_URL =
  'https://ja.wikipedia.org/wiki/%E5%90%89%E5%B7%9D%E8%8B%B1%E6%B2%BB%E6%96%87%E5%AD%A6%E8%B3%9E';
const PRIZE_OUTPUT_PATH = resolve('src/data/yoshikawa-eiji-prize.json');
const NOMINEE_OUTPUT_PATH = resolve('src/data/yoshikawa-eiji-nominee.json');

/** 第1回 = 1967年 */
const FIRST_SESSION_YEAR = 1967;

function cleanText(text: string): string {
  return text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

function sessionToPeriod(session: number): string {
  return `${FIRST_SESSION_YEAR + session - 1}年`;
}

function cleanTitle(title: string): string {
  return title
    .replace(/^[\s「『]+/, '')
    .replace(/[\s」』]+$/, '')
    .trim();
}

function cleanAuthor(author: string): string {
  return author
    .replace(/を中心とした.*$/, '')
    .replace(/ならびに.*$/, '')
    .replace(/その他.*$/, '')
    .replace(/など.*$/, '')
    .trim();
}

function parseAuthorTitleSegments(text: string): Array<{ author: string; title: string }> {
  const normalized = cleanText(text);
  const blocks = normalized.includes('/') ? normalized.split(/\s*\/\s*/) : [normalized];
  const results: Array<{ author: string; title: string }> = [];

  for (const block of blocks) {
    const firstQuote = block.indexOf('『');
    if (firstQuote < 0) continue;

    const author = cleanAuthor(block.slice(0, firstQuote));
    if (!author) continue;

    const titleRegex = /『([^』]+)』/g;
    let match: RegExpExecArray | null;
    while ((match = titleRegex.exec(block)) !== null) {
      const title = cleanTitle(match[1]);
      if (!title || title.length < 2) continue;
      results.push({ author, title });
    }
  }

  return results;
}

function parseCandidateText(text: string): Array<{ author: string; title: string }> {
  const segments = cleanText(text).split(/\s+(?=[^\s『、,／/]+『)/);
  const results: Array<{ author: string; title: string }> = [];
  for (const segment of segments) {
    results.push(...parseAuthorTitleSegments(segment));
  }
  return results;
}

function parseWinnerLine(
  lineText: string,
  periodDecade: string
): YoshikawaEijiWork[] {
  const text = cleanText(lineText);
  const sessionMatch = text.match(/第(\d+)回/);
  if (!sessionMatch) return [];
  if (/受賞作なし/.test(text)) return [];

  const session = Number(sessionMatch[1]);
  const period = sessionToPeriod(session);
  const body = text.replace(/第\d+回\s*/, '');

  const works = parseAuthorTitleSegments(body);
  return works.map((work) => ({
    session,
    period,
    author: work.author,
    title: work.title,
  }));
}

function parseWinners($: cheerio.CheerioAPI): YoshikawaEijiWork[] {
  const winners: YoshikawaEijiWork[] = [];
  const table = $('table').first();

  table.find('tr').each((_, row) => {
    const decade = cleanText($(row).find('th').text());
    if (!decade) return;

    $(row)
      .find('li')
      .each((__, li) => {
        const lineText = cleanText($(li).text());
        if (!lineText.startsWith('第')) return;
        winners.push(...parseWinnerLine(lineText, decade));
      });
  });

  return winners;
}

function findSessionForAnchor(
  anchorText: string,
  winners: YoshikawaEijiWork[]
): number | null {
  const key = cleanText(anchorText);
  if (!key) return null;

  for (const winner of winners) {
    if (winner.title.includes(key) || winner.author.includes(key)) {
      return winner.session;
    }
  }
  return null;
}

function parseNomineeBlocks(
  $: cheerio.CheerioAPI,
  winners: YoshikawaEijiWork[]
): YoshikawaEijiNomineeWork[] {
  const nominees: YoshikawaEijiNomineeWork[] = [];

  for (const winner of winners) {
    nominees.push({
      ...winner,
      won: true,
    });
  }

  $('li').each((_, li) => {
    const text = cleanText($(li).text());
    if (!text.startsWith('候補作')) return;

    const prevAnchor = $(li).parent().prevAll('a').first();
    const anchorText = prevAnchor.text().trim();
    let session = findSessionForAnchor(anchorText, winners);

    if (session === null && /^\d{4}年/.test(anchorText)) {
      const year = Number(anchorText.slice(0, 4));
      session = year - FIRST_SESSION_YEAR + 1;
    }

    if (session === null) return;

    const period = sessionToPeriod(session);
    const body = text.replace(/^候補作\s*/, '');
    const works = parseCandidateText(body);

    for (const work of works) {
      nominees.push({
        session,
        period,
        author: work.author,
        title: work.title,
        won: false,
      });
    }
  });

  return nominees;
}

async function main(): Promise<void> {
  console.log(`Fetching ${WIKIPEDIA_URL}...`);
  const res = await fetch(WIKIPEDIA_URL, {
    headers: { 'User-Agent': 'osusume-bot/1.0 (book recommendation site)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const winners = parseWinners($);
  const nominees = parseNomineeBlocks($, winners);

  if (winners.length < 50) {
    throw new Error(`Expected 50+ winners, got ${winners.length}`);
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
  console.log(`Wrote ${nominees.length} nominee entries to ${NOMINEE_OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

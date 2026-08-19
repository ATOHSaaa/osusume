/**
 * Wikipedia「野間文芸賞」から受賞作・候補作 JSON を生成する。
 * 実行: npx tsx scripts/fetch-noma-bungei-data.ts
 */
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface NomaBungeiWork {
  session: number;
  period: string;
  author: string;
  title: string;
}

export interface NomaBungeiNomineeWork extends NomaBungeiWork {
  won: boolean;
}

const WIKIPEDIA_URL =
  'https://ja.wikipedia.org/wiki/%E9%87%8E%E9%96%93%E6%96%87%E8%8A%B8%E8%B3%9E';
const PRIZE_OUTPUT_PATH = resolve('src/data/noma-bungei-prize.json');
const NOMINEE_OUTPUT_PATH = resolve('src/data/noma-bungei-nominee.json');

function cleanText(text: string): string {
  return text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

function parseYearFromLine(text: string): number | null {
  const m =
    text.match(/第\d+回[（(]\s*(\d{4})年[）)]/) ??
    text.match(/（\s*(\d{4})年）/) ??
    text.match(/\(\s*(\d{4})年\)/);
  return m ? Number(m[1]) : null;
}

function periodFromSession(session: number, lineText: string): string {
  const year = parseYearFromLine(lineText);
  return year ? `${year}年` : `第${session}回`;
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

function isSkippableCandidateText(text: string): boolean {
  return (
    /作者.*不明/.test(text) ||
    /^他\d+作/.test(text) ||
    /^第\d+作/.test(text) ||
    /^候補作\s*$/.test(text)
  );
}

function parseAuthorTitlePairs(text: string): Array<{ author: string; title: string }> {
  const normalized = cleanText(text).replace(/（\d{4}年）/g, ' ');
  const blocks = normalized.includes('/') ? normalized.split(/\s*\/\s*/) : [normalized];
  const results: Array<{ author: string; title: string }> = [];

  for (let block of blocks) {
    block = block
      .replace(/などを中心とした.*$/, '')
      .replace(/ならびに.*$/, '')
      .replace(/その他.*$/, '')
      .replace(/に対して.*$/, '')
      .trim();

    const titleMatches = [...block.matchAll(/『([^』]+)』/g)];
    if (titleMatches.length === 0) continue;

    const firstQuoteIdx = block.indexOf('『');
    let currentAuthor = cleanAuthor(block.slice(0, firstQuoteIdx));

    for (const match of titleMatches) {
      const title = cleanTitle(match[1]);
      if (!title) continue;

      const beforeQuote = block.slice(0, match.index ?? 0);
      const afterPrevTitle = beforeQuote.split('』').pop() ?? beforeQuote;
      const authorMatch = afterPrevTitle.match(/([^『』/、,]+)$/);
      if (authorMatch) {
        const candidate = cleanAuthor(authorMatch[1]);
        if (candidate && candidate.length >= 2) {
          currentAuthor = candidate;
        }
      }

      if (!currentAuthor) continue;
      results.push({ author: currentAuthor, title });
    }
  }

  return results;
}

function parseCandidateText(text: string): Array<{ author: string; title: string }> {
  const segments = cleanText(text).split(/\s+(?=[^\s『、,／/]+『)/);
  const results: Array<{ author: string; title: string }> = [];
  for (const segment of segments) {
    if (isSkippableCandidateText(segment)) continue;
    results.push(...parseAuthorTitlePairs(segment));
  }
  return results;
}

function parseWinnerLine(lineText: string): NomaBungeiWork[] {
  const text = cleanText(lineText);
  const sessionMatch = text.match(/第(\d+)回/);
  if (!sessionMatch) return [];
  if (/受賞作なし/.test(text)) return [];

  const session = Number(sessionMatch[1]);
  const period = periodFromSession(session, text);
  const body = text
    .replace(/第\d+回\s*/, '')
    .replace(/（\d{4}年）/g, '')
    .replace(/\(\d{4}年\)/g, '')
    .trim();
  const winnerBody = body.split(/候補作/)[0]?.trim() ?? body;

  const works = parseAuthorTitlePairs(winnerBody);
  return works.map((work) => ({
    session,
    period,
    author: work.author,
    title: work.title,
  }));
}

function parseWinners($: cheerio.CheerioAPI): NomaBungeiWork[] {
  const winners: NomaBungeiWork[] = [];
  const seen = new Set<string>();
  const table = $('table').first();

  function addWinner(work: NomaBungeiWork): void {
    const key = `${work.session}|${work.author}|${work.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    winners.push(work);
  }

  table.find('tr').each((_, row) => {
    $(row)
      .find('li')
      .each((__, li) => {
        const lineText = cleanText($(li).text());
        if (!lineText.startsWith('第')) return;
        for (const work of parseWinnerLine(lineText)) {
          addWinner(work);
        }
      });
  });

  $('li').each((_, li) => {
    const lineText = cleanText($(li).text());
    if (!lineText.startsWith('第') || lineText.startsWith('候補作')) return;
    for (const work of parseWinnerLine(lineText)) {
      addWinner(work);
    }
  });

  return winners.sort((a, b) => a.session - b.session || a.author.localeCompare(b.author));
}

function findSessionForAnchor(
  anchorText: string,
  winners: NomaBungeiWork[]
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

function periodForSession(session: number, winners: NomaBungeiWork[]): string {
  const winner = winners.find((w) => w.session === session);
  return winner?.period ?? `第${session}回`;
}

function parseNomineeBlocks(
  $: cheerio.CheerioAPI,
  winners: NomaBungeiWork[]
): NomaBungeiNomineeWork[] {
  const nominees: NomaBungeiNomineeWork[] = [];
  const seen = new Set<string>();

  function addNominee(entry: NomaBungeiNomineeWork): void {
    const key = `${entry.session}|${entry.author}|${entry.title}|${entry.won}`;
    if (seen.has(key)) return;
    seen.add(key);
    nominees.push(entry);
  }

  for (const winner of winners) {
    addNominee({ ...winner, won: true });
  }

  $('li').each((_, li) => {
    const el = $(li);
    const text = cleanText(el.text());
    let session: number | null = null;
    let period = '';
    let candidateBody = '';

    if (text.startsWith('候補作')) {
      const prevAnchor = el.parent().prevAll('a').first();
      const anchorText = prevAnchor.text().trim();
      session = findSessionForAnchor(anchorText, winners);
      if (session === null && /^\d{4}年/.test(anchorText)) {
        const year = Number(anchorText.slice(0, 4));
        session = winners.find((w) => w.period === `${year}年`)?.session ?? null;
      }
      candidateBody = text.replace(/^候補作\s*/, '');
    } else if (el.parent().is('ul') && el.parent().parent().is('li')) {
      const parentText = cleanText(el.parent().parent().text());
      const sessionMatch = parentText.match(/第(\d+)回/);
      if (!sessionMatch) return;
      session = Number(sessionMatch[1]);
      candidateBody = text;
    }

    if (session === null) return;
    if (isSkippableCandidateText(candidateBody)) return;

    period = periodForSession(session, winners);
    const works = parseCandidateText(candidateBody);

    for (const work of works) {
      addNominee({
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

  if (winners.length < 40) {
    throw new Error(`Expected 40+ winners, got ${winners.length}`);
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
  const maxSession = Math.max(...winners.map((w) => w.session));
  console.log(`Sessions: 1–${maxSession}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

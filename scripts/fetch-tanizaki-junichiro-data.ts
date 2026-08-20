/**
 * Wikipedia「谷崎潤一郎賞」から受賞作・候補作 JSON を生成する。
 * 実行: npx tsx scripts/fetch-tanizaki-junichiro-data.ts
 */
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface TanizakiJunichiroWork {
  session: number;
  period: string;
  author: string;
  title: string;
}

export interface TanizakiJunichiroNomineeWork extends TanizakiJunichiroWork {
  won: boolean;
}

const WIKIPEDIA_URL =
  'https://ja.wikipedia.org/wiki/%E8%B0%B7%E5%B4%8E%E6%BD%A4%E4%B8%80%E9%83%8E%E8%B3%9E';
const PRIZE_OUTPUT_PATH = resolve('src/data/tanizaki-junichiro-prize.json');
const NOMINEE_OUTPUT_PATH = resolve('src/data/tanizaki-junichiro-nominee.json');

/** 第1回 = 1965年 */
const FIRST_SESSION_YEAR = 1965;

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
    .replace(/^-\s+/, '')
    .replace(/﨑/g, '崎')
    .replace(/を中心とした.*$/, '')
    .replace(/ならびに.*$/, '')
    .replace(/その他.*$/, '')
    .replace(/など.*$/, '')
    .trim();
}

function isNoAwardText(text: string): boolean {
  return /^なし$/.test(text) || /^受賞作なし/.test(text);
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

    const titleMatches = [...block.matchAll(/[『「]([^』」]+)[』」]/g)];
    if (titleMatches.length === 0) continue;

    const firstQuoteIdx = block.search(/[『「]/);
    let currentAuthor = cleanAuthor(block.slice(0, firstQuoteIdx));

    for (const match of titleMatches) {
      const title = cleanTitle(match[1]);
      if (!title || title.length < 2) continue;

      const beforeQuote = block.slice(0, match.index ?? 0);
      const afterPrevTitle = beforeQuote.split(/[』」]/).pop() ?? beforeQuote;
      const authorMatch = afterPrevTitle.match(/([^『「」/、,]+)$/);
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
  const segments = cleanText(text).split(/\s+(?=[^\s『「、,／/]+[『「])/);
  const results: Array<{ author: string; title: string }> = [];
  for (const segment of segments) {
    results.push(...parseAuthorTitlePairs(segment));
  }
  return results;
}

function parseWinnerLine(lineText: string): TanizakiJunichiroWork[] {
  const text = cleanText(lineText);
  const sessionMatch = text.match(/第(\d+)回/);
  if (!sessionMatch) return [];
  if (/受賞作なし/.test(text)) return [];

  const session = Number(sessionMatch[1]);
  const yearMatch = text.match(/[（(]\s*(\d{4})年[）)]/);
  const period = yearMatch ? `${yearMatch[1]}年` : sessionToPeriod(session);
  const body = text
    .replace(/第\d+回\s*/, '')
    .replace(/[（(]\s*\d{4}年[）)]/g, '')
    .replace(/（\d{4}年）/g, '')
    .trim();
  const winnerBody = body.split(/候補作/)[0]?.trim() ?? body;
  const winnerText = winnerBody.replace(/^受賞作[：:]\s*/, '').trim();
  if (isNoAwardText(winnerText)) return [];

  const works = parseAuthorTitlePairs(winnerText);
  return works.map((work) => ({
    session,
    period,
    author: work.author,
    title: work.title,
  }));
}

function parseWinners($: cheerio.CheerioAPI): TanizakiJunichiroWork[] {
  const winners: TanizakiJunichiroWork[] = [];
  const seen = new Set<string>();
  const table = $('table').first();

  function addWinner(work: TanizakiJunichiroWork): void {
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
    if (!lineText.match(/^第\d+回[（(]/)) return;
    for (const work of parseWinnerLine(lineText)) {
      addWinner(work);
    }
  });

  return winners.sort((a, b) => a.session - b.session || a.author.localeCompare(b.author));
}

function findSessionForAnchor(
  anchorText: string,
  winners: TanizakiJunichiroWork[]
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

function periodForSession(session: number, winners: TanizakiJunichiroWork[]): string {
  const winner = winners.find((w) => w.session === session);
  return winner?.period ?? sessionToPeriod(session);
}

function parseNomineeBlocks(
  $: cheerio.CheerioAPI,
  winners: TanizakiJunichiroWork[]
): TanizakiJunichiroNomineeWork[] {
  const nominees: TanizakiJunichiroNomineeWork[] = [];
  const seen = new Set<string>();

  function addNominee(entry: TanizakiJunichiroNomineeWork): void {
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

    const sessionLineMatch = text.match(/第(\d+)回[（(]\s*(\d{4})年[）)]/);
    if (sessionLineMatch) {
      session = Number(sessionLineMatch[1]);
      period = `${sessionLineMatch[2]}年`;
      const nomineeMatch = text.match(/候補作[：:]\s*(.+)$/);
      if (nomineeMatch) {
        candidateBody = nomineeMatch[1];
      }
    } else if (text.startsWith('候補作')) {
      const prevAnchor = el.parent().prevAll('a').first();
      const anchorText = prevAnchor.text().trim();
      session = findSessionForAnchor(anchorText, winners);
      if (session === null && /^\d{4}年/.test(anchorText)) {
        const year = Number(anchorText.slice(0, 4));
        session = year - FIRST_SESSION_YEAR + 1;
      }
      candidateBody = text.replace(/^候補作[：:]\s*/, '');
    }

    if (session === null) return;
    if (!candidateBody) return;

    period = period || periodForSession(session, winners);
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
  const maxSession = Math.max(...winners.map((w) => w.session));
  console.log(`Sessions: 1–${maxSession}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

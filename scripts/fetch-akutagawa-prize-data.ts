/**
 * Wikipedia「芥川賞」受賞者一覧テーブルを取得し JSON を生成する。
 * 実行: npx tsx scripts/fetch-akutagawa-prize-data.ts
 */
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AkutagawaPrizeEntry {
  session: number;
  period: string;
  author: string;
  title: string;
}

const WIKIPEDIA_URL = 'https://ja.wikipedia.org/wiki/%E8%8A%A5%E5%B7%9D%E8%B3%9E';
const OUTPUT_PATH = resolve('src/data/akutagawa-prize.json');

const NO_WINNER = /該当作品なし|受賞作なし|該当なし/;

function parseSession(cell: string): number | null {
  const m = cell.match(/第(\d+)回/);
  return m ? Number(m[1]) : null;
}

function cleanText(text: string): string {
  return text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

function parseTables(html: string): AkutagawaPrizeEntry[] {
  const $ = cheerio.load(html);
  const entries: AkutagawaPrizeEntry[] = [];
  let currentSession: number | null = null;
  let currentPeriod = '';

  $('table.wikitable').each((_, table) => {
    const headers = $(table)
      .find('tr')
      .first()
      .find('th')
      .map((__, th) => cleanText($(th).text()))
      .get();

    if (!headers.includes('回') || !headers.includes('受賞者') || !headers.includes('受賞作')) {
      return;
    }

    $(table)
      .find('tr')
      .slice(1)
      .each((__, row) => {
        const cells = $(row)
          .find('th, td')
          .map((___, cell) => cleanText($(cell).text()))
          .get();

        if (cells.length < 2) return;

        let authorCell = '';
        let titleCell = '';

        if (cells.length >= 4) {
          const [sessionCell, periodCell, author, title] = cells;
          const session = parseSession(sessionCell);
          if (session !== null) {
            currentSession = session;
            currentPeriod = periodCell;
          }
          authorCell = author;
          titleCell = title;
        } else if (cells.length === 3) {
          const session = parseSession(cells[0]);
          if (session !== null) {
            currentSession = session;
            currentPeriod = cells[1];
            authorCell = cells[2];
            titleCell = '';
          } else if (/\d{4}年/.test(cells[0])) {
            currentPeriod = cells[0];
            authorCell = cells[1];
            titleCell = cells[2];
          } else {
            authorCell = cells[0];
            titleCell = cells[1];
          }
        } else {
          authorCell = cells[0];
          titleCell = cells[1];
        }

        if (currentSession === null) return;
        if (!authorCell || NO_WINNER.test(authorCell)) return;
        if (!titleCell) return;

        let title = titleCell.replace(/^[「『]/, '').replace(/[」』]$/, '').trim();
        title = title.replace(/[」』]他$/, ' 他');
        entries.push({
          session: currentSession,
          period: currentPeriod,
          author: authorCell,
          title,
        });
      });
  });

  return entries;
}

async function main(): Promise<void> {
  console.log(`Fetching ${WIKIPEDIA_URL}...`);
  const res = await fetch(WIKIPEDIA_URL, {
    headers: { 'User-Agent': 'osusume-bot/1.0 (book recommendation site)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const entries = parseTables(html);

  if (entries.length < 100) {
    throw new Error(`Expected 100+ entries, got ${entries.length}`);
  }

  const payload = {
    source: WIKIPEDIA_URL,
    fetchedAt: new Date().toISOString().slice(0, 10),
    entries,
  };

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${entries.length} entries to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

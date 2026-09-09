/**
 * 新規文学賞・新人賞の Wikipedia データを取得し JSON を生成する。
 * 実行: npx tsx scripts/fetch-new-awards-data.ts
 */
import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PrizeEntry {
  session: number;
  period: string;
  author: string;
  title: string;
}

interface NomineeEntry extends PrizeEntry {
  won: boolean;
}

const DATA_DIR = resolve('src/data');
const USER_AGENT = 'osusume-bot/1.0 (book recommendation site)';

function cleanText(text: string): string {
  return text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanTitle(title: string): string {
  return title
    .replace(/\[注\s*\d+\]/g, '')
    .replace(/^[\s「『]+/, '')
    .replace(/[\s」』]+$/, '')
    .replace(/[」』]他$/, ' 他')
    .trim();
}

function cleanAuthor(author: string): string {
  return author
    .replace(/\[注\s*\d+\]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function parseSessionPeriod(cell: string): { session: number; period: string } | null {
  const full = cell.match(/第(\d+)回(?:[（(](\d{4})年?[）)])?/);
  if (full) {
    return { session: Number(full[1]), period: full[2] ? `${full[2]}年` : '' };
  }
  const yearOnly = cell.match(/^(\d+)[（(](\d{4})年?[）)]/);
  if (yearOnly) {
    return { session: Number(yearOnly[1]), period: `${yearOnly[2]}年` };
  }
  const sessionOnly = cell.match(/^(\d+)$/);
  if (sessionOnly) {
    return { session: Number(sessionOnly[1]), period: '' };
  }
  return null;
}

async function fetchWiki(title: string): Promise<string> {
  const url = `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
  return res.text();
}

function writePrize(slug: string, source: string, entries: PrizeEntry[]): void {
  const path = resolve(DATA_DIR, `${slug}-prize.json`);
  writeFileSync(
    path,
    `${JSON.stringify({ source, fetchedAt: new Date().toISOString().slice(0, 10), entries }, null, 2)}\n`,
    'utf-8'
  );
  console.log(`  Wrote ${entries.length} prize entries to ${path}`);
}

function writeNominee(slug: string, source: string, entries: NomineeEntry[]): void {
  const path = resolve(DATA_DIR, `${slug}-nominee.json`);
  writeFileSync(
    path,
    `${JSON.stringify({ source, fetchedAt: new Date().toISOString().slice(0, 10), entries }, null, 2)}\n`,
    'utf-8'
  );
  console.log(`  Wrote ${entries.length} nominee entries to ${path}`);
}

/** 標準 wikitable: 回（年）| 受賞者/著者 | 受賞作 */
function parseWikitableWinners(
  html: string,
  options: {
    sessionHeader?: string;
    authorHeader?: string;
    titleHeader?: string;
    prizeHeader?: string;
    winnerPrizeValues?: string[];
    onlyFirstPerSession?: boolean;
  } = {}
): PrizeEntry[] {
  const $ = cheerio.load(html);
  const sessionHeader = options.sessionHeader ?? '回（年）';
  const authorHeaders = [options.authorHeader ?? '受賞者', '著者', '作家'];
  const titleHeaders = [options.titleHeader ?? '受賞作', '受賞作'];
  const prizeHeader = options.prizeHeader ?? '賞';
  const winnerPrizeValues = options.winnerPrizeValues ?? ['正賞', '受賞', '大賞'];
  const entries: PrizeEntry[] = [];
  const seen = new Set<string>();

  $('table.wikitable').each((_, table) => {
    const headers = $(table)
      .find('tr')
      .first()
      .find('th')
      .map((__, th) => cleanText($(th).text()))
      .get();

    const sessionIdx = headers.findIndex((h) => h.includes('回'));
    const authorIdx = headers.findIndex((h) => authorHeaders.some((a) => h.includes(a)));
    const titleIdx = headers.findIndex((h) => titleHeaders.some((t) => h.includes(t)));
    const prizeIdx = headers.indexOf(prizeHeader);

    if (sessionIdx < 0 || authorIdx < 0 || titleIdx < 0) return;

    let currentSession = 0;
    let currentPeriod = '';

    $(table)
      .find('tr')
      .slice(1)
      .each((__, row) => {
        const cells = $(row)
          .find('th, td')
          .map((___, cell) => cleanText($(cell).text()))
          .get();

        if (cells.length < Math.max(sessionIdx, authorIdx, titleIdx) + 1) return;

        const sessionCell = cells[sessionIdx] ?? '';
        const parsed = parseSessionPeriod(sessionCell);
        if (parsed) {
          currentSession = parsed.session;
          if (parsed.period) currentPeriod = parsed.period;
        }
        if (!currentSession) return;

        if (prizeIdx >= 0 && cells[prizeIdx]) {
          const prizeVal = cells[prizeIdx];
          if (!winnerPrizeValues.some((v) => prizeVal.includes(v))) return;
        }

        const author = cleanAuthor(cells[authorIdx]);
        const title = cleanTitle(cells[titleIdx]);
        if (!author || !title || /該当なし|受賞作なし/.test(author + title)) return;

        const key = `${currentSession}|${author}|${title}`;
        if (seen.has(key)) return;
        seen.add(key);

        entries.push({ session: currentSession, period: currentPeriod, author, title });
      });
  });

  if (options.onlyFirstPerSession) {
    const firstBySession = new Map<number, PrizeEntry>();
    for (const entry of entries.sort((a, b) => a.session - b.session)) {
      if (!firstBySession.has(entry.session)) firstBySession.set(entry.session, entry);
    }
    return [...firstBySession.values()].sort((a, b) => a.session - b.session);
  }

  return entries.sort((a, b) => a.session - b.session);
}

function parseWikitableNominees(
  html: string,
  options: {
    sessionHeader?: string;
    authorHeader?: string;
    titleHeader?: string;
    prizeHeader?: string;
    winnerPrizeValues?: string[];
  } = {}
): NomineeEntry[] {
  const $ = cheerio.load(html);
  const sessionHeader = options.sessionHeader ?? '回（年）';
  const authorHeaders = [options.authorHeader ?? '受賞者', '著者', '作家'];
  const titleHeaders = [options.titleHeader ?? '受賞作', '受賞作'];
  const prizeHeader = options.prizeHeader ?? '賞';
  const winnerPrizeValues = options.winnerPrizeValues ?? ['正賞', '受賞', '大賞'];
  const entries: NomineeEntry[] = [];
  const seen = new Set<string>();

  $('table.wikitable').each((_, table) => {
    const headers = $(table)
      .find('tr')
      .first()
      .find('th')
      .map((__, th) => cleanText($(th).text()))
      .get();

    const sessionIdx = headers.findIndex((h) => h.includes('回'));
    const authorIdx = headers.findIndex((h) => authorHeaders.some((a) => h.includes(a)));
    const titleIdx = headers.findIndex((h) => titleHeaders.some((t) => h.includes(t)));
    const prizeIdx = headers.indexOf(prizeHeader);

    if (sessionIdx < 0 || authorIdx < 0 || titleIdx < 0) return;

    let currentSession = 0;
    let currentPeriod = '';

    $(table)
      .find('tr')
      .slice(1)
      .each((__, row) => {
        const cells = $(row)
          .find('th, td')
          .map((___, cell) => cleanText($(cell).text()))
          .get();

        if (cells.length < Math.max(authorIdx, titleIdx) + 1) return;

        const sessionCell = cells[sessionIdx] ?? '';
        const parsed = parseSessionPeriod(sessionCell);
        if (parsed) {
          currentSession = parsed.session;
          if (parsed.period) currentPeriod = parsed.period;
        }
        if (!currentSession) return;

        const author = cleanAuthor(cells[authorIdx]);
        const title = cleanTitle(cells[titleIdx]);
        if (!author || !title) return;

        const prizeVal = prizeIdx >= 0 ? cells[prizeIdx] : '受賞';
        const won = winnerPrizeValues.some((v) => prizeVal.includes(v));
        if (prizeVal === '候補' || prizeVal.includes('候補') || !prizeVal) {
          // nominee row
        } else if (!won && prizeIdx >= 0) {
          return;
        }

        const key = `${currentSession}|${author}|${title}`;
        if (seen.has(key)) return;
        seen.add(key);

        entries.push({
          session: currentSession,
          period: currentPeriod,
          author,
          title,
          won: prizeIdx < 0 ? true : won,
        });
      });
  });

  return entries.sort((a, b) => a.session - b.session);
}

function parseListWinners(html: string, pattern: RegExp): PrizeEntry[] {
  const $ = cheerio.load(html);
  const entries: PrizeEntry[] = [];
  const seen = new Set<string>();

  $('#mw-content-text li').each((_, li) => {
    const text = cleanText($(li).text());
    const m = text.match(pattern);
    if (!m) return;
    const session = Number(m[1]);
    const period = `${m[2]}年`;
    const author = m[3].trim();
    const title = cleanTitle(m[4]);
    const key = `${session}|${author}|${title}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ session, period, author, title });
  });

  return entries.sort((a, b) => a.session - b.session);
}

async function fetchYomiuri(): Promise<void> {
  const title = '読売文学賞';
  const html = await fetchWiki(title);
  const $ = cheerio.load(html);
  let inShosetsu = false;
  const entries: PrizeEntry[] = [];
  const seen = new Set<string>();

  $('#mw-content-text *').each((_, el) => {
    if ($(el).hasClass('mw-heading')) {
      const text = $(el).text().trim();
      if (/^小説賞/.test(text)) inShosetsu = true;
      else if (/^戯曲/.test(text)) inShosetsu = false;
    }
    if (!inShosetsu) return;
    if (el.tagName === 'li' || el.tagName === 'dd') {
      const t = cleanText($(el).text());
      const m = t.match(/^第(\d+)回（(\d{4})年）\s*-\s*(.+?)\s*[「『]([^」』]+)[」』]/);
      if (!m) return;
      const key = `${m[1]}|${m[3]}|${m[4]}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({
        session: Number(m[1]),
        period: `${m[2]}年`,
        author: m[3].trim(),
        title: cleanTitle(m[4]),
      });
    }
  });

  writePrize('yomiuri', `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`, entries);
}

async function fetchKawabata(): Promise<void> {
  const title = '川端康成文学賞';
  const html = await fetchWiki(title);
  const source = `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  const winners: PrizeEntry[] = [];
  const nominees: NomineeEntry[] = [];
  const seenW = new Set<string>();
  const seenN = new Set<string>();

  const $ = cheerio.load(html);
  $('#mw-content-text li').each((_, li) => {
    const t = cleanText($(li).text());
    const header = t.match(/^第(\d+)回（(\d{4})年）\s*(.+)/);
    if (!header) return;

    const session = Number(header[1]);
    const period = `${header[2]}年`;
    const body = header[3];

    const winnerMatch = body.match(/^(.+?)「([^」]+)」/);
    if (winnerMatch) {
      const key = `${session}|${winnerMatch[1]}|${winnerMatch[2]}`;
      if (!seenW.has(key)) {
        seenW.add(key);
        winners.push({
          session,
          period,
          author: winnerMatch[1].trim(),
          title: cleanTitle(winnerMatch[2]),
        });
        nominees.push({
          session,
          period,
          author: winnerMatch[1].trim(),
          title: cleanTitle(winnerMatch[2]),
          won: true,
        });
      }
    }

    const candidatePart = body.split('最終候補作')[1];
    if (!candidatePart) return;
    const candidateMatches = [...candidatePart.matchAll(/(.+?)「([^」]+)」/g)];
    for (const match of candidateMatches) {
      const author = cleanAuthor(match[1]);
      const titleText = cleanTitle(match[2]);
      const key = `${session}|${author}|${titleText}`;
      if (seenN.has(key)) continue;
      seenN.add(key);
      nominees.push({ session, period, author, title: titleText, won: false });
    }
  });

  writePrize('kawabata', source, winners);
  writeNominee('kawabata', source, nominees);
}

async function fetchJapanSf(): Promise<void> {
  const title = '日本SF大賞';
  const html = await fetchWiki(title);
  const entries = parseListWinners(
    html,
    /^第(\d+)回（(\d{4})年）\s*-\s*(.+?)\s*[『「]([^』」]+)[』」]/
  );

  // 新しい形式: 第44回 『タイトル』（著者）
  const $ = cheerio.load(html);
  $('#mw-content-text li').each((_, li) => {
    const t = cleanText($(li).text());
    const m = t.match(/^第(\d+)回\s*[『「]([^』」]+)[』」]（(.+?)）/);
    if (!m) return;
    const session = Number(m[1]);
    if (entries.some((e) => e.session === session)) return;
    entries.push({
      session,
      period: '',
      author: m[3].trim(),
      title: cleanTitle(m[2]),
    });
  });

  entries.sort((a, b) => a.session - b.session);
  writePrize('japan-sf', `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`, entries);
}

async function fetchEdogawaRanpo(): Promise<void> {
  const title = '江戸川乱歩賞';
  const html = await fetchWiki(title);
  const source = `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  const winners = parseWikitableWinners(html, {
    sessionHeader: '回（年度）',
    authorHeader: '著者',
    titleHeader: '受賞作',
    prizeHeader: '賞',
    winnerPrizeValues: ['受賞'],
  });

  const $ = cheerio.load(html);
  const nominees: NomineeEntry[] = [];
  const seen = new Set<string>();

  $('table.wikitable').each((_, table) => {
    const headers = $(table)
      .find('tr')
      .first()
      .find('th')
      .map((__, th) => cleanText($(th).text()))
      .get();

    const sessionIdx = headers.findIndex((h) => h.includes('回'));
    const authorIdx = headers.indexOf('著者');
    const titleIdx = headers.indexOf('受賞作');
    const prizeIdx = headers.indexOf('賞');
    if (sessionIdx < 0 || authorIdx < 0 || titleIdx < 0) return;

    let currentSession = 0;
    let currentPeriod = '';

    $(table)
      .find('tr')
      .slice(1)
      .each((__, row) => {
        const cells = $(row)
          .find('th, td')
          .map((___, cell) => cleanText($(cell).text()))
          .get();
        if (cells.length < titleIdx + 1) return;

        const parsed = parseSessionPeriod(cells[sessionIdx] ?? '');
        if (parsed) {
          currentSession = parsed.session;
          if (parsed.period) currentPeriod = parsed.period;
        }
        if (!currentSession) return;

        const author = cleanAuthor(cells[authorIdx]);
        const titleText = cleanTitle(cells[titleIdx]);
        if (!author || !titleText) return;

        const prizeVal = prizeIdx >= 0 ? cells[prizeIdx] : '';
        const won = prizeVal.includes('受賞');
        if (!won && prizeVal !== '候補' && prizeVal !== '') return;

        const key = `${currentSession}|${author}|${titleText}`;
        if (seen.has(key)) return;
        seen.add(key);
        nominees.push({ session: currentSession, period: currentPeriod, author, title: titleText, won });
      });
  });

  writePrize('edogawa-ranpo', source, winners);
  writeNominee('edogawa-ranpo', source, nominees);
}

async function fetchNewcomerAward(wikiTitle: string, slug: string): Promise<void> {
  const html = await fetchWiki(wikiTitle);
  const source = `https://ja.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`;
  const entries = parseWikitableWinners(html, {
    prizeHeader: '賞',
    winnerPrizeValues: ['正賞', '大賞', '受賞'],
    onlyFirstPerSession: true,
  });

  // 賞列がないテーブル（新潮新人賞など）
  if (entries.length < 10) {
    const alt = parseWikitableWinners(html, { onlyFirstPerSession: true });
    if (alt.length > entries.length) {
      writePrize(slug, source, alt);
      return;
    }
  }

  writePrize(slug, source, entries);
}

async function main(): Promise<void> {
  await fetchYomiuri();
  await fetchEdogawaRanpo();
  await fetchKawabata();
  await fetchJapanSf();
  await fetchNewcomerAward('文學界新人賞', 'bungaku-kai');
  await fetchNewcomerAward('新潮新人賞', 'shincho');
  await fetchNewcomerAward('文藝賞', 'bungei');
  await fetchNewcomerAward('オール讀物新人賞', 'all-yomimono');
  await fetchNewcomerAward('すばる文学賞', 'subaru');
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

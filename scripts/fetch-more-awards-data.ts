/**
 * 追加文学賞・新人賞の Wikipedia データを取得し JSON を生成する。
 * 実行: npx tsx scripts/fetch-more-awards-data.ts
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

const DATA_DIR = resolve('src/data');
const USER_AGENT = 'osusume-bot/1.0 (book recommendation site)';

function cleanText(text: string): string {
  return text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanTitle(title: string): string {
  return title
    .replace(/\[注\s*\d+\]/g, '')
    .replace(/^[\s「『"“]+/, '')
    .replace(/[\s」』"”]+$/, '')
    .replace(/[」』]他$/, ' 他')
    .trim();
}

function cleanAuthor(author: string): string {
  return author
    .replace(/\[注\s*\d+\]/g, '')
    .replace(/^[、,\s]+/, '')
    .replace(/[、,\s]+$/, '')
    .replace(/\s+/g, '')
    .trim();
}

function parseSessionPeriod(cell: string): { session: number; period: string } | null {
  const full = cell.match(/第?(\d+)回(?:[（(](\d{4})年?[）)])?/);
  if (full) {
    return { session: Number(full[1]), period: full[2] ? `${full[2]}年` : '' };
  }
  const yearOnly = cell.match(/^(\d+)[（(](\d{4})年?[）)]/);
  if (yearOnly) {
    return { session: Number(yearOnly[1]), period: `${yearOnly[2]}年` };
  }
  return null;
}

async function fetchWiki(title: string): Promise<{ html: string; source: string }> {
  const source = `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  console.log(`Fetching ${source}...`);
  const res = await fetch(source, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
  return { html: await res.text(), source };
}

function writePrize(slug: string, source: string, entries: PrizeEntry[]): void {
  const path = resolve(DATA_DIR, `${slug}-prize.json`);
  writeFileSync(
    path,
    `${JSON.stringify({ source, fetchedAt: new Date().toISOString().slice(0, 10), entries }, null, 2)}\n`,
    'utf-8'
  );
  console.log(`  Wrote ${entries.length} entries → ${path}`);
}

function parseWikitableWinners(
  html: string,
  options: {
    winnerPrizeValues?: string[];
    onlyFirstPerSession?: boolean;
    authorHeaders?: string[];
    titleHeaders?: string[];
  } = {}
): PrizeEntry[] {
  const $ = cheerio.load(html);
  const winnerPrizeValues = options.winnerPrizeValues ?? ['正賞', '大賞', '受賞'];
  const authorHeaders = options.authorHeaders ?? ['受賞者', '著者', '受賞・候補者'];
  const titleHeaders = options.titleHeaders ?? ['受賞作', '受賞・候補作'];
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

        if (cells.length < Math.max(authorIdx, titleIdx) + 1) return;

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
        if (!author || !title || /該当なし/.test(author + title)) return;

        const key = `${currentSession}|${author}|${title}`;
        if (seen.has(key)) return;
        seen.add(key);
        entries.push({ session: currentSession, period: currentPeriod, author, title });
      });
  });

  const sorted = entries.sort((a, b) => a.session - b.session);
  if (!options.onlyFirstPerSession) return sorted;

  const firstBySession = new Map<number, PrizeEntry>();
  for (const entry of sorted) {
    if (!firstBySession.has(entry.session)) firstBySession.set(entry.session, entry);
  }
  return [...firstBySession.values()].sort((a, b) => a.session - b.session);
}

function parseListEntries(
  html: string,
  linePattern: RegExp,
  extractWorks: (match: RegExpMatchArray, period: string) => Array<{ author: string; title: string }>
): PrizeEntry[] {
  const $ = cheerio.load(html);
  const entries: PrizeEntry[] = [];
  const seen = new Set<string>();

  $('#mw-content-text li').each((_, li) => {
    const text = cleanText($(li).text());
    const match = text.match(linePattern);
    if (!match) return;

    const session = Number(match[1]);
    const period = match[2] ? `${match[2]}年` : '';
    const works = extractWorks(match, period);

    for (const work of works) {
      const key = `${session}|${work.author}|${work.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ session, period, author: cleanAuthor(work.author), title: work.title });
    }
  });

  return entries.sort((a, b) => a.session - b.session);
}

async function fetchJoryuBungei(): Promise<void> {
  const { html, source } = await fetchWiki('女流文学賞');
  const entries = parseListEntries(
    html,
    /^第(\d+)回(?:（(\d{4})年）)?\s*(.+)$/,
    (match) => {
      const body = match[3];
      const works: Array<{ author: string; title: string }> = [];
      const pairs = [...body.matchAll(/(.+?)『([^』]+)』/g)];
      for (const pair of pairs) {
        works.push({ author: cleanAuthor(pair[1]), title: cleanTitle(pair[2]) });
      }
      return works;
    }
  );
  writePrize('joryu-bungei', source, entries);
}

async function fetchHonkakuMystery(): Promise<void> {
  const { html, source } = await fetchWiki('日本推理作家協会賞');
  const entries = parseListEntries(
    html,
    /^第(\d+)回(?:（(\d{4})年）)?\s*長編および連作短編集部門\s*-\s*(.+)$/,
    (match) => {
      const body = match[3];
      const m = body.match(/(.+?)『([^』]+)』/);
      if (!m) return [];
      return [{ author: cleanAuthor(m[1]), title: cleanTitle(m[2]) }];
    }
  );
  writePrize('honkaku-mystery', source, entries);
}

async function fetchKaikoKen(): Promise<void> {
  const { html, source } = await fetchWiki('開高健ノンフィクション賞');
  const entries = parseListEntries(
    html,
    /^第(\d+)回(?:（(\d{4})年）)?\s*-\s*(.+)$/,
    (match) => {
      const body = match[3].split(/（優秀賞）/)[0] ?? match[3];
      const m =
        body.match(/(.+?)『([^』]+)』/) ??
        body.match(/(.+?)「([^」]+)」/);
      if (!m) return [];
      return [{ author: cleanAuthor(m[1]), title: cleanTitle(m[2]) }];
    }
  );
  writePrize('kaiko-ken', source, entries);
}

function isMephistoScheduleRow(author: string): boolean {
  return /^\d{4}年/.test(author) || /刊行予定/.test(author);
}

async function fetchMephisto(): Promise<void> {
  const { html, source } = await fetchWiki('メフィスト賞');
  const $ = cheerio.load(html);
  const entries: PrizeEntry[] = [];
  const seen = new Set<string>();

  $('table.wikitable').each((_, table) => {
    const headers = $(table)
      .find('tr')
      .first()
      .find('th')
      .map((__, th) => cleanText($(th).text()))
      .get();

    const sessionIdx = headers.findIndex((h) => h === '回' || h.includes('回'));
    const authorIdx = headers.findIndex((h) => h.includes('受賞者'));
    const titleIdx = headers.findIndex((h) => h.includes('受賞作'));
    const yearIdx = headers.findIndex((h) => h === '年');

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
        if (yearIdx >= 0 && cells[yearIdx]?.match(/\d{4}/)) {
          currentPeriod = `${cells[yearIdx].match(/\d{4}/)![0]}年`;
        }
        if (!currentSession) return;

        const author = cleanAuthor(cells[authorIdx]);
        const title = cleanTitle(cells[titleIdx]);
        if (!author || !title || isMephistoScheduleRow(author)) return;

        const key = `${currentSession}|${author}|${title}`;
        if (seen.has(key)) return;
        seen.add(key);
        entries.push({ session: currentSession, period: currentPeriod, author, title });
      });
  });

  writePrize('mephisto', source, entries.sort((a, b) => a.session - b.session));
}

async function fetchWikitableAward(
  wikiTitle: string,
  slug: string,
  options?: Parameters<typeof parseWikitableWinners>[1]
): Promise<void> {
  const { html, source } = await fetchWiki(wikiTitle);
  const entries = parseWikitableWinners(html, options);
  writePrize(slug, source, entries);
}

async function fetchDazaiOsamu(): Promise<void> {
  const { html, source } = await fetchWiki('太宰治賞');
  const $ = cheerio.load(html);
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
    const authorIdx = headers.findIndex((h) => ['受賞者', '著者', '受賞・候補者'].some((a) => h.includes(a)));
    const titleIdx = headers.findIndex((h) => ['受賞作', '受賞・候補作'].some((t) => h.includes(t)));
    const prizeIdx = headers.indexOf('賞');
    const hasPrizeColumn = prizeIdx >= 0;

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

        if (cells.length === 0) return;

        const sessionCell = cells[sessionIdx] ?? '';
        const parsed = parseSessionPeriod(sessionCell);
        if (parsed) {
          currentSession = parsed.session;
          if (parsed.period) currentPeriod = parsed.period;
        }

        if (/受賞作なし/.test(cells.join(' '))) {
          if (!currentSession) return;
          const key = `${currentSession}|no-winner`;
          if (seen.has(key)) return;
          seen.add(key);
          entries.push({
            session: currentSession,
            period: currentPeriod,
            author: '',
            title: '受賞作なし',
          });
          return;
        }

        let author = '';
        let title = '';

        const firstCell = cells[0] ?? '';
        const isContinuationRow =
          !parsed &&
          currentSession > 0 &&
          !parseSessionPeriod(firstCell) &&
          !/^(候補|受賞|佳作|優秀作)$/.test(firstCell);

        if (isContinuationRow) {
          author = cleanAuthor(cells[0] ?? '');
          title = cleanTitle(cells[1] ?? '');
        } else if (cells.length < Math.max(authorIdx, titleIdx) + 1) {
          return;
        } else {
          const prizeVal = hasPrizeColumn ? cells[prizeIdx] ?? '' : '';
          if (hasPrizeColumn && prizeVal && !/受賞/.test(prizeVal)) return;

          author = cleanAuthor(cells[authorIdx]);
          title = cleanTitle(cells[titleIdx]);
        }

        if (!author || !title || /該当なし/.test(author + title)) return;

        const key = `${currentSession}|${author}|${title}`;
        if (seen.has(key)) return;
        seen.add(key);
        entries.push({ session: currentSession, period: currentPeriod, author, title });
      });
  });

  writePrize(
    'dazai-osamu',
    source,
    entries.sort((a, b) => a.session - b.session)
  );
}

async function main(): Promise<void> {
  if (process.argv.includes('--dazai-osamu')) {
    await fetchDazaiOsamu();
    console.log('\nDone.');
    return;
  }

  await fetchJoryuBungei();
  await fetchWikitableAward('柴田錬三郎賞', 'shibata-rentaro', {
    winnerPrizeValues: ['正賞', '大賞', '受賞'],
  });
  await fetchWikitableAward('山本周五郎賞', 'yamamoto-shugoro', {
    winnerPrizeValues: ['大賞', '正賞', '受賞'],
  });
  await fetchHonkakuMystery();
  await fetchMephisto();
  await fetchWikitableAward('群像新人文学賞', 'gunzo', {
    winnerPrizeValues: ['当選作', '正賞', '大賞', '受賞'],
    onlyFirstPerSession: true,
  });
  await fetchDazaiOsamu();
  await fetchKaikoKen();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import * as cheerio from 'cheerio';
import { SITE_URL } from './constants';
import type { SearchResult } from './types';

const USER_AGENT =
  `Mozilla/5.0 (compatible; FirstBooksBot/1.0; +${SITE_URL})`;

const FETCH_TIMEOUT_MS = 15_000;

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;

    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html);

  $('script, style, nav, footer, header, aside, iframe, noscript').remove();

  const article =
    $('article').text() ||
    $('main').text() ||
    $('[class*="content"]').text() ||
    $('body').text();

  return article.replace(/\s+/g, ' ').trim();
}

export interface ScrapedPage {
  url: string;
  title: string;
  text: string;
  /** 書籍タイトルの HTML 構造抽出用 */
  html: string;
  siteName?: string;
}

export async function scrapeSearchResults(
  results: SearchResult[]
): Promise<ScrapedPage[]> {
  const pages: ScrapedPage[] = [];

  for (const result of results) {
    process.stdout.write(`  取得中: ${result.url}\n`);
    const html = await fetchHtml(result.url);
    if (!html) continue;

    const text = extractTextFromHtml(html);
    if (text.length < 100) continue;

    pages.push({
      url: result.url,
      title: result.title,
      text: text.slice(0, 30_000),
      html: html.slice(0, 500_000),
      siteName: result.siteName,
    });

    await sleep(500);
  }

  return pages;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

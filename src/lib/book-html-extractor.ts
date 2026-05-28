import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

const BOOK_STORE_PATTERN =
  /amazon\.co\.jp|honto\.jp|books\.rakuten|bookwalker|ebookjapan|cmoa\.jp|kinokuniya/i;

const RANK_PREFIX =
  /^(?:第\s*)?\d{1,2}\s*(?:位[：:\s]*|[\.．、\)]\s*|\)\s*)/;

const AUTHOR_SUFFIX =
  /\s*(?:[／/|｜]\s*|\s+著[：:]|\s+作者[：:]|\s+作[：:]|\s+作\s*[:：]).*$/;

const LIST_ITEM_NOISE =
  /続きを読む|クリック|シェア|関連記事|目次|カテゴリ|タグ|コメント|SNS|ログイン|会員登録|プライバシー|カート|ヘルプ|運営会社|ガイドライン|docomo|エブリスタ|アマゾンプライム|簡易表示|詳細表示|最新刊|無料で読む|小説を探す|1巻を見る/i;

const GENERIC_LINK_TEXT =
  /^(amazon|kindle|honto|楽天|詳細|購入|こちら|商品ページ|読む|チェック|公式|サイト|amazonで見る)$/i;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractQuotedTitle(text: string): string | null {
  const bookQuote = text.match(/[『「]([^』」]{2,60})[』」]/);
  if (bookQuote?.[1]) return collapseWhitespace(bookQuote[1]);

  const anyQuote = text.match(/[「『]([^」』]{2,60})[」』]/);
  if (anyQuote?.[1]) return collapseWhitespace(anyQuote[1]);

  return null;
}

function stripRankPrefix(text: string): string {
  return text.replace(RANK_PREFIX, '').trim();
}

function sanitizeCandidate(raw: string): string | null {
  let text = collapseWhitespace(raw);
  if (!text || text.length < 2 || text.length > 80) return null;
  if (LIST_ITEM_NOISE.test(text)) return null;
  if (/https?:\/\//.test(text)) return null;

  text = stripRankPrefix(text);

  const quoted = extractQuotedTitle(text);
  if (quoted) return quoted;

  text = text.replace(AUTHOR_SUFFIX, '').trim();
  text = stripRankPrefix(text);

  // 「1. タイトル — 著者名」形式
  text = text.replace(/^[\d０-９]+[\.\．、]\s*/, '');

  if (text.length < 2 || text.length > 60) return null;
  return text;
}

function getContentRoot($: cheerio.CheerioAPI): cheerio.Cheerio<Element> {
  $('script, style, nav, footer, header, aside, iframe, noscript').remove();

  const article = $('article').first();
  if (article.length > 0) return article;

  const main = $('main').first();
  if (main.length > 0) return main;

  const content = $('[class*="content"], [class*="entry"], [class*="post"]').first();
  if (content.length > 0) return content;

  return $('body');
}

function addCandidate(found: Set<string>, raw: string | null | undefined): void {
  if (!raw) return;
  const title = sanitizeCandidate(raw);
  if (title) found.add(title);
}

function extractFromListItems(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<Element>,
  found: Set<string>
): void {
  root.find('ol li, ul li').each((_, el) => {
    const $el = $(el);
    const nestedItems = $el.find('ol li, ul li');
    if (nestedItems.length > 0) return;

    const text = collapseWhitespace($el.text());
    if (text.length > 120) return;

    addCandidate(found, text);

    $el.find('a').each((__, anchor) => {
      const linkText = collapseWhitespace($(anchor).text());
      if (linkText && !GENERIC_LINK_TEXT.test(linkText)) {
        addCandidate(found, linkText);
      }
    });
  });
}

function extractFromRankedHeadings(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<Element>,
  found: Set<string>
): void {
  root.find('h2, h3, h4, h5, strong, b').each((_, el) => {
    const text = collapseWhitespace($(el).text());
    if (text.length > 80) return;
    if (!/位|^\d{1,2}[\.\．、]|[『「]/.test(text)) return;
    addCandidate(found, text);
  });
}

function extractFromBookLinks(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<Element>,
  found: Set<string>
): void {
  root.find('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!BOOK_STORE_PATTERN.test(href)) return;

    const linkText = collapseWhitespace($(el).text());
    if (linkText && linkText.length >= 3 && !GENERIC_LINK_TEXT.test(linkText)) {
      addCandidate(found, linkText);
      return;
    }

    const titleAttr = $(el).attr('title');
    if (titleAttr) addCandidate(found, titleAttr);

    const parentLi = $(el).closest('li');
    if (parentLi.length > 0) {
      addCandidate(found, collapseWhitespace(parentLi.text()));
    }
  });
}

function extractFromTableRows(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<Element>,
  found: Set<string>
): void {
  root.find('table tr').each((_, row) => {
    const cells = $(row).find('th, td');
    if (cells.length === 0) return;

    const firstCell = collapseWhitespace($(cells[0]).text());
    if (firstCell.length >= 2 && firstCell.length <= 60) {
      addCandidate(found, firstCell);
    }
  });
}

/** おすすめ記事 HTML から書籍タイトル候補を抽出 */
export function extractBookTitlesFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const root = getContentRoot($);
  const found = new Set<string>();

  extractFromListItems($, root, found);
  extractFromRankedHeadings($, root, found);
  extractFromBookLinks($, root, found);
  extractFromTableRows($, root, found);

  return [...found];
}

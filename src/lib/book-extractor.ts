import type { ArticleSubject } from './article-subject';
import { isMatchingAuthor } from './author-match';
import { extractBookTitlesFromHtml } from './book-html-extractor';
import {
  isExcludedBook,
  isPlausibleBookTitle,
  normalizeTitle,
} from './book-title-filter';
import { BOOK_TITLE_CANONICAL_ALIASES } from './constants';
import type { BookMention } from './types';
import type { ScrapedPage } from './scraper';

/** 他作家の代表作がおすすめ記事のノイズで混入するのを防ぐ */
const KNOWN_BOOK_AUTHORS: Record<string, string> = {
  健やかな論理: '江國香織',
  そんなの痛いに決まってる: '江國香織',
  鍵のかかった部屋: '窪田洋子',
  指輪物語: 'トールキン',
  ロードオブザリング: 'トールキン',
  レーエンデ国物語: 'ル・グイン',
  ゲームオブスローンズ: 'マーティン',
  ハリー・ポッター: 'ローリング',
  竜馬がゆく: '司馬遼太郎',
  宮本武蔵: '吉川英治',
  徳川家康: '山岡荘八',
  三国志: '吉川英治',
  関ケ原: '司馬遼太郎',
  真田太平記: '池波正太郎',
  '100万回生きたねこ': '佐野洋子',
  仮面の告白: '三島由紀夫',
  危険な斜面: '島崎藤村',
  博士の愛した数式: '小川洋子',
  Another: '綾辻行人',
  薬屋のひとりごと: '日向夏',
  ビブリア古書堂の事件手帖: '三上延',
  ようこそ実力至上主義の教室へ: '衣笠彰梧',
  君の膵臓をたべたい: '住野よる',
  金閣寺: '三島由紀夫',
  こころ: '夏目漱石',
  羅生門: '芥川龍之介',
  雪国: '川端康成',
  精霊の守り人: '上橋菜穂子',
  美しい彼: '凪良ゆう',
  不毛地帯: '山崎豊子',
};

const BOOK_PATTERNS = [
  /「([^」]{2,60})」/g,
  /『([^』]{2,60})』/g,
  /(?:作品|書籍|小説|本)[：:]\s*[「『]?([^」』\n、。]{2,40})[」』]?/g,
  /(?:『|「)([^』」]{2,40})(?:』|」)/g,
];

/** 単独では書籍タイトルにならないシリーズ愛称・略称・UI文言は book-title-filter で除外 */

/** 別名（ブレードランナー等）を第1作・原作タイトルに寄せる */
export function resolveCanonicalBookTitle(title: string): string {
  const normalized = normalizeTitle(title);
  return BOOK_TITLE_CANONICAL_ALIASES[normalized] ?? title;
}

function matchesKnownBookTitle(normalized: string, bookTitle: string): boolean {
  const bookNorm = normalizeTitle(bookTitle);
  return (
    normalized === bookNorm ||
    normalized.includes(bookNorm) ||
    bookNorm.includes(normalized)
  );
}

/** Amazon 照合などで使う、作品タイトルからの期待著者 */
export function getKnownBookAuthor(title: string): string | undefined {
  const normalized = normalizeTitle(title);
  for (const [bookTitle, owner] of Object.entries(KNOWN_BOOK_AUTHORS)) {
    if (matchesKnownBookTitle(normalized, bookTitle)) {
      return owner;
    }
  }
  return undefined;
}

export function isBookByOtherAuthor(
  title: string,
  articleAuthor: string
): boolean {
  const normalized = normalizeTitle(title);
  for (const [bookTitle, owner] of Object.entries(KNOWN_BOOK_AUTHORS)) {
    if (matchesKnownBookTitle(normalized, bookTitle)) {
      return !isMatchingAuthor(articleAuthor, owner);
    }
  }
  return false;
}

export { isExcludedBook, normalizeTitle } from './book-title-filter';

function extractFromText(text: string): string[] {
  const found = new Set<string>();

  for (const pattern of BOOK_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const raw = match[1]?.trim();
      if (!raw || !isPlausibleBookTitle(raw)) continue;
      found.add(normalizeTitle(raw));
    }
  }

  return [...found];
}

function buildOpenAIPrompt(subject: ArticleSubject, combined: string): string {
  if (subject.kind === 'manga') {
    return `「${subject.label}」のおすすめ漫画に関する記事テキストです。この中で紹介されている漫画・コミックスのタイトルをすべて抽出してください。

出力形式:
{"books": ["タイトル1", "タイトル2", ...]}

ルール:
- ${subject.label}関連の漫画・コミックスタイトルのみ
- 成人向け・官能・R18・アダルト漫画は含めない
- シリーズ名や副題は含めてよい
- 重複は除く
- 記事の見出しやサイト名は含めない

テキスト:
${combined}`;
  }

  if (subject.kind === 'genre') {
    return `ジャンル「${subject.label}」のおすすめ小説に関する記事テキストです。この中で紹介されている小説・書籍のタイトルをすべて抽出してください。

出力形式:
{"books": ["タイトル1", "タイトル2", ...]}

ルール:
- ${subject.label}関連の小説・書籍タイトルのみ
- 成人向け・官能・R18・アダルト小説は含めない
- シリーズ名や副題は含めてよい
- 重複は除く
- 記事の見出しやサイト名は含めない

テキスト:
${combined}`;
  }

  return `作家「${subject.label}」に関するおすすめ記事のテキストです。この中で紹介されている${subject.label}の作品（書籍・小説）タイトルをすべて抽出してください。

出力形式:
{"books": ["タイトル1", "タイトル2", ...]}

ルール:
- ${subject.label}の作品タイトルのみ
- 成人向け・官能・R18・アダルト小説は含めない
- シリーズ名や副題は含めてよい
- 重複は除く
- 記事の見出しやサイト名は含めない

テキスト:
${combined}`;
}

async function extractWithOpenAI(
  pages: ScrapedPage[],
  subject: ArticleSubject
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const combined = pages
    .map((p) => `--- ${p.title} (${p.url}) ---\n${p.text.slice(0, 4000)}`)
    .join('\n\n')
    .slice(0, 24_000);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'あなたは日本語の書籍名を抽出するアシスタントです。記事テキストから書籍・小説のタイトルのみをJSONで返してください。',
        },
        {
          role: 'user',
          content: buildOpenAIPrompt(subject, combined),
        },
      ],
    }),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) return [];

  try {
    const parsed = JSON.parse(content) as { books?: string[] };
    return (parsed.books ?? [])
      .map(normalizeTitle)
      .filter(isPlausibleBookTitle);
  } catch {
    return [];
  }
}

export async function extractBooks(
  pages: ScrapedPage[],
  subject: ArticleSubject
): Promise<BookMention[]> {
  const counts = new Map<
    string,
    { count: number; sources: Set<string>; displayTitle: string }
  >();

  let htmlTitleCount = 0;
  let textFallbackPages = 0;

  function addBook(rawTitle: string, sourceUrl: string) {
    const normalized = normalizeTitle(rawTitle);
    if (!isPlausibleBookTitle(normalized)) return;
    if (
      subject.kind === 'author' &&
      isBookByOtherAuthor(normalized, subject.label)
    ) {
      return;
    }

    const displayTitle = resolveCanonicalBookTitle(rawTitle);
    const mapKey = normalizeTitle(displayTitle);

    const existing = counts.get(mapKey);
    if (existing) {
      existing.sources.add(sourceUrl);
      existing.count = existing.sources.size;
    } else {
      counts.set(mapKey, {
        count: 1,
        sources: new Set([sourceUrl]),
        displayTitle,
      });
    }
  }

  for (const page of pages) {
    const fromHtml = page.html
      ? extractBookTitlesFromHtml(page.html)
      : [];
    const titles =
      fromHtml.length > 0 ? fromHtml : extractFromText(page.text);

    if (fromHtml.length > 0) {
      htmlTitleCount += fromHtml.length;
    } else {
      textFallbackPages += 1;
    }

    for (const title of titles) {
      addBook(title, page.url);
    }
  }

  console.log(
    `  構造抽出: ${htmlTitleCount}件 / テキストfallback: ${textFallbackPages}ページ`
  );

  const aiBooks = await extractWithOpenAI(pages, subject);
  for (const title of aiBooks) {
    let matched = false;
    for (const page of pages) {
      if (page.text.includes(title) || page.text.includes(title.slice(0, 4))) {
        addBook(title, page.url);
        matched = true;
        break;
      }
    }
    if (!matched) {
      console.warn(`  OpenAI候補を除外（本文に未出現）: ${title}`);
    }
  }

  return [...counts.entries()]
    .filter(([title]) => {
      if (isExcludedBook(title)) return false;
      if (subject.kind === 'author' && isBookByOtherAuthor(title, subject.label)) {
        return false;
      }
      return true;
    })
    .map(([, { sources, displayTitle }]) => ({
      title: displayTitle,
      count: sources.size,
      sources: [...sources],
    }))
    .sort((a, b) => b.count - a.count);
}

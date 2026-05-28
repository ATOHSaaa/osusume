import type { ArticleSubject } from './article-subject';
import { isAdultContent } from './adult-content';
import { isMatchingAuthor } from './author-match';
import { isLaterSeriesVolume } from './book-format';
import { extractBookTitlesFromHtml } from './book-html-extractor';
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

/** 単独では書籍タイトルにならないシリーズ愛称・略称・UI文言 */
const EXCLUDED_EXACT_TITLES = [
  'ガリレオ',
  'トップ',
  'カート',
  'イメージ',
  '簡易表示',
  '詳細表示',
  'スタートレック',
  'スペースオペラ',
];

const EXCLUDED_TITLE_PATTERNS = [
  /ユリイカ/i,
  /\d{4}年\d{1,2}月号/,
  /文[藝艺]春秋/i,
  /キネマ旬報/i,
  /小説すばる/i,
  /パンフレット/i,
  /韓国・フェミニズム・日本/i,
  /コミックス|漫画版|マンガ版/i,
  /モーニングコミックス|ジャンプコミックス|少年マガジンコミックス/i,
];

const NOISE_PATTERNS = [
  /^(おすすめ|ランキング|ベスト|人気|初心者|入門|まとめ|一覧|選)$/,
  /^(著者|作者|作家|出版社|発売|読了|感想|レビュー)$/,
  /^(Amazon|Kindle|楽天|書店|無料|試し読み|ライトノベル|ラノベ)$/i,
  /^Amazonで見る$/i,
  /^検証時価格/,
  /^小説家になろう/,
  /^なろう$/,
  /異世界[（(]総合[）)]/,
  /異世界転生[（(]/,
  /^\d+$/,
  /^.{1,2}$/,
  /https?:\/\//,
  /[｜|]/,
  /¥|￥/,
  /^#/,
  /発売日/,
  /カートを見る/,
  /最新刊/,
  /小説を探す/,
  /ヘルプ/,
  /運営会社/,
  /ガイドライン/,
  /docomo/,
  /エブリスタ/,
  /アマゾンプライム/,
  /無料で読む/,
  /リーダーシップ/,
  /心理的柔軟性/,
  /伝える力/,
  /コミュニティ・オブ・プラクティス/,
  /この商品を含むブログ/,
  /マネタイズ/,
  /URLをコピー/,
  /少年・青年マンガ|少女・女性マンガ/,
  /レンタル落ち/,
  /第\d+回.*映画/,
  /映画祭.*賞/,
  /私小説論/,
  /^私小説$/,
  /私小説言説/,
  /私小説は死んだ/,
  /私小説は日本独自/,
  /^本・小説/,
  /^小説・文庫$/,
  /^心境小説$/,
  /^自伝的小説$/,
  /^書簡体小説$/,
  /^書簡文学$/,
  /^学園もの$/,
  /^ライト文芸$/,
  /^純文学$/,
  /^shopping_cart/,
  /^発売元$/,
  /^ページ数$/,
  /^制作会社$/,
];

export function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[：:].*$/, '')
    .trim();
}

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

export function isExcludedBook(title: string): boolean {
  if (isAdultContent(title)) return true;
  if (isLaterSeriesVolume(title)) return true;

  const normalized = normalizeTitle(title);
  if (EXCLUDED_EXACT_TITLES.includes(normalized)) return true;

  const candidates = [title, normalized];
  for (const candidate of candidates) {
    for (const pattern of EXCLUDED_TITLE_PATTERNS) {
      if (pattern.test(candidate)) return true;
    }
  }
  return false;
}

function isLikelyBookTitle(title: string): boolean {
  if (isExcludedBook(title)) return false;

  const normalized = normalizeTitle(title);
  if (normalized.length < 2 || normalized.length > 50) return false;

  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }

  const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(normalized);
  if (!hasJapanese) return false;
  if (/[\uFFFD]/.test(title) || /�/.test(title)) return false;
  return true;
}

function extractFromText(text: string): string[] {
  const found = new Set<string>();

  for (const pattern of BOOK_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const raw = match[1]?.trim();
      if (!raw || !isLikelyBookTitle(raw)) continue;
      found.add(normalizeTitle(raw));
    }
  }

  return [...found];
}

function buildOpenAIPrompt(subject: ArticleSubject, combined: string): string {
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
      .filter(isLikelyBookTitle);
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
    if (!isLikelyBookTitle(normalized)) return;
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

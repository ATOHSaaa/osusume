import { isAdultContent } from './adult-content';
import { isMatchingAuthor } from './author-match';

export type BookFormat =
  | 'kindle'
  | 'bunko'
  | 'youth_bunko'
  | 'bundle'
  | 'tankobon'
  | 'other'
  | 'excluded';

const FORMAT_PRIORITY: Record<BookFormat, number> = {
  kindle: 0,
  bunko: 1,
  youth_bunko: 2,
  bundle: 3,
  tankobon: 4,
  other: 5,
  excluded: 99,
};

interface FormatSource {
  title?: string;
  binding?: string;
  productGroup?: string;
  author?: string;
}

export function isGuideOrCommentaryProduct(source: FormatSource): boolean {
  const title = source.title ?? '';
  return /完全読本|入門[:：]|ガイド|見る前に知って|解説本|読む前に|評伝選|日本評伝|私小説論|文学論|レター教室|恋文の技術|ベスト・ショート|アンソロジー|傑作選|作品選|3分で読める|3分名作|名作文庫/.test(
    title
  );
}

export function isForeignEditionProduct(source: FormatSource): boolean {
  const title = source.title ?? '';
  return /\[韓国語版\]|\[中国語版\]|\[英語版\]|韓国語版|中国語版/.test(title);
}

export function isYouthAbridgedProduct(source: FormatSource): boolean {
  const title = source.title ?? '';
  return /10歳までに読みたい|10才までに|少年文庫|つばさ文庫|角川つばさ|青い鳥文庫|わくわくライブラリー/.test(
    title
  );
}

export function isMangaProduct(source: FormatSource): boolean {
  const title = source.title ?? '';
  const binding = source.binding ?? '';
  const productGroup = source.productGroup ?? '';
  const text = `${title} ${binding} ${productGroup}`;

  const normalized = text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );

  return (
    /コミック|コミックス|漫画|マンガ|まんが|comic/i.test(normalized) ||
    /まんがで読破/.test(normalized) ||
    /BRIDGE\s*COMICS|少年マガジン|少女コミック|ジャンプコミックス|モーニングコミックス|ビッグコミックス|ヤングジャンプ/i.test(
      normalized
    ) ||
    /モーニング\s*KC|ジャンプ\s*KC|\bKC\b|講談社コミック|BUNCOMI/i.test(normalized) ||
    /[（(【\[]\s*コミック\s*[）)\]】]/.test(normalized) ||
    /\(\d+\)/.test(normalized) ||
    /（\s*\d+\s*）\s*$/.test(normalized) ||
    /第\d+巻|全\d+巻/.test(normalized)
  );
}

export function cleanBookTitleForSearch(title: string): string {
  return title
    .replace(/[（(【\[][^）)\]】]*[）)\]】]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBookTitleForMatch(title: string): string {
  return title
    .replace(/\s+/g, '')
    .replace(/[（(【\[][^）)\]】]*[）)\]】]/g, '')
    .replace(/[:：].*$/, '')
    .replace(/[／/|].*$/, '');
}

export function isRelevantBookResult(
  searchTitle: string,
  resultTitle: string
): boolean {
  const query = normalizeBookTitleForMatch(searchTitle);
  const result = normalizeBookTitleForMatch(resultTitle);

  if (query.length < 2 || result.length < 2) return false;

  if (result === query || query === result) return true;

  if (result.startsWith(query)) {
    const remainder = result.slice(query.length);
    if (remainder.length === 0) return true;
    if (/^[（(【\[]/.test(remainder)) return true;
    // 「デューク」が「デューク更家の…」に誤マッチするのを防ぐ
    if (query.length <= 8 && /^[\u4e00-\u9faf\u3040-\u30ffァ-ヴ]/.test(remainder)) {
      return false;
    }
    return true;
  }

  if (query.startsWith(result) && result.length >= 4) return true;

  if (result.includes(query) && !result.startsWith(query)) {
    if (query.length / result.length < 0.55) return false;
  }

  const prefixLength = Math.min(6, query.length);
  const queryPrefix = query.slice(0, prefixLength);
  return query.includes(result.slice(0, prefixLength));
}

export function detectBookFormat(source: FormatSource): BookFormat {
  const title = source.title ?? '';
  const binding = source.binding ?? '';
  const productGroup = source.productGroup ?? '';
  const text = `${title} ${binding} ${productGroup}`;

  if (isAdultContent(source)) {
    return 'excluded';
  }

  if (/audible|オーディオ|audiobook|聴書|朗読/i.test(text)) {
    return 'excluded';
  }

  if (/Kstargate|限定(?:版|商品)|★★.*限定|英語文庫/i.test(text)) {
    return 'excluded';
  }

  if (/シリーズ|セット|全\d+巻|\d+巻(?:セット|コンプリート)|コンプリート/i.test(text)) {
    return 'bundle';
  }

  if (/kindle|キンドル/i.test(text)) {
    return 'kindle';
  }

  if (/つばさ文庫|角川つばさ/.test(text)) {
    return 'youth_bunko';
  }

  if (/文庫/.test(text)) {
    return 'bunko';
  }

  if (/単行本|ハードカバー|新書館|愛蔵版/.test(text)) {
    return 'tankobon';
  }

  if (/^paperback$/i.test(binding.trim()) || binding === 'ペーパーバック') {
    return 'bunko';
  }

  if (/^hardcover$/i.test(binding.trim()) || binding === 'ハードカバー') {
    return 'tankobon';
  }

  return 'other';
}

export function getFormatPriority(format: BookFormat): number {
  return FORMAT_PRIORITY[format];
}

/**
 * シリーズの中巻・下巻・2巻以降ほどスコアが悪くなる（大きいほど Amazon 候補として不利）。
 * 「上」「第1巻」など第1部は 0。
 */
export function getSeriesVolumePenalty(title: string): number {
  const t = title;

  if (/[（(]\s*上\s*[）)]|第\s*1\s*巻|１\s*巻|\s1\s*[（(〔]|[（(]\s*一\s*[）)]|（一）/.test(t)) {
    return 0;
  }

  if (/[（(]\s*(下|中)\s*[）)]/.test(t)) return 80;
  if (/ふたたび|再びあらわる|その[2-9２-９]/.test(t)) return 80;
  if (/クロニクル|外伝|スピンオフ|サイドストーリー|episode|エピソード/i.test(t)) return 80;
  if (/[0-9０-９]+年生編/.test(t)) return 80;
  if (/第\s*[2-9２-９]\s*巻/.test(t)) return 80;
  if (/\s(1[0-9]|[2-9])\s*(?:\(|（|$|巻|BUNCOMI)/.test(t)) return 80;
  if (/\s([１-９][０-９]|[２-９])\s*(?:\(|（|$|巻)/.test(t)) return 80;
  if (/事件手帖\s*[Ⅴ-ⅩVIX]+|事件手帖[2-9２-９7-9７-９]/.test(t)) return 80;
  if (/\s0[2-9]\s/.test(t)) return 80;
  if (/\s([2-9]|[２-９])\s*[（(〔]/.test(t)) return 70;
  if (/\s([2-9]|[２-９])\s*$/.test(t)) return 70;
  if (/[（(〔]\s*([2-9]|[２-９])\s*[）)〕]\s*$/.test(t)) return 70;

  return 0;
}

/** ランキングに載せない中巻以降か */
export function isLaterSeriesVolume(title: string): boolean {
  return getSeriesVolumePenalty(title) >= 70;
}

export function pickPreferredSearchItem<T extends FormatSource>(
  items: T[],
  searchTitle: string,
  expectedAuthor?: string
): T | null {
  const relevant = items.filter(
    (item) => item.title && isRelevantBookResult(searchTitle, item.title)
  );

  let best: T | null = null;
  let bestScore = Infinity;

  for (const item of relevant) {
    if (isMangaProduct(item)) continue;
    if (isGuideOrCommentaryProduct(item)) continue;
    if (isForeignEditionProduct(item)) continue;
    if (isYouthAbridgedProduct(item)) continue;
    if (isAdultContent(item)) continue;

    const format = detectBookFormat(item);
    if (format === 'excluded' || format === 'bundle') continue;

    if (
      expectedAuthor &&
      item.author &&
      !isMatchingAuthor(expectedAuthor, item.author)
    ) {
      continue;
    }

    const priority =
      getFormatPriority(format) + getSeriesVolumePenalty(item.title ?? '');

    if (priority < bestScore) {
      best = item;
      bestScore = priority;
    }
  }

  return best;
}

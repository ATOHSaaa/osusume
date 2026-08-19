import prizeData from '../data/honya-taisho-prize.json';

export interface HonyaTaishoPrizeWinner {
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface HonyaTaishoPrizeEntry extends HonyaTaishoPrizeWinner {
  session: number;
  period: string;
}

export interface HonyaTaishoPrizeSession {
  session: number;
  period: string;
  winners: HonyaTaishoPrizeWinner[];
}

export const HONYA_TAISHO_PRIZE_SOURCE = prizeData.source;
export const HONYA_TAISHO_PRIZE_FETCHED_AT = prizeData.fetchedAt;

export const honyaTaishoPrizeEntries: HonyaTaishoPrizeEntry[] = prizeData.entries;

export function groupHonyaTaishoPrizeBySession(
  entries: HonyaTaishoPrizeEntry[] = honyaTaishoPrizeEntries
): HonyaTaishoPrizeSession[] {
  const bySession = new Map<number, HonyaTaishoPrizeSession>();

  for (const entry of entries) {
    const existing = bySession.get(entry.session);
    const winner: HonyaTaishoPrizeWinner = {
      author: entry.author,
      title: entry.title,
      asin: entry.asin,
      amazonUrl: entry.amazonUrl,
      price: entry.price,
    };
    if (existing) {
      existing.winners.push(winner);
    } else {
      bySession.set(entry.session, {
        session: entry.session,
        period: entry.period,
        winners: [winner],
      });
    }
  }

  return [...bySession.values()].sort((a, b) => b.session - a.session);
}

/** 作家名の表記ゆれ・別名を正規化名へ寄せる */
const AUTHOR_NAME_ALIASES: Record<string, string> = {
  中田永一: '乙一',
};

/** 作家名の表記ゆれを吸収して記事 slug を引く */
export function normalizeAuthorName(name: string): string {
  const collapsed = name.replace(/\s+/g, '').replace(/Ｋ/g, 'K');
  return AUTHOR_NAME_ALIASES[collapsed] ?? collapsed;
}

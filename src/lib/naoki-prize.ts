import prizeData from '../data/naoki-prize.json';

export interface NaokiPrizeWinner {
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface NaokiPrizeEntry extends NaokiPrizeWinner {
  session: number;
  period: string;
}

export interface NaokiPrizeSession {
  session: number;
  period: string;
  winners: NaokiPrizeWinner[];
}

export const NAOKI_PRIZE_SOURCE = prizeData.source;
export const NAOKI_PRIZE_FETCHED_AT = prizeData.fetchedAt;

export const naokiPrizeEntries: NaokiPrizeEntry[] = prizeData.entries;

export function groupNaokiPrizeBySession(
  entries: NaokiPrizeEntry[] = naokiPrizeEntries
): NaokiPrizeSession[] {
  const bySession = new Map<number, NaokiPrizeSession>();

  for (const entry of entries) {
    const existing = bySession.get(entry.session);
    const winner: NaokiPrizeWinner = {
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

/** 作家名の表記ゆれを吸収して記事 slug を引く */
export function normalizeAuthorName(name: string): string {
  return name.replace(/\s+/g, '').replace(/Ｋ/g, 'K');
}

import prizeData from '../data/noma-bungei-prize.json';

export interface NomaBungeiPrizeWinner {
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface NomaBungeiPrizeEntry extends NomaBungeiPrizeWinner {
  session: number;
  period: string;
}

export interface NomaBungeiPrizeSession {
  session: number;
  period: string;
  winners: NomaBungeiPrizeWinner[];
}

export const NOMA_BUNGEI_PRIZE_SOURCE = prizeData.source;
export const NOMA_BUNGEI_PRIZE_FETCHED_AT = prizeData.fetchedAt;

export const nomaBungeiPrizeEntries: NomaBungeiPrizeEntry[] = prizeData.entries;

export function groupNomaBungeiPrizeBySession(
  entries: NomaBungeiPrizeEntry[] = nomaBungeiPrizeEntries
): NomaBungeiPrizeSession[] {
  const bySession = new Map<number, NomaBungeiPrizeSession>();

  for (const entry of entries) {
    const existing = bySession.get(entry.session);
    const winner: NomaBungeiPrizeWinner = {
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
  return name.replace(/\s+/g, '').replace(/Ｋ/g, 'K').replace(/瀧/g, '滝');
}

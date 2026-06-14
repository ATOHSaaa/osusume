import prizeData from '../data/akutagawa-prize.json';

export interface AkutagawaPrizeWinner {
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface AkutagawaPrizeEntry extends AkutagawaPrizeWinner {
  session: number;
  period: string;
}

export interface AkutagawaPrizeSession {
  session: number;
  period: string;
  winners: AkutagawaPrizeWinner[];
}

export const AKUTAGAWA_PRIZE_SOURCE = prizeData.source;
export const AKUTAGAWA_PRIZE_FETCHED_AT = prizeData.fetchedAt;

export const akutagawaPrizeEntries: AkutagawaPrizeEntry[] = prizeData.entries;

export function groupAkutagawaPrizeBySession(
  entries: AkutagawaPrizeEntry[] = akutagawaPrizeEntries
): AkutagawaPrizeSession[] {
  const bySession = new Map<number, AkutagawaPrizeSession>();

  for (const entry of entries) {
    const existing = bySession.get(entry.session);
    const winner: AkutagawaPrizeWinner = {
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

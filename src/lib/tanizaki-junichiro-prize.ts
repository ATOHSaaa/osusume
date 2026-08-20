import prizeData from '../data/tanizaki-junichiro-prize.json';

export interface TanizakiJunichiroPrizeWinner {
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface TanizakiJunichiroPrizeEntry extends TanizakiJunichiroPrizeWinner {
  session: number;
  period: string;
}

export interface TanizakiJunichiroPrizeSession {
  session: number;
  period: string;
  winners: TanizakiJunichiroPrizeWinner[];
}

export const TANIZAKI_JUNICHIRO_PRIZE_SOURCE = prizeData.source;
export const TANIZAKI_JUNICHIRO_PRIZE_FETCHED_AT = prizeData.fetchedAt;

export const tanizakiJunichiroPrizeEntries: TanizakiJunichiroPrizeEntry[] = prizeData.entries;

export function groupTanizakiJunichiroPrizeBySession(
  entries: TanizakiJunichiroPrizeEntry[] = tanizakiJunichiroPrizeEntries
): TanizakiJunichiroPrizeSession[] {
  const bySession = new Map<number, TanizakiJunichiroPrizeSession>();

  for (const entry of entries) {
    const existing = bySession.get(entry.session);
    const winner: TanizakiJunichiroPrizeWinner = {
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
  return name.replace(/\s+/g, '').replace(/Ｋ/g, 'K').replace(/瀧/g, '滝').replace(/﨑/g, '崎');
}

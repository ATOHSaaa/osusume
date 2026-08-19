import prizeData from '../data/yoshikawa-eiji-prize.json';

export interface YoshikawaEijiPrizeWinner {
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface YoshikawaEijiPrizeEntry extends YoshikawaEijiPrizeWinner {
  session: number;
  period: string;
}

export interface YoshikawaEijiPrizeSession {
  session: number;
  period: string;
  winners: YoshikawaEijiPrizeWinner[];
}

export const YOSHIKAWA_EIJI_PRIZE_SOURCE = prizeData.source;
export const YOSHIKAWA_EIJI_PRIZE_FETCHED_AT = prizeData.fetchedAt;

export const yoshikawaEijiPrizeEntries: YoshikawaEijiPrizeEntry[] = prizeData.entries;

export function groupYoshikawaEijiPrizeBySession(
  entries: YoshikawaEijiPrizeEntry[] = yoshikawaEijiPrizeEntries
): YoshikawaEijiPrizeSession[] {
  const bySession = new Map<number, YoshikawaEijiPrizeSession>();

  for (const entry of entries) {
    const existing = bySession.get(entry.session);
    const winner: YoshikawaEijiPrizeWinner = {
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

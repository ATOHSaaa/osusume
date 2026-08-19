import nomineeData from '../data/yoshikawa-eiji-nominee.json';
import { normalizeAuthorName } from './yoshikawa-eiji-prize';

export interface YoshikawaEijiNomineeWork {
  author: string;
  title: string;
  won: boolean;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface YoshikawaEijiNomineeEntry extends YoshikawaEijiNomineeWork {
  session: number;
  period: string;
}

export interface YoshikawaEijiNomineeSession {
  session: number;
  period: string;
  nominees: YoshikawaEijiNomineeWork[];
}

export const YOSHIKAWA_EIJI_NOMINEE_SOURCE = nomineeData.source;
export const YOSHIKAWA_EIJI_NOMINEE_FETCHED_AT = nomineeData.fetchedAt;

export const yoshikawaEijiNomineeEntries: YoshikawaEijiNomineeEntry[] =
  nomineeData.entries;

export function groupYoshikawaEijiNomineeBySession(
  entries: YoshikawaEijiNomineeEntry[] = yoshikawaEijiNomineeEntries
): YoshikawaEijiNomineeSession[] {
  const bySession = new Map<number, YoshikawaEijiNomineeSession>();

  for (const entry of entries) {
    const work: YoshikawaEijiNomineeWork = {
      author: entry.author,
      title: entry.title,
      won: entry.won,
      asin: entry.asin,
      amazonUrl: entry.amazonUrl,
      price: entry.price,
    };

    const existing = bySession.get(entry.session);
    if (existing) {
      existing.nominees.push(work);
    } else {
      bySession.set(entry.session, {
        session: entry.session,
        period: entry.period,
        nominees: [work],
      });
    }
  }

  return [...bySession.values()]
    .map((session) => ({
      ...session,
      nominees: [
        ...session.nominees.filter((n) => n.won),
        ...session.nominees.filter((n) => !n.won),
      ],
    }))
    .sort((a, b) => b.session - a.session);
}

export { normalizeAuthorName };

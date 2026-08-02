import nomineeData from '../data/naoki-nominee.json';
import { normalizeAuthorName } from './naoki-prize';

export interface NaokiNomineeWork {
  author: string;
  title: string;
  won: boolean;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface NaokiNomineeEntry extends NaokiNomineeWork {
  session: number;
  period: string;
}

export interface NaokiNomineeSession {
  session: number;
  period: string;
  nominees: NaokiNomineeWork[];
}

export const NAOKI_NOMINEE_SOURCE = nomineeData.source;
export const NAOKI_NOMINEE_FETCHED_AT = nomineeData.fetchedAt;

export const naokiNomineeEntries: NaokiNomineeEntry[] = nomineeData.entries;

export function groupNaokiNomineeBySession(
  entries: NaokiNomineeEntry[] = naokiNomineeEntries
): NaokiNomineeSession[] {
  const bySession = new Map<number, NaokiNomineeSession>();

  for (const entry of entries) {
    const work: NaokiNomineeWork = {
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

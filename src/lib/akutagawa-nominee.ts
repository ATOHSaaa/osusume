import nomineeData from '../data/akutagawa-nominee.json';
import { normalizeAuthorName } from './akutagawa-prize';

export interface AkutagawaNomineeWork {
  author: string;
  title: string;
  won: boolean;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface AkutagawaNomineeEntry extends AkutagawaNomineeWork {
  session: number;
  period: string;
}

export interface AkutagawaNomineeSession {
  session: number;
  period: string;
  nominees: AkutagawaNomineeWork[];
}

export const AKUTAGAWA_NOMINEE_SOURCE = nomineeData.source;
export const AKUTAGAWA_NOMINEE_FETCHED_AT = nomineeData.fetchedAt;

export const akutagawaNomineeEntries: AkutagawaNomineeEntry[] = nomineeData.entries;

export function groupAkutagawaNomineeBySession(
  entries: AkutagawaNomineeEntry[] = akutagawaNomineeEntries
): AkutagawaNomineeSession[] {
  const bySession = new Map<number, AkutagawaNomineeSession>();

  for (const entry of entries) {
    const work: AkutagawaNomineeWork = {
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

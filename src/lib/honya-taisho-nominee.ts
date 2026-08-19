import nomineeData from '../data/honya-taisho-nominee.json';
import { normalizeAuthorName } from './honya-taisho-prize';

export interface HonyaTaishoNomineeWork {
  author: string;
  title: string;
  won: boolean;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface HonyaTaishoNomineeEntry extends HonyaTaishoNomineeWork {
  session: number;
  period: string;
}

export interface HonyaTaishoNomineeSession {
  session: number;
  period: string;
  nominees: HonyaTaishoNomineeWork[];
}

export const HONYA_TAISHO_NOMINEE_SOURCE = nomineeData.source;
export const HONYA_TAISHO_NOMINEE_FETCHED_AT = nomineeData.fetchedAt;

export const honyaTaishoNomineeEntries: HonyaTaishoNomineeEntry[] = nomineeData.entries;

export function groupHonyaTaishoNomineeBySession(
  entries: HonyaTaishoNomineeEntry[] = honyaTaishoNomineeEntries
): HonyaTaishoNomineeSession[] {
  const bySession = new Map<number, HonyaTaishoNomineeSession>();

  for (const entry of entries) {
    const work: HonyaTaishoNomineeWork = {
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

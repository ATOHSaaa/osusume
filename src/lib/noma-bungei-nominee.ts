import nomineeData from '../data/noma-bungei-nominee.json';
import { normalizeAuthorName } from './noma-bungei-prize';

export interface NomaBungeiNomineeWork {
  author: string;
  title: string;
  won: boolean;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface NomaBungeiNomineeEntry extends NomaBungeiNomineeWork {
  session: number;
  period: string;
}

export interface NomaBungeiNomineeSession {
  session: number;
  period: string;
  nominees: NomaBungeiNomineeWork[];
}

export const NOMA_BUNGEI_NOMINEE_SOURCE = nomineeData.source;
export const NOMA_BUNGEI_NOMINEE_FETCHED_AT = nomineeData.fetchedAt;

export const nomaBungeiNomineeEntries: NomaBungeiNomineeEntry[] = nomineeData.entries;

export function groupNomaBungeiNomineeBySession(
  entries: NomaBungeiNomineeEntry[] = nomaBungeiNomineeEntries
): NomaBungeiNomineeSession[] {
  const bySession = new Map<number, NomaBungeiNomineeSession>();

  for (const entry of entries) {
    const work: NomaBungeiNomineeWork = {
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

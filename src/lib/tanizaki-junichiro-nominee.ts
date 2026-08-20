import nomineeData from '../data/tanizaki-junichiro-nominee.json';
import { normalizeAuthorName } from './tanizaki-junichiro-prize';

export interface TanizakiJunichiroNomineeWork {
  author: string;
  title: string;
  won: boolean;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface TanizakiJunichiroNomineeEntry extends TanizakiJunichiroNomineeWork {
  session: number;
  period: string;
}

export interface TanizakiJunichiroNomineeSession {
  session: number;
  period: string;
  nominees: TanizakiJunichiroNomineeWork[];
}

export const TANIZAKI_JUNICHIRO_NOMINEE_SOURCE = nomineeData.source;
export const TANIZAKI_JUNICHIRO_NOMINEE_FETCHED_AT = nomineeData.fetchedAt;

export const tanizakiJunichiroNomineeEntries: TanizakiJunichiroNomineeEntry[] =
  nomineeData.entries;

export function groupTanizakiJunichiroNomineeBySession(
  entries: TanizakiJunichiroNomineeEntry[] = tanizakiJunichiroNomineeEntries
): TanizakiJunichiroNomineeSession[] {
  const bySession = new Map<number, TanizakiJunichiroNomineeSession>();

  for (const entry of entries) {
    const work: TanizakiJunichiroNomineeWork = {
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

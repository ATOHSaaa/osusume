import type { NomineeEntry, NomineeSession, PrizeEntry, PrizeSession, PrizeWork } from './types';

export function groupPrizeBySession(entries: PrizeEntry[]): PrizeSession[] {
  const bySession = new Map<number, PrizeSession>();

  for (const entry of entries) {
    const winner: PrizeWork = {
      author: entry.author,
      title: entry.title,
      asin: entry.asin,
      amazonUrl: entry.amazonUrl,
      price: entry.price,
    };
    const existing = bySession.get(entry.session);
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

export function groupNomineeBySession(entries: NomineeEntry[]): NomineeSession[] {
  const bySession = new Map<number, NomineeSession>();

  for (const entry of entries) {
    const nominee: NomineeEntry = {
      session: entry.session,
      period: entry.period,
      author: entry.author,
      title: entry.title,
      won: entry.won,
      asin: entry.asin,
      amazonUrl: entry.amazonUrl,
      price: entry.price,
    };
    const existing = bySession.get(entry.session);
    if (existing) {
      existing.nominees.push(nominee);
    } else {
      bySession.set(entry.session, {
        session: entry.session,
        period: entry.period,
        nominees: [nominee],
      });
    }
  }

  return [...bySession.values()].sort((a, b) => b.session - a.session);
}

export function getUniqueAuthors(entries: Array<{ author: string }>): string[] {
  const seen = new Set<string>();
  const authors: string[] = [];
  for (const entry of entries) {
    const key = entry.author.replace(/\s+/g, '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    authors.push(entry.author);
  }
  return authors.sort((a, b) => a.localeCompare(b, 'ja'));
}

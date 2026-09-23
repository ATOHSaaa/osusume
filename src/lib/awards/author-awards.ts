import { loadPrizeData, hasPrizeData } from './data';
import { normalizeAuthorName } from './normalize';
import {
  AWARDS,
  getAwardAuthorsPath,
  getAwardPath,
  getAwardSessionPath,
} from './registry';

export interface AuthorAwardWin {
  awardSlug: string;
  awardName: string;
  session: number;
  period: string;
  workTitle: string;
  awardPath: string;
  sessionPath: string;
  authorsPath: string;
}

export interface AuthorAwardLink {
  awardSlug: string;
  awardName: string;
  awardPath: string;
  authorsPath: string;
}

let indexCache: Map<string, AuthorAwardWin[]> | null = null;

function winKey(win: AuthorAwardWin): string {
  return `${win.awardSlug}:${win.session}:${win.workTitle}`;
}

export function buildAuthorAwardsIndex(): Map<string, AuthorAwardWin[]> {
  if (indexCache) return indexCache;

  const index = new Map<string, AuthorAwardWin[]>();

  for (const award of AWARDS) {
    if (!hasPrizeData(award.slug)) continue;
    const data = loadPrizeData(award.slug);

    for (const entry of data.entries) {
      const key = normalizeAuthorName(entry.author);
      if (!key) continue;

      const win: AuthorAwardWin = {
        awardSlug: award.slug,
        awardName: award.name,
        session: entry.session,
        period: entry.period,
        workTitle: entry.title,
        awardPath: getAwardPath(award.slug),
        sessionPath: getAwardSessionPath(award.slug, entry.session),
        authorsPath: getAwardAuthorsPath(award.slug),
      };

      const list = index.get(key) ?? [];
      if (!list.some((w) => winKey(w) === winKey(win))) {
        list.push(win);
      }
      index.set(key, list);
    }
  }

  for (const [key, list] of index) {
    list.sort((a, b) => b.session - a.session);
    index.set(key, list);
  }

  indexCache = index;
  return index;
}

export function getAuthorAwards(authorName: string): AuthorAwardWin[] {
  const key = normalizeAuthorName(authorName);
  if (!key) return [];
  return buildAuthorAwardsIndex().get(key) ?? [];
}

/** 受賞歴から、賞一覧・受賞作家一覧へのリンク（賞ごとに1件） */
export function getAuthorAwardLinks(wins: AuthorAwardWin[]): AuthorAwardLink[] {
  const seen = new Set<string>();
  const links: AuthorAwardLink[] = [];

  for (const win of wins) {
    if (seen.has(win.awardSlug)) continue;
    seen.add(win.awardSlug);
    links.push({
      awardSlug: win.awardSlug,
      awardName: win.awardName,
      awardPath: win.awardPath,
      authorsPath: win.authorsPath,
    });
  }

  return links;
}

/** テスト用: キャッシュをクリア */
export function clearAuthorAwardsIndexCache(): void {
  indexCache = null;
}

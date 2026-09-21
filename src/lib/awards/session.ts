import { groupNomineeBySession, groupPrizeBySession } from './group';
import { loadNomineeData, loadPrizeData } from './data';
import type { AwardDefinition, NomineeSession, PrizeSession } from './types';

export function getAwardSessionPath(slug: string, session: number): string {
  return `/awards/${slug}/${session}/`;
}

export function parseAwardSessionParam(value: string): number | null {
  const session = Number.parseInt(value, 10);
  if (!Number.isFinite(session) || session <= 0) return null;
  return session;
}

export function getPrizeSessions(award: AwardDefinition): PrizeSession[] {
  return groupPrizeBySession(loadPrizeData(award.slug).entries);
}

export function getNomineeSessions(award: AwardDefinition): NomineeSession[] {
  if (!award.hasNominees) return [];
  const data = loadNomineeData(award.slug);
  if (!data) return [];
  return groupNomineeBySession(data.entries);
}

export function getPrizeSession(award: AwardDefinition, session: number): PrizeSession | undefined {
  return getPrizeSessions(award).find((item) => item.session === session);
}

export function getNomineeSession(award: AwardDefinition, session: number): NomineeSession | undefined {
  return getNomineeSessions(award).find((item) => item.session === session);
}

export function getAdjacentPrizeSessions(
  award: AwardDefinition,
  session: number
): { previous?: PrizeSession; next?: PrizeSession } {
  const sessions = getPrizeSessions(award);
  const index = sessions.findIndex((item) => item.session === session);
  if (index === -1) return {};

  return {
    previous: sessions[index - 1],
    next: sessions[index + 1],
  };
}

export function buildAwardSessionPageTitle(awardName: string, session: number): string {
  return `第${session}回 ${awardName}`;
}

export function buildAwardSessionPageDescription(
  awardName: string,
  session: number,
  period: string,
  winnerCount: number,
  hasNominees: boolean
): string {
  const periodText = period ? `（${period}）` : '';
  const winnerText = winnerCount > 0 ? `受賞作${winnerCount}作品` : '受賞作なし';
  const nomineeText = hasNominees ? '・候補作' : '';
  return `${awardName}第${session}回${periodText}の${winnerText}${nomineeText}を紹介。受賞者・作品名と関連ページへのリンクを掲載しています。`;
}

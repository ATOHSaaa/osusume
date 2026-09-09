export type AwardCategory =
  | 'literary'
  | 'newcomer'
  | 'mystery'
  | 'sf'
  | 'bookstore'
  | 'popular'
  | 'nonfiction';

export type AwardHubSection =
  | 'literary'
  | 'mystery'
  | 'sf'
  | 'popular'
  | 'nonfiction'
  | 'newcomer-major'
  | 'newcomer-other';

export interface PrizeWork {
  author: string;
  title: string;
  asin?: string;
  amazonUrl?: string;
  price?: string;
}

export interface PrizeEntry extends PrizeWork {
  session: number;
  period: string;
}

export interface NomineeEntry extends PrizeEntry {
  won: boolean;
}

export interface PrizeSession {
  session: number;
  period: string;
  winners: PrizeWork[];
}

export interface NomineeSession {
  session: number;
  period: string;
  nominees: NomineeEntry[];
}

export interface PrizeDataFile {
  source: string;
  fetchedAt: string;
  amazonEnrichedAt?: string;
  entries: PrizeEntry[];
}

export interface NomineeDataFile {
  source: string;
  fetchedAt: string;
  amazonEnrichedAt?: string;
  entries: NomineeEntry[];
}

export interface AwardDefinition {
  slug: string;
  name: string;
  shortName: string;
  category: AwardCategory;
  hubSection: AwardHubSection;
  description: string;
  prizeLead: string;
  nomineeLead?: string;
  prizeDataFile: string;
  nomineeDataFile?: string;
  hasNominees: boolean;
  genreSearchQuery: string;
  genreSlug: string;
  hidePeriodColumn?: boolean;
}

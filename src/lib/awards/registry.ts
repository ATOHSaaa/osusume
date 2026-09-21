import type { AwardDefinition, AwardHubSection } from './types';

const literaryBase = (
  slug: string,
  name: string,
  shortName: string,
  description: string,
  prizeLead: string,
  nomineeLead: string,
  genreSlug?: string
): AwardDefinition => ({
  slug,
  name,
  shortName,
  category: 'literary',
  hubSection: 'literary',
  description,
  prizeLead,
  nomineeLead,
  prizeDataFile: `${slug}-prize.json`,
  nomineeDataFile: `${slug}-nominee.json`,
  hasNominees: true,
  genreSearchQuery: `${name} おすすめ`,
  genreSlug: genreSlug ?? slug,
});

const newcomerBase = (
  slug: string,
  name: string,
  shortName: string,
  description: string,
  prizeLead: string,
  hubSection: AwardHubSection = 'newcomer-major',
  genreSlug?: string
): AwardDefinition => ({
  slug,
  name,
  shortName,
  category: 'newcomer',
  hubSection,
  description,
  prizeLead,
  prizeDataFile: `${slug}-prize.json`,
  hasNominees: false,
  genreSearchQuery: `${name} おすすめ`,
  genreSlug: genreSlug ?? slug,
});

const prizeOnly = (
  slug: string,
  name: string,
  shortName: string,
  category: AwardDefinition['category'],
  hubSection: AwardHubSection,
  description: string,
  prizeLead: string,
  genreSlug?: string
): AwardDefinition => ({
  slug,
  name,
  shortName,
  category,
  hubSection,
  description,
  prizeLead,
  prizeDataFile: `${slug}-prize.json`,
  hasNominees: false,
  genreSearchQuery: `${name} おすすめ`,
  genreSlug: genreSlug ?? slug,
});

export const AWARDS: AwardDefinition[] = [
  literaryBase(
    'akutagawa',
    '芥川賞',
    '芥川賞',
    '純文学の新人・無名作家に贈られる芥川賞の歴代受賞作',
    '純文学の新人・無名作家に贈られる芥川賞（通称）の受賞作を、回別に一覧化しました。同一回に複数の受賞作がある場合も、そのまま掲載しています。',
    '芥川賞の最終候補作（受賞作を含む）を回別に一覧化しました。同一回に複数作品が候補となった場合や、受賞作が複数ある場合もそのまま掲載しています。'
  ),
  literaryBase(
    'naoki',
    '直木賞',
    '直木賞',
    '大衆文学の優れた作品に贈られる直木三十五賞の歴代受賞作',
    '大衆文学の優れた作品に贈られる直木賞（直木三十五賞）の受賞作を、回別に一覧化しました。',
    '直木賞の最終候補作（受賞作を含む）を回別に一覧化しました。'
  ),
  {
    slug: 'honya-taisho',
    name: '本屋大賞',
    shortName: '本屋大賞',
    category: 'bookstore',
    hubSection: 'literary',
    description: '書店員が選ぶ「いま読みたい本」本屋大賞の歴代受賞作',
    prizeLead:
      '全国の書店員が選ぶ本屋大賞の受賞作を、回別に一覧化しました。書店員の投票で「いまいちばん売れたい本」が選ばれます。',
    nomineeLead: '本屋大賞の最終候補作（受賞作を含む）を回別に一覧化しました。',
    prizeDataFile: 'honya-taisho-prize.json',
    nomineeDataFile: 'honya-taisho-nominee.json',
    hasNominees: true,
    genreSearchQuery: '本屋大賞 おすすめ',
    genreSlug: 'honya-taisho',
  },
  {
    ...literaryBase(
      'yoshikawa-eiji',
      '吉川英治文学賞',
      '吉川英治文学賞',
      '大衆文学の優れた作家に贈られる吉川英治文学賞の受賞作',
      '大衆文学の優れた作家に贈られる吉川英治文学賞の受賞作を、回別に一覧化しました。',
      '吉川英治文学賞の候補作（受賞作を含む）を回別に一覧化しました。',
      'yoshikawa-eiji-sho'
    ),
    category: 'popular',
    hubSection: 'popular',
  },
  literaryBase(
    'noma-bungei',
    '野間文芸賞',
    '野間文芸賞',
    '小説と評論に贈られる野間文芸賞の歴代受賞作',
    '小説と評論に贈られる野間文芸賞の受賞作を、回別に一覧化しました。',
    '野間文芸賞の候補作（受賞作を含む）を回別に一覧化しました。'
  ),
  literaryBase(
    'tanizaki-junichiro',
    '谷崎潤一郎賞',
    '谷崎潤一郎賞',
    '谷崎潤一郎の遺志を継ぐ文学賞の歴代受賞作',
    '谷崎潤一郎の遺志を継ぐ文学賞の受賞作を、回別に一覧化しました。',
    '谷崎潤一郎賞の候補作（受賞作を含む）を回別に一覧化しました。',
    'tanizaki-junichiro-sho'
  ),
  prizeOnly(
    'yomiuri',
    '読売文学賞',
    '読売文学賞',
    'literary',
    'literary',
    '読売新聞社が主催する読売文学賞（小説賞）の歴代受賞作',
    '読売新聞社が主催する読売文学賞の小説賞受賞作を、回別に一覧化しました。芥川賞・直木賞と並ぶ歴史ある文学賞です。'
  ),
  prizeOnly(
    'joryu-bungei',
    '女流文学賞',
    '女流文学賞',
    'literary',
    'literary',
    '女性作家の優れた作品に贈られる女流文学賞の歴代受賞作',
    '女性作家の優れた作品に贈られる女流文学賞の受賞作を、回別に一覧化しました。'
  ),
  {
    slug: 'kawabata',
    name: '川端康成文学賞',
    shortName: '川端康成文学賞',
    category: 'literary',
    hubSection: 'literary',
    description: '川端康成の遺志を継ぐ川端康成文学賞の歴代受賞作',
    prizeLead:
      '川端康成の遺志を継ぐ川端康成文学賞の受賞作を、回別に一覧化しました。新人作家の登竜門として知られる賞です。',
    nomineeLead: '川端康成文学賞の最終候補作（受賞作を含む）を回別に一覧化しました。',
    prizeDataFile: 'kawabata-prize.json',
    nomineeDataFile: 'kawabata-nominee.json',
    hasNominees: true,
    genreSearchQuery: '川端康成文学賞 おすすめ',
    genreSlug: 'kawabata',
  },
  {
    slug: 'edogawa-ranpo',
    name: '江戸川乱歩賞',
    shortName: '江戸川乱歩賞',
    category: 'mystery',
    hubSection: 'mystery',
    description: '日本推理作家協会が主催する江戸川乱歩賞の歴代受賞作',
    prizeLead:
      '日本推理作家協会が主催する江戸川乱歩賞の受賞作を、回別に一覧化しました。ミステリー・推理小説の最高峰の賞のひとつです。',
    nomineeLead: '江戸川乱歩賞の候補作（受賞作を含む）を回別に一覧化しました。',
    prizeDataFile: 'edogawa-ranpo-prize.json',
    nomineeDataFile: 'edogawa-ranpo-nominee.json',
    hasNominees: true,
    genreSearchQuery: '江戸川乱歩賞 おすすめ',
    genreSlug: 'edogawa-ranpo-sho',
    hidePeriodColumn: true,
  },
  prizeOnly(
    'honkaku-mystery',
    '日本推理作家協会賞',
    '日本推理作家協会賞',
    'mystery',
    'mystery',
    '日本推理作家協会が主催する日本推理作家協会賞（長編部門）の歴代受賞作',
    '日本推理作家協会賞の長編および連作短編集部門の受賞作を、回別に一覧化しました。'
  ),
  prizeOnly(
    'mephisto',
    'メフィスト賞',
    'メフィスト賞',
    'mystery',
    'mystery',
    '講談社『メフィスト』が主催するメフィスト賞の歴代受賞作',
    '講談社の文芸雑誌『メフィスト』が主催するメフィスト賞の受賞作を、回別に一覧化しました。ミステリー新人賞の代表格です。'
  ),
  prizeOnly(
    'japan-sf',
    '日本SF大賞',
    '日本SF大賞',
    'sf',
    'sf',
    '日本SF作家クラブが主催する日本SF大賞の歴代受賞作',
    '日本SF作家クラブが主催する日本SF大賞の受賞作を、回別に一覧化しました。SF小説・評論の優れた作品に贈られる賞です。'
  ),
  prizeOnly(
    'yamamoto-shugoro',
    '山本周五郎賞',
    '山本周五郎賞',
    'popular',
    'popular',
    '山本周五郎の遺志を継ぐ歴史・時代小説の山本周五郎賞',
    '山本周五郎の遺志を継ぐ山本周五郎賞の受賞作を、回別に一覧化しました。歴史・時代小説の優れた作品に贈られる賞です。',
    'yamamoto-shugoro-sho'
  ),
  prizeOnly(
    'shibata-rentaro',
    '柴田錬三郎賞',
    '柴田錬三郎賞',
    'nonfiction',
    'nonfiction',
    'ノンフィクションの優れた作品に贈られる柴田錬三郎賞',
    'ノンフィクションの優れた作品に贈られる柴田錬三郎賞の受賞作を、回別に一覧化しました。'
  ),
  newcomerBase(
    'bungaku-kai',
    '文學界新人賞',
    '文學界新人賞',
    '文藝春秋『文學界』が主催する五大文芸誌の新人賞',
    '文藝春秋が発行する文芸雑誌『文學界』の新人賞受賞作を、回別に一覧化しました。五大文芸誌の新人賞のひとつです。'
  ),
  newcomerBase(
    'shincho',
    '新潮新人賞',
    '新潮新人賞',
    '新潮社『新潮』が主催する五大文芸誌の新人賞',
    '新潮社が発行する文芸雑誌『新潮』の新人賞受賞作を、回別に一覧化しました。五大文芸誌の新人賞のひとつです。'
  ),
  newcomerBase(
    'bungei',
    '文藝賞',
    '文藝賞',
    '河出書房新社『文藝』が主催する五大文芸誌の新人賞',
    '河出書房新社が発行する文芸雑誌『文藝』の新人賞（文藝賞）受賞作を、回別に一覧化しました。五大文芸誌の新人賞のひとつです。'
  ),
  newcomerBase(
    'gunzo',
    '群像新人文学賞',
    '群像新人文学賞',
    '講談社『群像』が主催する五大文芸誌の新人賞',
    '講談社が発行する文芸雑誌『群像』の群像新人文学賞受賞作を、回別に一覧化しました。五大文芸誌の新人賞のひとつです。'
  ),
  newcomerBase(
    'subaru',
    'すばる文学賞',
    'すばる文学賞',
    '集英社『すばる』が主催する五大文芸誌の新人賞',
    '集英社が発行する文芸雑誌『すばる』のすばる文学賞（すばる新人賞）受賞作を、回別に一覧化しました。五大文芸誌の新人賞のひとつです。'
  ),
  newcomerBase(
    'all-yomimono',
    'オール讀物新人賞',
    'オール讀物新人賞',
    '講談社が主催するオール讀物新人賞',
    '講談社が主催するオール讀物新人賞の受賞作を、回別に一覧化しました。',
    'newcomer-other'
  ),
  newcomerBase(
    'dazai-osamu',
    '太宰治賞',
    '太宰治賞',
    '太宰治の作品に親しむ新人作家に贈られる太宰治賞',
    '太宰治に親しむ新人作家に贈られる太宰治賞の受賞作を、回別に一覧化しました。第1回・第8回は受賞作なし、1979年〜1998年は休止期間です。',
    'newcomer-other',
    'dazai-osamu-sho'
  ),
  {
    ...newcomerBase(
      'kaiko-ken',
      '開高健ノンフィクション賞',
      '開高健ノンフィクション賞',
      '開高健に親しむ新人ノンフィクション作家に贈られる開高健ノンフィクション賞',
      '開高健に親しむ新人ノンフィクション作家に贈られる開高健ノンフィクション賞の受賞作を、回別に一覧化しました。',
      'newcomer-other'
    ),
    category: 'nonfiction',
    hubSection: 'nonfiction',
  },
];

export const AWARD_BY_SLUG = new Map(AWARDS.map((award) => [award.slug, award]));

export const HUB_SECTIONS: Array<{ id: AwardHubSection; title: string }> = [
  { id: 'literary', title: '文学賞' },
  { id: 'mystery', title: 'ミステリー・推理文学賞' },
  { id: 'sf', title: 'SF賞' },
  { id: 'popular', title: '歴史・大衆文学賞' },
  { id: 'nonfiction', title: 'ノンフィクション賞' },
  { id: 'newcomer-major', title: '五大文芸誌の新人賞' },
  { id: 'newcomer-other', title: 'その他の新人賞' },
];

export const LITERARY_AWARDS = AWARDS.filter((a) => a.hubSection === 'literary');
export const NEWCOMER_AWARDS = AWARDS.filter((a) => a.category === 'newcomer');

export function getAwardsByHubSection(section: AwardHubSection): AwardDefinition[] {
  return AWARDS.filter((a) => a.hubSection === section);
}

export function getAwardPath(slug: string): string {
  return `/awards/${slug}/`;
}

export function getAwardNomineePath(slug: string): string {
  return `/awards/${slug}/nominees/`;
}

export function getAwardAuthorsPath(slug: string): string {
  return `/awards/${slug}/authors/`;
}

export { getAwardSessionPath } from './session';

export const AWARDS_HUB_PATH = '/awards/';

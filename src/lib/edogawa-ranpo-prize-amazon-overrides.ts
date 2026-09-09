/**
 * 江戸川乱歩賞受賞作の Amazon 照合が難しい作品向けの手動補助。
 */
export interface PrizeAmazonOverride {
  session: number;
  author: string;
  title: string;
  asin?: string;
  searchTitles?: string[];
}

export const EDOGAWA_RANPO_PRIZE_OVERRIDES: PrizeAmazonOverride[] = [
  {
    session: 13,
    author: '海渡英祐',
    title: '伯林－一八八八年',
    searchTitles: ['伯林1888', 'ベルリン1888', '伯林―一八八八年'],
  },
  {
    session: 64,
    author: '斉藤詠一',
    title: '到達不能極',
    searchTitles: ['到達不能極 斉藤詠一'],
  },
  {
    session: 70,
    author: '霜月流',
    title: '遊廓島心中譚',
    searchTitles: ['遊廓島心中譚 霜月流'],
  },
  {
    session: 72,
    author: '箕輪尊文',
    title: '天使の負託 ――エンジェル・バレット――',
    searchTitles: ['天使の負託', 'エンジェル・バレット'],
  },
];

export function findEdogawaRanpoPrizeOverride(
  session: number,
  author: string,
  title: string
): PrizeAmazonOverride | undefined {
  return EDOGAWA_RANPO_PRIZE_OVERRIDES.find(
    (o) => o.session === session && o.author === author && o.title === title
  );
}

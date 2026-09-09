/**
 * 川端康成文学賞受賞作の Amazon 照合が難しい作品向けの手動補助。
 * 表題のみ・収録版・表記ゆれがある作品の ASIN / 検索語を定義する。
 */
export interface PrizeAmazonOverride {
  session: number;
  author: string;
  title: string;
  asin?: string;
  searchTitles?: string[];
}

export const KAWABATA_PRIZE_OVERRIDES: PrizeAmazonOverride[] = [
  {
    session: 1,
    author: '上林暁',
    title: 'ブロンズの首',
    asin: 'B00J03NYJM',
    searchTitles: ['白い屋形船・ブロンズの首'],
  },
  {
    session: 5,
    author: '和田芳恵',
    title: '雪女',
    asin: '4163048707',
  },
  {
    session: 6,
    author: '開高健',
    title: '玉、砕ける',
    asin: 'B009DECMIM',
    searchTitles: ['ロマネ・コンティ・一九三五年', '玉砕ける'],
  },
  {
    session: 11,
    author: '大江健三郎',
    title: '河馬に嚙まれる',
    asin: '4062753928',
    searchTitles: ['河馬に噛まれる', '河馬に嚙まれる'],
  },
  {
    session: 14,
    author: '古井由吉',
    title: '中山坂',
    asin: '482883110X',
    searchTitles: ['眉雨'],
  },
  {
    session: 36,
    author: '髙樹のぶ子',
    title: 'トモスイ',
    asin: '4101024235',
    searchTitles: ['トモスイ'],
  },
  {
    session: 39,
    author: '津村記久子',
    title: '給水塔と亀',
    asin: '4163905426',
    searchTitles: ['浮遊霊ブラジル'],
  },
  {
    session: 42,
    author: '山田詠美',
    title: '生鮮てるてる坊主',
    asin: '4062201247',
    searchTitles: ['珠玉の短編'],
  },
  {
    session: 44,
    author: '保坂和志',
    title: 'こことよそ',
    asin: '4101019206',
    searchTitles: ['ハレルヤ'],
  },
  {
    session: 45,
    author: '千葉雅也',
    title: 'マジックミラー',
    asin: '4103529725',
    searchTitles: ['オーバーヒート', 'マジックミラー'],
  },
  {
    session: 47,
    author: '滝口悠生',
    title: '反対方向行き',
    asin: '4330064227',
    searchTitles: ['鉄道小説'],
  },
  {
    session: 48,
    author: '町屋良平',
    title: '私の批評',
    asin: 'B0D9LK71B6',
    searchTitles: ['私の小説'],
  },
  {
    session: 49,
    author: '奥泉光',
    title: '清心館小伝',
    asin: '4065381427',
    searchTitles: ['虚傳集'],
  },
];

export function findKawabataPrizeOverride(
  session: number,
  author: string,
  title: string
): PrizeAmazonOverride | undefined {
  return KAWABATA_PRIZE_OVERRIDES.find(
    (o) => o.session === session && o.author === author && o.title === title
  );
}

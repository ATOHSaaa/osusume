/**
 * 吉川英治文学賞受賞作の Amazon 照合が難しい作品向けの手動補助。
 * ASIN は Amazon で目視確認した紙版・文庫版を優先する。
 */
export interface PrizeAmazonOverride {
  session: number;
  author: string;
  title: string;
  /** 照合済み ASIN（あれば API 検索をスキップ） */
  asin?: string;
  /** buildPrizeSearchTitles に追加する検索語 */
  searchTitles?: string[];
}

export const YOSHIKAWA_EIJI_PRIZE_OVERRIDES: PrizeAmazonOverride[] = [
  {
    session: 1,
    author: '松本清張',
    title: '昭和史発掘',
    asin: '4167106997',
    searchTitles: ['昭和史発掘 1', '昭和史発掘 文春文庫'],
  },
  {
    session: 1,
    author: '松本清張',
    title: '逃亡',
    searchTitles: ['逃亡 短編', '逃亡 文春文庫'],
  },
  {
    session: 2,
    author: '山岡荘八',
    title: '徳川家康',
    asin: '4061950231',
    searchTitles: ['徳川家康 出生乱離', '徳川家康 1', '徳川家康 風の巻'],
  },
  {
    session: 5,
    author: '源氏鶏太',
    title: '幽霊になった男',
    searchTitles: ['幽霊になった男 講談社', '幽霊になった男 文庫'],
  },
  {
    session: 7,
    author: '水上勉',
    title: '兵卒の鬣',
    searchTitles: ['兵卒の鬣 新潮', '兵卒の鬣 文庫'],
  },
  {
    session: 8,
    author: '新田次郎',
    title: '武田信玄',
    asin: '4167112301',
    searchTitles: ['武田信玄 風の巻', '武田信玄 文春文庫'],
  },
  {
    session: 10,
    author: '五木寛之',
    title: '青春の門',
    asin: '4061845950',
    searchTitles: ['青春の門 筑豊', '青春の門 第一部'],
  },
  {
    session: 11,
    author: '池波正太郎',
    title: '剣客商売',
    asin: 'B0096PE57E',
    searchTitles: ['剣客商売 一', '剣客商売 第一巻'],
  },
  {
    session: 11,
    author: '池波正太郎',
    title: '仕掛人・藤枝梅安',
    asin: 'B00AJCLS00',
    searchTitles: ['殺しの四人 仕掛人', '仕掛人 藤枝梅安 一'],
  },
  {
    session: 34,
    author: '高橋克彦',
    title: '火怨',
    asin: '4062735288',
    searchTitles: ['火怨 北の燿星アテルイ', '火怨 上', '火怨 文春文庫'],
  },
  {
    session: 42,
    author: '浅田次郎',
    title: '中原の虹',
    asin: 'B00RGM0BYK',
    searchTitles: ['中原の虹 全', '中原の虹 上'],
  },
];

export function findYoshikawaEijiPrizeOverride(
  session: number,
  author: string,
  title: string
): PrizeAmazonOverride | undefined {
  return YOSHIKAWA_EIJI_PRIZE_OVERRIDES.find(
    (o) => o.session === session && o.author === author && o.title === title
  );
}

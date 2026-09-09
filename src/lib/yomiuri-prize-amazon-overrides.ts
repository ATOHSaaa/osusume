/**
 * 読売文学賞受賞作の Amazon 照合が難しい作品向けの手動補助。
 * 表題のみでは検索できない作品（収録版・別表記）の ASIN / 検索語を定義する。
 */
export interface PrizeAmazonOverride {
  session: number;
  author: string;
  title: string;
  asin?: string;
  searchTitles?: string[];
}

export const YOMIURI_PRIZE_OVERRIDES: PrizeAmazonOverride[] = [
  {
    session: 1,
    author: '井伏鱒二',
    title: '本日休診',
    asin: 'B00KL4ZJA6',
    searchTitles: ['遙拝隊長・本日休診', '遥拝隊長・本日休診'],
  },
  {
    session: 7,
    author: '里見弴',
    title: '恋ごころ',
    asin: 'B0DH7W7TM9',
    searchTitles: ['恋ごころ 里見弴短篇集', '恋ごころ 里見トン短篇集'],
  },
  {
    session: 30,
    author: '野口冨士男',
    title: 'かくてありけり',
    asin: 'B00JIMN1KW',
    searchTitles: ['しあわせ かくてありけり', 'しあわせ／かくてありけり'],
  },
  {
    session: 34,
    author: '大江健三郎',
    title: '雨の木',
    asin: '4101126159',
    searchTitles: ['「雨の木」を聴く女たち', '雨の木を聴く女たち'],
  },
  {
    session: 47,
    author: '日野啓三',
    title: '光',
    asin: '4163159703',
    searchTitles: ['光 日野啓三 文藝春秋'],
  },
  {
    session: 49,
    author: '村上龍',
    title: 'イン ザ・ミソスープ',
    asin: '4877286330',
    searchTitles: ['イン・ザ・ミソスープ', 'イン ザ・ミソスープ'],
  },
];

export function findYomiuriPrizeOverride(
  session: number,
  author: string,
  title: string
): PrizeAmazonOverride | undefined {
  return YOMIURI_PRIZE_OVERRIDES.find(
    (o) => o.session === session && o.author === author && o.title === title
  );
}

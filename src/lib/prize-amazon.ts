/**
 * 賞受賞作タイトルから Amazon 検索用の候補を作る。
 * 複合タイトル（「」区切り・「他」付き）や括弧表記・旧字体のゆれに対応する。
 */
const KYUJITAI_TO_SHINJITAI: Array<[RegExp, string]> = [
  [/獵/g, '猟'],
  [/萬/g, '万'],
  [/櫻/g, '桜'],
  [/邊/g, '辺'],
  [/廣/g, '広'],
  [/傳/g, '伝'],
  [/澤/g, '沢'],
  [/嶋/g, '島'],
  [/國/g, '国'],
  [/學/g, '学'],
  [/會/g, '会'],
  [/氣/g, '気'],
  [/殘/g, '残'],
  [/將/g, '将'],
  [/臺/g, '台'],
  [/龍/g, '竜'],
  [/螢/g, '蛍'],
];

function toShinjitai(text: string): string {
  let result = text;
  for (const [from, to] of KYUJITAI_TO_SHINJITAI) {
    result = result.replace(from, to);
  }
  return result;
}

export function buildPrizeSearchTitles(title: string): string[] {
  const cleaned = title
    .replace(/^[\s「『]+/, '')
    .replace(/[\s」』]+$/, '')
    .trim();

  // 複合受賞作: 悪い仲間」「陰気な愉しみ
  const parts = cleaned
    .split(/[」』]\s*[「『]/)
    .map((p) =>
      p
        .replace(/^[\s「『]+/, '')
        .replace(/[\s」』]+$/, '')
        .replace(/\s+他$/, '')
        .trim()
    )
    .filter(Boolean);

  const candidates: string[] = [];
  const push = (value: string | undefined) => {
    const v = value?.trim();
    if (!v) return;
    if (!candidates.includes(v)) candidates.push(v);
    const modern = toShinjitai(v);
    if (modern !== v && !candidates.includes(modern)) candidates.push(modern);
  };

  for (const part of parts) {
    push(part);

    // 「壁 S・カルマ氏の犯罪」→ 本体と副題
    const spaced = part.split(/\s+/).filter(Boolean);
    if (spaced.length >= 2) {
      push(spaced[0]);
      push(spaced.slice(1).join(' '));
    }

    // 「或る『小倉日記』伝」→ 内側の書名と外側全体
    const innerMatches = [...part.matchAll(/[『「]([^』」]+)[』」]/g)];
    for (const m of innerMatches) {
      push(m[1]);
    }
    // ネストをほどいた形
    push(part.replace(/[『「]|[』」]/g, ''));
  }

  push(cleaned.replace(/\s+他$/, '').trim());
  push(cleaned.replace(/[『「]|[』」]/g, '').replace(/\s+他$/, '').trim());

  return candidates;
}

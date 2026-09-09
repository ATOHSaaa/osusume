/** 作家名の表記ゆれを吸収して記事 slug を引く */
export function normalizeAuthorName(name: string): string {
  return name
    .replace(/\[注\s*\d+\]/g, '')
    .replace(/\s+/g, '')
    .replace(/Ｋ/g, 'K');
}

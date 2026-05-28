/** タイトル・Amazon 商品情報から成人向けコンテンツを判定する */

export interface AdultContentSource {
  title?: string;
  binding?: string;
  productGroup?: string;
}

/** タイトル・レーベル等に含まれる場合は除外 */
const ADULT_CONTENT_PATTERNS: RegExp[] = [
  /八尺様|八尺さま/,
  /種付け|種付|孕ませ|妊娠させ/,
  /カントボーイ/,
  /GirlsCREATIVE/i,
  /メロンブックス/i,
  /強[○◯〇]|強姦|レイプ|輪姦|陵辱|凌辱/,
  /淫乱|淫妻|淫行|猥褻|官能小説|官能/,
  /成人向け|18禁|R-?18\b|アダルト/,
  /調教|寝取ら|寝取り|寝取られ/,
  /性処理|えっち|エロ本|H本/,
  /ぱらダイス|paradise novels/i,
  /オメガバース|Ωバース/,
  /BL\s*成人|TL\s*成人|ボーイズラブ.*成人/i,
  /電子書籍\s*成人|Kindle\s*成人/i,
];

function buildAdultCheckText(source: string | AdultContentSource): string {
  if (typeof source === 'string') return source;
  return [source.title, source.binding, source.productGroup]
    .filter(Boolean)
    .join(' ');
}

export function isAdultContent(source: string | AdultContentSource): boolean {
  const text = buildAdultCheckText(source);
  if (!text.trim()) return false;

  return ADULT_CONTENT_PATTERNS.some((pattern) => pattern.test(text));
}

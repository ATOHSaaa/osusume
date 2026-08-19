import { isAdultContent } from './adult-content';
import { isLaterSeriesVolume } from './book-format';

/** 単独では書籍タイトルにならないシリーズ愛称・略称・UI文言 */
const EXCLUDED_EXACT_TITLES = [
  'ガリレオ',
  'トップ',
  'カート',
  'イメージ',
  '簡易表示',
  '詳細表示',
  'スタートレック',
  'スペースオペラ',
  'ほぼ日',
  'note',
];

const EXCLUDED_TITLE_PATTERNS = [
  /ユリイカ/i,
  /\d{4}年\d{1,2}月号/,
  /文[藝艺]春秋/i,
  /キネマ旬報/i,
  /小説すばる/i,
  /パンフレット/i,
  /韓国・フェミニズム・日本/i,
  /コミックス|漫画版|マンガ版/i,
  /モーニングコミックス|ジャンプコミックス|少年マガジンコミックス/i,
];

const NOISE_PATTERNS = [
  /^(おすすめ|ランキング|ベスト|人気|初心者|入門|まとめ|一覧|選)$/,
  /^(著者|作者|作家|出版社|発売|読了|感想|レビュー)$/,
  /^(Amazon|Kindle|楽天|書店|無料|試し読み|ライトノベル|ラノベ)$/i,
  /^Amazonで見る$/i,
  /^検証時価格/,
  /^小説家になろう/,
  /^なろう$/,
  /異世界[（(]総合[）)]/,
  /異世界転生[（(]/,
  /^\d+$/,
  /^.{1,2}$/,
  /https?:\/\//,
  /[｜|]/,
  /¥|￥/,
  /^#/,
  /発売日/,
  /カートを見る/,
  /最新刊/,
  /小説を探す/,
  /ヘルプ/,
  /運営会社/,
  /ガイドライン/,
  /docomo/,
  /エブリスタ/,
  /アマゾンプライム/,
  /無料で読む/,
  /リーダーシップ/,
  /心理的柔軟性/,
  /伝える力/,
  /コミュニティ・オブ・プラクティス/,
  /この商品を含むブログ/,
  /マネタイズ/,
  /URLをコピー/,
  /少年・青年マンガ|少女・女性マンガ/,
  /レンタル落ち/,
  /第\d+回.*映画/,
  /映画祭.*賞/,
  /私小説論/,
  /^私小説$/,
  /私小説言説/,
  /私小説は死んだ/,
  /私小説は日本独自/,
  /^本・小説/,
  /^小説・文庫$/,
  /^心境小説$/,
  /^自伝的小説$/,
  /^書簡体小説$/,
  /^書簡文学$/,
  /^学園もの$/,
  /^ライト文芸$/,
  /^純文学$/,
  /^shopping_cart/,
  /^発売元$/,
  /^ページ数$/,
  /^制作会社$/,
  // 設問・解説見出し・メタ文
  /[？?]$/,
  /とは$/,
  /って何/,
  /について$/,
  /が書いた本$/,
  /のおすすめ/,
  /^タレント/,
  /^[^…]{0,4}[…．.]{2,}$/,
  /^[「『].+[」』].{2,}/,
  /^ほぼ日$/i,
  /^note$/i,
  /^bookmeter/i,
  /^読書メーター/,
  /夢を見た/,
  /自己表現/,
  /セグウェイはかわいい男/,
];

const STRICT_NOISE_PATTERNS = [
  /^.{1,3}$/,
  /^(本|小説|漫画|文庫|新書|単行本)$/,
  /^(第\d+巻|上巻|下巻|完結)$/,
];

export function normalizeTitle(title: string): string {
  return title
    .replace(/\s+/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[：:].*$/, '')
    .trim();
}

export function isExcludedBook(title: string): boolean {
  if (isAdultContent(title)) return true;
  if (isLaterSeriesVolume(title)) return true;

  const normalized = normalizeTitle(title);
  if (EXCLUDED_EXACT_TITLES.includes(normalized)) return true;

  const candidates = [title, normalized];
  for (const candidate of candidates) {
    for (const pattern of EXCLUDED_TITLE_PATTERNS) {
      if (pattern.test(candidate)) return true;
    }
  }
  return false;
}

export interface PlausibleBookTitleOptions {
  /** 言及1回など信頼度が低い候補向けの追加フィルタ */
  strict?: boolean;
}

/** 抽出・Amazon 照合の共通ゲート: 作品名らしい文字列だけ通す */
export function isPlausibleBookTitle(
  title: string,
  options?: PlausibleBookTitleOptions
): boolean {
  if (isExcludedBook(title)) return false;

  const normalized = normalizeTitle(title);
  if (normalized.length < 2 || normalized.length > 50) return false;

  const patterns = options?.strict
    ? [...NOISE_PATTERNS, ...STRICT_NOISE_PATTERNS]
    : NOISE_PATTERNS;

  for (const pattern of patterns) {
    if (pattern.test(normalized) || pattern.test(title)) return false;
  }

  if (options?.strict && normalized.length < 4) return false;

  const withoutEllipsis = normalized.replace(/[…・。、．.]+/g, '');
  if (withoutEllipsis.length < 2) return false;

  const hasJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(normalized);
  if (!hasJapanese) return false;
  if (/[\uFFFD]/.test(title)) return false;
  return true;
}

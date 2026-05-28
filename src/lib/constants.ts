/** サイト名（ヘッダー・タイトル・フッター） */
export const SITE_NAME = 'First Books';

/** 本番サイト URL（末尾スラッシュなし） */
export const SITE_URL = 'https://first-books.tadeku.net';

/** サイト説明（meta・構造化データ・RSS） */
export const SITE_DESCRIPTION =
  'Web上のおすすめ記事を分析し、言及頻度の高い本をランキング形式で紹介するサイト';

/** RSS フィードのパス */
export const RSS_PATH = '/rss.xml';

/** サイトマップのパス */
export const SITEMAP_PATH = '/sitemap.xml';

/** トップページ検索のクエリパラメータ名 */
export const HOME_SEARCH_QUERY_PARAM = 'q';

/** Google Fonts（Noto Sans JP） */
export const NOTO_SANS_JP_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700;800&display=swap';

/** 記事ランキングの最大件数（1位〜10位） */
export const MAX_BOOKS = 10;

/** 一覧セクションの初期表示件数（超過分は「すべて見る」） */
export const ARTICLE_LIST_LIMIT = 12;

/** 作家別・ジャンル別の記事一覧ページ */
export const AUTHOR_LIST_PATH = '/authors/';
export const GENRE_LIST_PATH = '/genres/';

/** サイト情報ページ */
export const ABOUT_PATH = '/about/';
export const PRIVACY_PATH = '/privacy/';
export const CONTACT_PATH = '/contact/';

/** お問い合わせ先メールアドレス */
export const CONTACT_EMAIL = 'contact@tadeku.net';

/** 作家記事で分析する検索結果の件数 */
export const AUTHOR_SEARCH_LIMIT = 10;

/** ジャンル記事で分析する検索結果の件数 */
export const GENRE_SEARCH_LIMIT = 30;

/** Amazon 照合で試す候補の上限（言及順） */
export const AMAZON_ENRICH_CANDIDATE_LIMIT = 80;

/** 記事 URL の末尾サフィックス（例: isaka-kotaro-recommended-books） */
export const ARTICLE_SLUG_SUFFIX = 'recommended-books';

/**
 * おすすめ記事で別名で言及される作品 → 第1作・原作タイトルへ統合
 * キーは normalizeTitle 後の文字列
 */
export const BOOK_TITLE_CANONICAL_ALIASES: Record<string, string> = {
  ブレードランナー: 'アンドロイドは電気羊の夢を見るか？',
  指輪物語: '旅の仲間 上',
  ロードオブザリング: '旅の仲間 上',
  歩行祭: '夜のピクニック',
};

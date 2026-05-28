export type ArticleKind = 'author' | 'genre';

export interface ArticleSubject {
  kind: ArticleKind;
  /** 表示名（作家名またはジャンル名） */
  label: string;
  /** DuckDuckGo 検索クエリ */
  searchQuery: string;
}

export function buildAuthorSubject(authorName: string): ArticleSubject {
  return {
    kind: 'author',
    label: authorName,
    searchQuery: `${authorName} おすすめ`,
  };
}

/** 例: 「百合」→「百合 小説 おすすめ」 / 「百合 小説 おすすめ」はそのまま */
export function buildGenreSubject(genreInput: string): ArticleSubject {
  const label = normalizeGenreLabel(genreInput);
  const searchQuery = buildGenreSearchQuery(genreInput);

  return {
    kind: 'genre',
    label,
    searchQuery,
  };
}

function normalizeGenreLabel(genreInput: string): string {
  let label = genreInput.replace(/\s*おすすめ\s*/g, '').trim();
  // 「百合 小説」→「百合」だが「歴史小説」「恋愛小説」はそのまま
  if (/\s小説/.test(label)) {
    label = label.replace(/\s*小説\s*/g, '').trim();
  }
  return label;
}

/** 説明文用（末尾に「小説」がなければ付ける） */
function genreProseLabel(label: string): string {
  if (label.endsWith('小説') || label.endsWith('書') || label.endsWith('ミステリ') || label.endsWith('オペラ')) {
    return label;
  }
  return `${label}小説`;
}

function buildGenreSearchQuery(genreInput: string): string {
  const trimmed = genreInput.trim();
  if (/おすすめ/.test(trimmed)) return trimmed;
  if (/小説|漫画|ライトノベル|ノベル|作品/.test(trimmed)) {
    return `${trimmed} おすすめ`;
  }
  return `${trimmed} 小説 おすすめ`;
}

export function getArticleTitle(subject: ArticleSubject): string {
  if (subject.kind === 'genre') {
    return `${subject.label}のおすすめ作品ランキング`;
  }
  return `${subject.label}のおすすめ作品ランキング`;
}

export function getArticleDescription(subject: ArticleSubject): string {
  if (subject.kind === 'genre') {
    return `${genreProseLabel(subject.label)}の人気作品をWeb記事から集計。言及頻度の高いおすすめをランキング形式で紹介します。`;
  }
  return `${subject.label}の人気作品をWeb記事から集計。言及頻度の高いおすすめ本をランキング形式で紹介します。`;
}

export function getArticleBody(subject: ArticleSubject, sourceCount: number): string {
  if (subject.kind === 'genre') {
    return `${genreProseLabel(subject.label)}で、複数のおすすめ記事で紹介されている人気作品を集計しました。Web上の記事${sourceCount}件を分析し、言及頻度の高い順にランキング形式でまとめています。`;
  }
  return `${subject.label}の作品で、複数のおすすめ記事で紹介されている人気作品を集計しました。Web上の記事${sourceCount}件を分析し、言及頻度の高い順にランキング形式でまとめています。`;
}

export function getArticleTags(subject: ArticleSubject): string[] {
  if (subject.kind === 'genre') {
    return ['おすすめ', subject.label, 'ジャンル'];
  }
  return ['おすすめ', subject.label];
}

/** Amazon 著者照合に使う名前（ジャンル記事では undefined） */
export function getAmazonAuthorFilter(
  subject: ArticleSubject
): string | undefined {
  return subject.kind === 'author' ? subject.label : undefined;
}

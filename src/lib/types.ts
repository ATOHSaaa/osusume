export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  siteName?: string;
}

export interface BookMention {
  title: string;
  count: number;
  sources: string[];
}

export interface AmazonProduct {
  asin: string;
  title: string;
  author?: string;
  imageUrl?: string;
  price?: string;
  amazonUrl: string;
}

export type ArticleKind = 'author' | 'genre';

export interface GeneratedArticle {
  kind: ArticleKind;
  /** 作家名またはジャンル名（表示・タグ用） */
  author: string;
  title: string;
  description: string;
  tags: string[];
  sources: SearchResult[];
  books: Array<BookMention & Partial<AmazonProduct>>;
}

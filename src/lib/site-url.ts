import { SITE_URL } from './constants';

/** astro.config の site から origin を取得（未設定時は SITE_URL） */
export function getSiteOrigin(site: URL | string | undefined): string {
  if (site instanceof URL) return site.origin;
  if (typeof site === 'string') return new URL(site).origin;
  return SITE_URL;
}

/** 拡張子付きファイルパスかどうか（OG画像・RSS 等） */
function isFilePath(pathname: string): boolean {
  return /\.[a-z0-9]+$/i.test(pathname);
}

/**
 * HTML ページは末尾スラッシュ付き、ファイルはなし、に正規化する。
 * クエリ・ハッシュは捨てる（canonical 用）。
 */
export function toCanonicalPath(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/)[0] || '/';
  const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;

  if (withLeadingSlash === '/') return '/';
  if (isFilePath(withLeadingSlash)) {
    return withLeadingSlash.replace(/\/+$/, '');
  }

  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

/** サイト内パスを絶対 URL に変換 */
export function absoluteUrl(path: string, site: URL | string | undefined): string {
  return new URL(path, `${getSiteOrigin(site)}/`).href;
}

/** pathname から正規の絶対 URL を作る */
export function canonicalUrl(pathname: string, site: URL | string | undefined): string {
  return absoluteUrl(toCanonicalPath(pathname), site);
}

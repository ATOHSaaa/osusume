import { SITE_URL } from './constants';

/** astro.config の site から origin を取得（未設定時は SITE_URL） */
export function getSiteOrigin(site: URL | string | undefined): string {
  if (site instanceof URL) return site.origin;
  if (typeof site === 'string') return new URL(site).origin;
  return SITE_URL;
}

/** サイト内パスを絶対 URL に変換 */
export function absoluteUrl(path: string, site: URL | string | undefined): string {
  return new URL(path, `${getSiteOrigin(site)}/`).href;
}

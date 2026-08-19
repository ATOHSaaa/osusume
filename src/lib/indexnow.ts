import { SITE_URL } from './constants';

/** IndexNow API エンドポイント（Bing / Yandex 等へ配信） */
export const INDEXNOW_API_URL = 'https://api.indexnow.org/indexnow';

/** サイトの host（プロトコルなし） */
export function getIndexNowHost(): string {
  return new URL(SITE_URL).host;
}

/** キー検証ファイルの公開 URL */
export function getIndexNowKeyLocation(key: string): string {
  const host = getIndexNowHost();
  return `https://${host}/${encodeURIComponent(key)}.txt`;
}

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export function buildIndexNowPayload(key: string, urlList: string[]): IndexNowPayload {
  return {
    host: getIndexNowHost(),
    key,
    keyLocation: getIndexNowKeyLocation(key),
    urlList,
  };
}

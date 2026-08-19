/**
 * デプロイ後にサイトマップの URL を IndexNow API へ送信する。
 *
 * 実行例:
 *   INDEXNOW_KEY=abc123 npx tsx scripts/submit-indexnow.ts
 */
import 'dotenv/config';
import {
  buildIndexNowPayload,
  INDEXNOW_API_URL,
  getIndexNowKeyLocation,
} from '../src/lib/indexnow';
import { SITE_URL, SITEMAP_PATH } from '../src/lib/constants';

const MAX_URLS_PER_REQUEST = 10000;

function parseSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function fetchSitemapUrls(): Promise<string[]> {
  const sitemapUrl = new URL(SITEMAP_PATH, `${SITE_URL}/`).href;
  const res = await fetch(sitemapUrl, {
    headers: { Accept: 'application/xml, text/xml' },
  });

  if (!res.ok) {
    throw new Error(`サイトマップ取得失敗 (${res.status}): ${sitemapUrl}`);
  }

  const xml = await res.text();
  const urls = parseSitemapLocs(xml);

  if (urls.length === 0) {
    throw new Error(`サイトマップに URL がありません: ${sitemapUrl}`);
  }

  return urls;
}

async function verifyKeyFile(key: string): Promise<void> {
  const keyUrl = getIndexNowKeyLocation(key);
  const res = await fetch(keyUrl);
  if (!res.ok) {
    throw new Error(`キーファイルにアクセスできません (${res.status}): ${keyUrl}`);
  }
  const body = (await res.text()).trim();
  if (body !== key) {
    throw new Error(`キーファイルの内容が INDEXNOW_KEY と一致しません: ${keyUrl}`);
  }
}

async function submitToIndexNow(key: string, urlList: string[]): Promise<void> {
  if (urlList.length > MAX_URLS_PER_REQUEST) {
    throw new Error(
      `URL 数が上限 (${MAX_URLS_PER_REQUEST}) を超えています: ${urlList.length}件`
    );
  }

  const payload = buildIndexNowPayload(key, urlList);
  const res = await fetch(INDEXNOW_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (res.status === 200 || res.status === 202) {
    return;
  }

  const body = await res.text().catch(() => '');
  throw new Error(`IndexNow API エラー (${res.status}): ${body || res.statusText}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVerificationPendingError(message: string): boolean {
  return message.includes('SiteVerificationNotCompleted');
}

async function submitWithRetry(key: string, urlList: string[]): Promise<void> {
  const maxAttempts = 5;
  const retryDelayMs = 30_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await submitToIndexNow(key, urlList);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isVerificationPendingError(message) || attempt === maxAttempts) {
        throw err;
      }
      console.log(
        `サイト検証が完了していません — ${retryDelayMs / 1000}秒後に再試行 (${attempt}/${maxAttempts})...`
      );
      await sleep(retryDelayMs);
    }
  }
}

async function main(): Promise<void> {
  const key = process.env.INDEXNOW_KEY?.trim();

  if (!key) {
    console.log('INDEXNOW_KEY 未設定 — IndexNow 送信をスキップします。');
    return;
  }

  console.log(`サイト: ${SITE_URL}`);
  console.log(`キー検証: ${getIndexNowKeyLocation(key)}`);

  await verifyKeyFile(key);
  console.log('キーファイルを確認しました。');

  const urls = await fetchSitemapUrls();
  console.log(`サイトマップから ${urls.length} 件の URL を取得しました。`);

  await submitWithRetry(key, urls);
  console.log(`IndexNow へ ${urls.length} 件を送信しました（${INDEXNOW_API_URL}）。`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

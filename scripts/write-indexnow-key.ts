/**
 * INDEXNOW_KEY 環境変数からキー検証ファイルを public/ に書き出す。
 * ビルド前に実行し、dist ルートへ {key}.txt を配置する。
 *
 * 実行例:
 *   INDEXNOW_KEY=abc123 npx tsx scripts/write-indexnow-key.ts
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const key = process.env.INDEXNOW_KEY?.trim();

if (!key) {
  console.log('INDEXNOW_KEY 未設定 — キーファイルはスキップします。');
  process.exit(0);
}

if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
  console.error('INDEXNOW_KEY は英数字・ハイフン・アンダースコアのみ使用できます。');
  process.exit(1);
}

const publicDir = join(process.cwd(), 'public');
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

const filePath = join(publicDir, `${key}.txt`);
writeFileSync(filePath, key, 'utf-8');
console.log(`IndexNow キーファイルを書き出しました: public/${key}.txt`);

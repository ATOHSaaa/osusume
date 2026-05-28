# Osusume

Web上の「〇〇 おすすめ」記事を分析し、言及頻度の高い書籍をランキング形式で紹介するAstroサイトです。

## サイト名について

**Osusume**（おすすめ）— シンプルで覚えやすく、サービスの内容がそのまま伝わる名前です。

## 記事生成時の品質チェック

記事の新規作成・再生成後は **[docs/ARTICLE_GENERATION_CHECKLIST.md](docs/ARTICLE_GENERATION_CHECKLIST.md)** を必ず確認してください。**ランキングは必ず1位〜10位（10作品）** を含めます（漫画除外、Amazon 著者一致、版の優先など）。

## 機能

1. **DuckDuckGo 検索** — 「伊坂幸太郎 おすすめ」などのクエリで上位10件の記事を取得（APIキー不要）
2. **記事スクレイピング** — 各記事ページからテキストを抽出
3. **書籍名抽出** — 正規表現 + OpenAI API（任意）で作品名を検出
4. **頻度集計** — 複数記事での言及回数でランキング化（**上位10作品固定**）
5. **作家・ジャンル** — 作家別は検索10件、ジャンル別は検索30件。投稿サイト・SNS・Amazon 検索ページなどは検索から除外（一覧は `EXCLUDED_SEARCH_DOMAINS` in `src/lib/search.ts`）
6. **Amazon Creators API** — 商品画像・価格・アフィリエイトリンクを取得
7. **カードUI** — 書影付きのアフィリエイトカードを記事に表示
8. **出典一覧** — 記事末尾に参考にしたWeb記事のリンクを掲載

## セットアップ

```bash
npm install
cp .env.example .env
# .env を編集（Amazon / OpenAI は任意）
npm run dev
```

## 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `DDG_REGION` | 任意 | DuckDuckGo 検索リージョン（デフォルト: `jp-jp`） |
| `AMAZON_CREDENTIAL_ID` | 任意 | Amazon Creators API Credential ID |
| `AMAZON_CREDENTIAL_SECRET` | 任意 | Amazon Creators API Credential Secret |
| `AMAZON_PARTNER_TAG` | 任意 | アソシエイトタグ |
| `OPENAI_API_KEY` | 任意 | 書籍名抽出の精度向上用 |

### DuckDuckGo 検索について

通常の Web 検索結果は [api.duckduckgo.com](https://api.duckduckgo.com/)（Instant Answer API）では取得できません。
本プロジェクトでは [`@phukon/duckduckgo-search`](https://www.npmjs.com/package/@phukon/duckduckgo-search) を使い、**APIキー不要**で DuckDuckGo の検索結果を取得しています。

### Amazon Creators API の設定

1. [Amazonアソシエイト](https://affiliate.amazon.co.jp/) に登録
2. [Creators API](https://affiliate-program.amazon.co.jp/creatorsapi) でアプリを作成
3. Credential ID / Secret / Partner Tag を `.env` に設定

## 記事の生成

```bash
# 作家別
npm run generate -- "伊坂幸太郎" isaka-kotaro

# ジャンル別（検索: 「百合 小説 おすすめ」）
npm run generate -- --genre "百合" yuri
```

生成された MDX ファイルは `src/content/articles/` に保存されます。

## 開発

```bash
npm run dev      # 開発サーバー (http://localhost:4321)
npm run build    # 本番ビルド
npm run preview  # ビルド結果のプレビュー
```

## プロジェクト構成

```
osusume/
├── scripts/
│   └── generate-article.ts   # 記事自動生成 CLI
├── src/
│   ├── components/
│   │   ├── BookCard.astro    # Amazonアフィリエイトカード
│   │   ├── ArticleBooks.astro
│   │   └── Sources.astro     # 出典一覧
│   ├── content/
│   │   └── articles/         # 生成された記事 (MDX)
│   ├── layouts/
│   ├── lib/
│   │   ├── search.ts         # DuckDuckGo検索
│   │   ├── scraper.ts        # ページ取得
│   │   ├── book-extractor.ts # 書籍名抽出
│   │   └── amazon.ts         # Amazon Creators API
│   └── pages/
└── .env.example
```

## 注意事項

- Webスクレイピングは対象サイトの利用規約・robots.txt を確認してください
- Amazon Creators API は直近30日間で10件以上の適格売上が必要です
- 生成記事の内容は参考情報です。正確性は保証されません

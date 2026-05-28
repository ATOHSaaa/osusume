# 記事生成チェックリスト

記事を新規生成・再生成したあと、必ずこの一覧を確認してください。  
実装は `src/lib/book-format.ts`・`src/lib/author-match.ts`・`src/lib/amazon.ts`・`src/lib/book-extractor.ts` に反映済みです。

## ランキング件数（最大10作品）

- [ ] `books:` 配列に **1〜10作品** ある（`MAX_BOOKS = 10` が上限）
- [ ] サイト上のランキング表示が **1位から掲載件数分** 揃っている
- Amazon で確認できた作品が10件未満の場合は、**確認できた件数で掲載してよい**（`scripts/generate-article.ts` は警告のみ）
- 10件に近づけるときは、Web記事での言及頻度が高い順で候補を選ぶ

## 生成コマンド

**作家別**

```bash
npm run generate -- "作家名" english-slug
```

**ジャンル別**（検索: `{ジャンル} 小説 おすすめ`）

```bash
npm run generate -- --genre "百合" yuri
npm run generate:genre -- "百合 小説 おすすめ" yuri
```

- ジャンル記事は `kind: genre`、著者照合は行わない（各作品の著者名は Amazon API から取得し、カードに必ず表示）
- ジャンル記事は検索結果を **30件** まで分析（作家記事は10件）。`GENRE_SEARCH_LIMIT` in `src/lib/constants.ts`

### 検索結果の除外ドメイン（恒久）

以下は DuckDuckGo 取得時に常にスキップ（`src/lib/search.ts` の `EXCLUDED_SEARCH_DOMAINS`）:

- `kakuyomu.jp`
- `pixiv.net`
- `teller.jp`
- `alphapolis.co.jp`
- `x.com`
- `yurinavi.com`
- `caita.ai`
- `glnovel.com`
- `amazon.co.jp`
- `estar.jp`
- `l-love.jp`
- `berrys-cafe.jp`
- `novel.prcm.jp`

## 除外・品質ルール

### 0. 抽出は HTML 構造優先（`book-html-extractor.ts`）

- [ ] ランキングの `<ol>` / `<li>`、順位見出し、書店リンク（Amazon・honto 等）から書名を抽出している
- [ ] 構造から取れないページのみ、従来の `「」` テキスト抽出に fallback
- [ ] OpenAI 候補は **記事本文に出現するものだけ** 採用
- [ ] 各作品の `count` は **言及した参考記事の件数**（同一記事内の重複言及は1件）。作家記事では最大10、ジャンル記事では最大30

### 0b. Amazon 照合ゲート（必須）

- [ ] `npm run generate` は Amazon Creators API 必須（未設定ならエラー）
- [ ] ランキングに載るのは **Amazon Books で商品が確認できた作品のみ**（最大80候補まで試行）
- [ ] 未検出の候補はスキップし、次点で10件まで埋める

### 1. 漫画は入れない

- [ ] ランキングに **コミックス・漫画版・○巻（１）** などが含まれていない
- 抽出段階: `book-extractor.ts` の `EXCLUDED_TITLE_PATTERNS`
- Amazon段階: `isMangaProduct()`（コミックス、ジャンプ、モーニングコミックス等）

### 2. 成人向けコンテンツは入れない

- [ ] 官能・R18・アダルトレーベル（GirlsCREATIVE 等）の作品が含まれていない
- 抽出・Amazon 両方: `src/lib/adult-content.ts` の `isAdultContent()`

### 3. 雑誌・特集号は入れない

- [ ] ユリイカ、○年○月号、文藝春秋（雑誌名）などが含まれていない
- [ ] 単独の「ガリレオ」など、書籍名ではないシリーズ愛称が含まれていない
- `isExcludedBook()` で除外

### 4. 記事の作家の作品だけがランキングに入っている

- [ ] 他作家の代表作が混入していない（例: 朝井リョウ記事に江國香織の「健やかな論理」）
- `book-extractor.ts` の `KNOWN_BOOK_AUTHORS` に既知の誤混入を追加

### 5. Amazon の著者が記事の作家と一致する

- [ ] 各作品の API 著者名が **記事の `author`（対象作家）** と一致している
- [ ] タイトルだけ似ている別著者の本（例: 「デューク」→ 別のデューク本）が入っていない
- 実装: `isMatchingAuthor()` + `pickPreferredSearchItem(..., expectedAuthor)`
- API に著者名がある場合は必ず一致すること。著者名が空のときはタイトル一致で採用（誤著者が明示されている場合は除外）

### 6. タイトル一致は厳しめ

- [ ] 短い検索語が長い別タイトルに誤マッチしていない（例: 「デューク」→「デューク更家の…」）
- [ ] 別作品名の一部にだけ含まれるタイトル（例: 「東京タワー」→「この部屋から東京タワーは…」）になっていない

### 7. シリーズは第1部・上巻から

- [ ] 「ブレードランナー 3」のような **中巻以降だけ** が単独で載っていない
- [ ] 分割版は **(上)** / 第1巻 を優先（`getSeriesVolumePenalty` in `book-format.ts`）

### 8. 版・フォーマット

優先順位: **Kindle → 文庫 → つばさ文庫 → 単行本**

- [ ] 角川つばさ文庫より通常の角川文庫を優先できているか
- [ ] Audible・限定版・Kstargate・シリーズセットは除外されているか

### 9. 手動指定がある場合

- [ ] ユーザー指定の Amazon URL / ASIN があれば MDX を直接更新し、このリストにメモする

## 記事 MDX の目視確認

`src/content/articles/{slug}-recommended-books.mdx` の `books:` を上から確認:

| 確認項目 | OK の例 |
|----------|---------|
| 件数 | `books:` が **1〜10件**（最大10位まで） |
| タイトル | 作品名 + 文庫名程度。別作品の長い副題が付いていない |
| `asin` | 作家の該当作品の ASIN |
| `amazonUrl` | `/dp/{asin}` 形式でタグ付き（**検索結果 URL `/s?` は不可**） |
| 未検出 | API で商品が取れない作品は掲載しない。別候補で10件まで埋める |
| 4位付近 | 特に誤マッチしやすい短いタイトル（デューク、東京タワー等） |

## 問題があったとき

1. 上記ルールを `src/lib/` に追加・修正
2. `npm run generate -- "作家名" slug` で再生成
3. このチェックリストを再度実行

## 既知の注意点

- Amazon API で商品が取れないタイトルは **掲載しない**（検索ページへのリンクは使わない）。再生成で次点の作品が繰り上がる。

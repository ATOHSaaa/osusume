# Search Console 分析（Cursor 向け）

First Books の GSC データを取得し、Cursor エージェントが分析できるようにする手順です。

## クイックスタート

```bash
cd /Users/atohs/osusume
python3 -m venv .venv-gsc
source .venv-gsc/bin/activate
pip install -r requirements-gsc.txt
cp .env.example .env   # 初回のみ
python -m gsc_weekly check
python -m gsc_weekly generate
```

出力先:

- `research/output/gsc-weekly/data/latest.json` — Cursor が読むメインデータ
- `research/output/gsc-weekly/reports/latest.html` — ブラウザ用レポート

## Cursor に依頼する例

- 「`latest.json` を見て、CTR が低いクエリを優先改善案にして」
- 「順位 8〜12 位でインプレッションが多いキーワードを洗い出して」
- 「GSC を更新して、前週比でクリックが減ったページを分析して」

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `python -m gsc_weekly check` | セットアップ確認 |
| `python -m gsc_weekly auth` | OAuth 認証（初回・再認証） |
| `python -m gsc_weekly sites` | アクセス可能なプロパティ一覧 |
| `python -m gsc_weekly generate` | 最新データ取得 → JSON/HTML 保存 |
| `python -m gsc_weekly serve` | ローカルビューア（既定: http://127.0.0.1:8766/） |

認証の詳細は [credentials/README.md](../credentials/README.md)。

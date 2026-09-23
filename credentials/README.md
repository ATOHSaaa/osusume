# GSC API 初回セットアップ

Search Console API は **OAuth 2.0（Googleアカウントログイン）** が必須です。APIキーだけでは動きません。

## すでに認証済みの場合

`ananmark-seo` と同じ Google Cloud プロジェクトの OAuth クライアントを使っている場合、`client_secret.json` と `token.json` をこのフォルダに置くだけで動きます（Git にはコミットしない）。

## 初回セットアップ手順

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. [Search Console API](https://console.cloud.google.com/apis/library) を有効化
3. [OAuth 同意画面](https://console.cloud.google.com/apis/credentials/consent) を **外部** に設定し、テストユーザーに自分の Gmail を追加
4. [認証情報](https://console.cloud.google.com/apis/credentials) → **OAuth クライアント ID（デスクトップ）** → JSON を `client_secret.json` として保存
5. `.env` の `GSC_PROPERTY_URL` を Search Console のプロパティURLと完全一致させる

```bash
cd /Users/atohs/osusume
python3 -m venv .venv-gsc
source .venv-gsc/bin/activate
pip install -r requirements-gsc.txt
cp .env.example .env
python -m gsc_weekly check
python -m gsc_weekly auth
python -m gsc_weekly sites
python -m gsc_weekly generate
```

## トラブルシュート

| 症状 | 対処 |
|------|------|
| `403: org_internal` | OAuth 同意画面を **外部** に変更 |
| `access_denied` | テストユーザーに自分を追加 |
| プロパティが `sites` に出ない | Search Console 権限のあるアカウントでログイン |
| `invalid_grant` | `token.json` を削除して `auth` を再実行 |

`client_secret.json` と `token.json` は **Git にコミットしない**（`.gitignore` 済み）。

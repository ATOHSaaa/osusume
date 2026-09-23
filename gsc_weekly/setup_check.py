"""セットアップ状態を確認."""

from __future__ import annotations

import json
import sys

from gsc_weekly.config import (
    GSC_CREDENTIALS_FILE,
    GSC_PROPERTY_URL,
    GSC_TOKEN_FILE,
)


def main() -> int:
    ok = True
    print("=== GSC 週次レポート セットアップ確認 ===\n")

    if GSC_PROPERTY_URL:
        print(f"✓ GSC_PROPERTY_URL = {GSC_PROPERTY_URL}")
    else:
        print("✗ GSC_PROPERTY_URL が .env に未設定")
        ok = False

    if GSC_CREDENTIALS_FILE.is_file():
        try:
            data = json.loads(GSC_CREDENTIALS_FILE.read_text(encoding="utf-8"))
            if "installed" in data or "web" in data:
                print(f"✓ OAuthクライアント: {GSC_CREDENTIALS_FILE}")
            else:
                print(
                    f"⚠ {GSC_CREDENTIALS_FILE} は OAuth形式ではない可能性があります"
                )
                print("  （APIキーではなく「OAuth 2.0 クライアント ID（デスクトップ）」のJSONが必要）")
                ok = False
        except json.JSONDecodeError:
            print(f"✗ {GSC_CREDENTIALS_FILE} が不正なJSONです")
            ok = False
    else:
        print(f"✗ OAuthクライアント未配置: {GSC_CREDENTIALS_FILE}")
        print("  → credentials/README.md の手順で client_secret.json を配置")
        ok = False

    if GSC_TOKEN_FILE.is_file():
        print(f"✓ 認証トークン: {GSC_TOKEN_FILE}")
        print("\n次: python -m gsc_weekly generate  または  python -m gsc_weekly serve")
    else:
        print(f"○ 認証トークン未作成: {GSC_TOKEN_FILE}")
        if ok:
            print("\n次: python -m gsc_weekly auth  （ブラウザでGoogleログイン）")
        ok = False

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

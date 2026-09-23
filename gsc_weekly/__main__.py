#!/usr/bin/env python3
"""CLI: python -m gsc_weekly [auth|sites|generate|serve]"""

from __future__ import annotations

import argparse
import sys


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Google Search Console 週次レポート（API取得 → HTML）"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_auth = sub.add_parser("auth", help="OAuth認証（ブラウザでGoogleログイン）")
    p_auth.add_argument(
        "--reset",
        action="store_true",
        help="保存済み token.json を削除してから再認証",
    )
    sub.add_parser("check", help="セットアップ状態を確認")
    sub.add_parser("sites", help="アクセス可能なプロパティ一覧")
    sub.add_parser("generate", help="レポートを生成してHTML保存")
    p_serve = sub.add_parser("serve", help="ブラウザ用ローカルサーバー起動")
    p_serve.add_argument("--port", type=int, default=None, help="ポート番号")

    args = parser.parse_args(argv)

    if args.command == "auth":
        from gsc_weekly.auth import run_auth_flow
        from gsc_weekly.config import GSC_TOKEN_FILE

        if getattr(args, "reset", False) and GSC_TOKEN_FILE.is_file():
            GSC_TOKEN_FILE.unlink()
            print(f"削除しました: {GSC_TOKEN_FILE}")

        print("ブラウザが開きます。Search Console にアクセスできる Google アカウントでログインしてください。")
        path = run_auth_flow()
        print(f"認証完了。トークン保存: {path}")
        return 0

    if args.command == "check":
        from gsc_weekly.setup_check import main as check_main

        return check_main()

    if args.command == "sites":
        from gsc_weekly.api import list_sites

        for url in list_sites():
            print(url)
        return 0

    if args.command == "generate":
        from gsc_weekly.report import save_report

        html_path, json_path = save_report()
        print(f"HTML: {html_path}")
        print(f"JSON: {json_path}")
        return 0

    if args.command == "serve":
        if args.port is not None:
            import gsc_weekly.config as cfg

            cfg.GSC_SERVER_PORT = args.port
        from gsc_weekly.server import run_server

        run_server()
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())

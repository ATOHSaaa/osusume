"""Google Search Console API 用 OAuth2 認証."""

from __future__ import annotations

from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

from gsc_weekly.config import GSC_CREDENTIALS_FILE, GSC_TOKEN_FILE, SCOPES


def get_credentials(*, force_refresh: bool = False) -> Credentials:
    """保存済みトークンを読み込み、必要なら更新または再認証する."""
    if not GSC_CREDENTIALS_FILE.is_file():
        raise FileNotFoundError(
            f"OAuthクライアントJSONが見つかりません: {GSC_CREDENTIALS_FILE}\n"
            "Google Cloud Console で Search Console API を有効化し、"
            "「OAuth 2.0 クライアント ID（デスクトップ）」をダウンロードして "
            f"{GSC_CREDENTIALS_FILE} に配置してください。"
        )

    creds: Credentials | None = None
    if GSC_TOKEN_FILE.is_file() and not force_refresh:
        creds = Credentials.from_authorized_user_file(str(GSC_TOKEN_FILE), SCOPES)

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        flow = InstalledAppFlow.from_client_secrets_file(
            str(GSC_CREDENTIALS_FILE), SCOPES
        )
        creds = flow.run_local_server(port=0, prompt="consent")

    GSC_TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    GSC_TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
    return creds


def run_auth_flow() -> Path:
    """初回認証（ブラウザでGoogleログイン）."""
    creds = get_credentials(force_refresh=True)
    return GSC_TOKEN_FILE

"""GSC週次レポート用の設定."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

OUTPUT_DIR = ROOT / "research" / "output" / "gsc-weekly"
REPORTS_DIR = OUTPUT_DIR / "reports"
DATA_DIR = OUTPUT_DIR / "data"
CREDENTIALS_DIR = ROOT / "credentials"

GSC_PROPERTY_URL = os.getenv("GSC_PROPERTY_URL", "").strip()
GSC_CREDENTIALS_FILE = Path(
    os.getenv("GSC_CREDENTIALS_FILE", str(CREDENTIALS_DIR / "client_secret.json"))
)
GSC_TOKEN_FILE = Path(os.getenv("GSC_TOKEN_FILE", str(CREDENTIALS_DIR / "token.json")))
GSC_WEEKS = int(os.getenv("GSC_WEEKS", "12"))
GSC_DATA_LAG_DAYS = int(os.getenv("GSC_DATA_LAG_DAYS", "3"))
GSC_SERVER_HOST = os.getenv("GSC_SERVER_HOST", "127.0.0.1")
GSC_SERVER_PORT = int(os.getenv("GSC_SERVER_PORT", "8765"))

SCOPES = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/webmasters",
]

OAUTH_PORT = 8080

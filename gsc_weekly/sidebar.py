"""Search Console データからサイドバー用の作家ランキング JSON を生成."""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
SIDEBAR_JSON = ROOT / "src" / "data" / "gsc-top-authors.json"
ARTICLE_PATH_RE = re.compile(r"^/articles/([^/]+)/$")
EXCLUDE_SLUG_MARKERS = ("-winner-",)


def _path_from_page_url(page_url: str) -> str:
    path = urlparse(page_url).path or "/"
    return path if path.endswith("/") else f"{path}/"


def _slug_from_page_url(page_url: str) -> str | None:
    path = _path_from_page_url(page_url)
    match = ARTICLE_PATH_RE.match(path)
    if not match:
        return None
    slug = match.group(1)
    if not slug.endswith("-recommended-books"):
        return None
    if any(marker in slug for marker in EXCLUDE_SLUG_MARKERS):
        return None
    return slug


def extract_author_pages(page_rows: list[dict[str, Any]], limit: int = 50) -> list[dict[str, Any]]:
    """記事 URL をクリック数で集計（同一 slug は合算しない想定で先勝ち）."""
    ranked: list[dict[str, Any]] = []
    seen: set[str] = set()

    for row in sorted(page_rows, key=lambda item: item.get("clicks", 0), reverse=True):
        page_url = str(row.get("page", ""))
        slug = _slug_from_page_url(page_url)
        if not slug or slug in seen:
            continue
        seen.add(slug)
        ranked.append(
            {
                "slug": slug,
                "path": _path_from_page_url(page_url),
                "clicks": int(row.get("clicks", 0)),
                "impressions": int(row.get("impressions", 0)),
            }
        )
        if len(ranked) >= limit:
            break

    return ranked


def write_sidebar_json(data: dict[str, Any], *, limit: int = 50) -> Path:
    """src/data/gsc-top-authors.json を更新."""
    pages = data.get("top_pages_period") or data.get("top_pages_latest_week") or []
    period = data.get("period", {})
    period_meta: dict[str, Any]

    if data.get("top_pages_period"):
        start, end = _period_bounds(data)
        period_meta = {
            "start": start,
            "end": end,
            "weeks": period.get("weeks_shown"),
            "source": "top_pages_period",
        }
    else:
        latest_week = period.get("latest_week", {})
        period_meta = {
            "start": latest_week.get("start"),
            "end": latest_week.get("end"),
            "weeks": 1,
            "source": "top_pages_latest_week",
        }

    payload = {
        "generated_at": data.get("generated_at"),
        "period": period_meta,
        "authors": extract_author_pages(pages, limit=limit),
    }

    SIDEBAR_JSON.parent.mkdir(parents=True, exist_ok=True)
    SIDEBAR_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return SIDEBAR_JSON


def _period_bounds(data: dict[str, Any]) -> tuple[str | None, str | None]:
    weekly = data.get("weekly") or []
    if not weekly:
        period = data.get("period", {})
        latest_week = period.get("latest_week", {})
        return latest_week.get("start"), latest_week.get("end")

    starts = [row.get("week_start") for row in weekly if row.get("week_start")]
    if not starts:
        return None, None

    start = min(starts)
    try:
        from datetime import timedelta

        end_date = date.fromisoformat(starts[-1])
        end = (end_date + timedelta(days=6)).isoformat()
    except ValueError:
        end = None
    return start, end


def sync_sidebar_from_latest_json() -> Path:
    """research/output の latest.json からサイドバー JSON を再生成."""
    latest_json = ROOT / "research" / "output" / "gsc-weekly" / "data" / "latest.json"
    if not latest_json.is_file():
        raise FileNotFoundError(
            f"GSC データが見つかりません: {latest_json}\n"
            "先に `python -m gsc_weekly generate` を実行してください。"
        )
    data = json.loads(latest_json.read_text(encoding="utf-8"))
    return write_sidebar_json(data)

"""Search Console API ラッパー."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from googleapiclient.discovery import build

from gsc_weekly.auth import get_credentials
from gsc_weekly.config import GSC_DATA_LAG_DAYS, GSC_PROPERTY_URL, GSC_WEEKS


def _service():
    return build("searchconsole", "v1", credentials=get_credentials())


def list_sites() -> list[str]:
    """アクセス可能なプロパティURL一覧."""
    resp = _service().sites().list().execute()
    entries = resp.get("siteEntry", [])
    return sorted(e["siteUrl"] for e in entries if e.get("permissionLevel") != "siteUnverifiedUser")


def _date_range(weeks: int | None = None) -> tuple[date, date]:
    weeks = weeks or GSC_WEEKS
    span_days = weeks * 7 + 14
    end = date.today() - timedelta(days=GSC_DATA_LAG_DAYS)
    start = end - timedelta(days=span_days - 1)
    return start, end


def _fmt(d: date) -> str:
    return d.isoformat()


def query_search_analytics(
    *,
    start: date,
    end: date,
    dimensions: list[str],
    row_limit: int = 25000,
    search_type: str = "web",
) -> list[dict[str, Any]]:
    """searchanalytics.query の行をフラットな dict リストで返す."""
    if not GSC_PROPERTY_URL:
        raise ValueError(
            "GSC_PROPERTY_URL が未設定です。.env に "
            "GSC_PROPERTY_URL=https://example.com/ を設定してください。"
        )

    body: dict[str, Any] = {
        "startDate": _fmt(start),
        "endDate": _fmt(end),
        "dimensions": dimensions,
        "rowLimit": row_limit,
        "type": search_type,
        "dataState": "all",
    }

    rows: list[dict[str, Any]] = []
    start_row = 0
    while True:
        body["startRow"] = start_row
        resp = (
            _service()
            .searchanalytics()
            .query(siteUrl=GSC_PROPERTY_URL, body=body)
            .execute()
        )
        batch = resp.get("rows", [])
        if not batch:
            break
        for row in batch:
            item: dict[str, Any] = {
                "clicks": row.get("clicks", 0),
                "impressions": row.get("impressions", 0),
                "ctr": row.get("ctr", 0),
                "position": row.get("position", 0),
            }
            for i, dim in enumerate(dimensions):
                keys = row.get("keys", [])
                if i < len(keys):
                    item[dim] = keys[i]
            rows.append(item)
        if len(batch) < row_limit:
            break
        start_row += len(batch)

    return rows


def fetch_daily_metrics(weeks: int | None = None) -> list[dict[str, Any]]:
    start, end = _date_range(weeks)
    return query_search_analytics(start=start, end=end, dimensions=["date"])


def fetch_dimension_metrics(
    dimension: str,
    *,
    start: date | None = None,
    end: date | None = None,
    row_limit: int = 1000,
) -> list[dict[str, Any]]:
    if start is None or end is None:
        start, end = _date_range()
    return query_search_analytics(
        start=start,
        end=end,
        dimensions=[dimension],
        row_limit=row_limit,
    )


def fetch_period_metrics(
    start: date,
    end: date,
    dimension: str,
    *,
    row_limit: int = 500,
) -> list[dict[str, Any]]:
    """指定期間の query / page 等."""
    return query_search_analytics(
        start=start,
        end=end,
        dimensions=[dimension],
        row_limit=row_limit,
    )

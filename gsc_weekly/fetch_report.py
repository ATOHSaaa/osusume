"""GSCからデータ取得しレポート用JSONを組み立て."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from gsc_weekly import aggregate
from gsc_weekly.api import (
    fetch_daily_metrics,
    fetch_period_metrics,
    query_search_analytics,
)
from gsc_weekly.config import GSC_DATA_LAG_DAYS, GSC_PROPERTY_URL, GSC_WEEKS


def _latest_complete_week() -> tuple[date, date, date, date]:
    """直近完了週とその前週（月〜日）."""
    end = date.today() - timedelta(days=GSC_DATA_LAG_DAYS)
    last_monday = aggregate.week_start(end)
    if end < last_monday + timedelta(days=6):
        last_monday -= timedelta(days=7)
    last_sunday = last_monday + timedelta(days=6)
    prev_monday = last_monday - timedelta(days=7)
    prev_sunday = prev_monday + timedelta(days=6)
    return last_monday, last_sunday, prev_monday, prev_sunday


def build_report_data(weeks: int | None = None) -> dict[str, Any]:
    weeks = weeks or GSC_WEEKS
    daily = fetch_daily_metrics(weeks)
    weekly = aggregate.add_week_over_week(
        aggregate.trim_to_last_n_weeks(
            aggregate.aggregate_daily_to_weeks(daily),
            weeks,
        )
    )

    lm_start, lm_end, pm_start, pm_end = _latest_complete_week()
    latest_queries = fetch_period_metrics(lm_start, lm_end, "query", row_limit=500)
    prev_queries = fetch_period_metrics(pm_start, pm_end, "query", row_limit=500)
    latest_pages = fetch_period_metrics(lm_start, lm_end, "page", row_limit=200)
    prev_pages = fetch_period_metrics(pm_start, pm_end, "page", row_limit=200)

    latest_queries.sort(key=lambda r: r.get("clicks", 0), reverse=True)
    latest_pages.sort(key=lambda r: r.get("clicks", 0), reverse=True)

    # ページ×クエリ（記事別の改善施策生成に使用）
    page_query_rows = query_search_analytics(
        start=lm_start,
        end=lm_end,
        dimensions=["page", "query"],
        row_limit=2000,
    )
    page_queries: dict[str, list[dict[str, Any]]] = {}
    for row in sorted(
        page_query_rows, key=lambda r: r.get("impressions", 0), reverse=True
    ):
        page = row.get("page", "")
        if not page:
            continue
        bucket = page_queries.setdefault(page, [])
        if len(bucket) < 8:
            bucket.append(
                {
                    "query": row.get("query", ""),
                    "clicks": int(row.get("clicks", 0)),
                    "impressions": int(row.get("impressions", 0)),
                    "ctr": row.get("ctr", 0),
                    "position": round(float(row.get("position", 0)), 2),
                }
            )

    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "property_url": GSC_PROPERTY_URL,
        "period": {
            "weeks_shown": weeks,
            "data_end": (date.today() - timedelta(days=GSC_DATA_LAG_DAYS)).isoformat(),
            "latest_week": {
                "start": lm_start.isoformat(),
                "end": lm_end.isoformat(),
                "label": aggregate.week_label(lm_start),
            },
            "previous_week": {
                "start": pm_start.isoformat(),
                "end": pm_end.isoformat(),
                "label": aggregate.week_label(pm_start),
            },
        },
        "summary": aggregate.summarize_totals(weekly),
        "weekly": weekly,
        "top_queries_latest_week": latest_queries[:25],
        "top_pages_latest_week": latest_pages[:25],
        "page_queries_latest_week": page_queries,
        "query_movers": aggregate.top_movers(
            latest_queries, prev_queries, key="query", label_key="query"
        ),
        "page_movers": aggregate.top_movers(
            latest_pages, prev_pages, key="page", label_key="page"
        ),
    }

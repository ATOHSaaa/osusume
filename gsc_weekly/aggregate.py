"""日次データを週次に集計."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any


def parse_gsc_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def week_start(d: date) -> date:
    """月曜始まりの週."""
    return d - timedelta(days=d.weekday())


def week_label(week_monday: date) -> str:
    sunday = week_monday + timedelta(days=6)
    return f"{week_monday:%Y-%m-%d} 〜 {sunday:%m/%d}"


def aggregate_daily_to_weeks(daily_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """日次行を週次サマリーに集約（加重平均順位）."""
    buckets: dict[date, dict[str, float]] = defaultdict(
        lambda: {"clicks": 0.0, "impressions": 0.0, "position_sum": 0.0}
    )

    for row in daily_rows:
        d = parse_gsc_date(str(row["date"]))
        wk = week_start(d)
        clicks = float(row.get("clicks", 0))
        impr = float(row.get("impressions", 0))
        pos = float(row.get("position", 0))
        buckets[wk]["clicks"] += clicks
        buckets[wk]["impressions"] += impr
        buckets[wk]["position_sum"] += pos * impr

    weeks: list[dict[str, Any]] = []
    for wk in sorted(buckets.keys()):
        b = buckets[wk]
        impr = b["impressions"]
        clicks = b["clicks"]
        ctr = (clicks / impr * 100) if impr else 0.0
        position = (b["position_sum"] / impr) if impr else 0.0
        weeks.append(
            {
                "week_start": wk.isoformat(),
                "week_label": week_label(wk),
                "clicks": int(clicks),
                "impressions": int(impr),
                "ctr": round(ctr, 2),
                "position": round(position, 2),
            }
        )
    return weeks


def add_week_over_week(weeks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """前週比（%）を各週に付与."""
    enriched: list[dict[str, Any]] = []
    for i, w in enumerate(weeks):
        row = dict(w)
        if i == 0:
            row["wow_clicks"] = None
            row["wow_impressions"] = None
            row["wow_ctr"] = None
            row["wow_position"] = None
        else:
            prev = weeks[i - 1]
            row["wow_clicks"] = _pct_change(prev["clicks"], w["clicks"])
            row["wow_impressions"] = _pct_change(prev["impressions"], w["impressions"])
            row["wow_ctr"] = _pct_change(prev["ctr"], w["ctr"])
            row["wow_position"] = round(w["position"] - prev["position"], 2)
        enriched.append(row)
    return enriched


def _pct_change(old: float, new: float) -> float | None:
    if old == 0:
        return None if new == 0 else 100.0
    return round((new - old) / old * 100, 1)


def trim_to_last_n_weeks(weeks: list[dict[str, Any]], n: int) -> list[dict[str, Any]]:
    return weeks[-n:] if len(weeks) > n else weeks


def summarize_totals(weeks: list[dict[str, Any]]) -> dict[str, Any]:
    if not weeks:
        return {}
    clicks = sum(w["clicks"] for w in weeks)
    impr = sum(w["impressions"] for w in weeks)
    pos_sum = sum(w["position"] * w["impressions"] for w in weeks)
    return {
        "clicks": clicks,
        "impressions": impr,
        "ctr": round(clicks / impr * 100, 2) if impr else 0,
        "position": round(pos_sum / impr, 2) if impr else 0,
        "week_count": len(weeks),
    }


def top_movers(
    current: list[dict[str, Any]],
    previous: list[dict[str, Any]],
    *,
    key: str,
    label_key: str,
    top_n: int = 15,
) -> dict[str, list[dict[str, Any]]]:
    """クリック増減のランキング（クエリ・ページ共通）."""
    prev_map = {r[key]: r for r in previous}
    deltas: list[dict[str, Any]] = []

    for row in current:
        k = row[key]
        prev = prev_map.get(k, {})
        cur_clicks = int(row.get("clicks", 0))
        prev_clicks = int(prev.get("clicks", 0))
        delta = cur_clicks - prev_clicks
        if cur_clicks == 0 and prev_clicks == 0:
            continue
        deltas.append(
            {
                label_key: k,
                "clicks": cur_clicks,
                "prev_clicks": prev_clicks,
                "delta": delta,
                "impressions": int(row.get("impressions", 0)),
                "position": round(float(row.get("position", 0)), 2),
            }
        )

    gainers = sorted(
        [d for d in deltas if d["delta"] > 0],
        key=lambda x: x["delta"],
        reverse=True,
    )[:top_n]
    losers = sorted(
        [d for d in deltas if d["delta"] < 0],
        key=lambda x: x["delta"],
    )[:top_n]
    return {"gainers": gainers, "losers": losers}

"""週次レポートのHTML生成・保存."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from gsc_weekly.config import DATA_DIR, REPORTS_DIR
from gsc_weekly.fetch_report import build_report_data
from gsc_weekly.recommendations import generate_page_actions, generate_recommendations

_TEMPLATE_DIR = Path(__file__).parent / "templates"


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )


def save_report(data: dict | None = None) -> tuple[Path, Path]:
    """JSONとHTMLを research/output/gsc-weekly/ に保存."""
    data = data or build_report_data()
    data["recommendations"] = generate_recommendations(data)
    data["page_actions"] = generate_page_actions(data)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    json_path = DATA_DIR / f"weekly-{stamp}.json"
    html_path = REPORTS_DIR / f"weekly-{stamp}.html"

    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    html = _env().get_template("weekly_report.html").render(**_template_context(data))
    html_path.write_text(html, encoding="utf-8")

    latest_json = DATA_DIR / "latest.json"
    latest_html = REPORTS_DIR / "latest.html"
    latest_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    latest_html.write_text(html, encoding="utf-8")

    return html_path, json_path


def _template_context(data: dict) -> dict:
    weekly = data.get("weekly", [])
    max_clicks = max((w["clicks"] for w in weekly), default=1) or 1
    max_impr = max((w["impressions"] for w in weekly), default=1) or 1

    for w in weekly:
        w["clicks_bar_pct"] = round(w["clicks"] / max_clicks * 100, 1)
        w["impr_bar_pct"] = round(w["impressions"] / max_impr * 100, 1)

    property_display = data.get("property_url", "").replace("https://", "").rstrip("/")
    recommendations = data.get("recommendations") or generate_recommendations(data)
    page_actions = data.get("page_actions")
    if page_actions is None:
        page_actions = generate_page_actions(data)
    return {
        **data,
        "property_display": property_display,
        "title": f"GSC週次レポート — {property_display}",
        "recommendations": recommendations,
        "page_actions": page_actions,
    }


def list_reports() -> list[dict]:
    """保存済みHTMLレポート一覧（新しい順）."""
    if not REPORTS_DIR.is_dir():
        return []
    items = []
    for path in sorted(REPORTS_DIR.glob("weekly-*.html"), reverse=True):
        if path.name == "latest.html":
            continue
        items.append(
            {
                "filename": path.name,
                "path": str(path),
                "modified": datetime.fromtimestamp(path.stat().st_mtime).isoformat(
                    timespec="seconds"
                ),
            }
        )
    return items

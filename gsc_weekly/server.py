"""週次レポート用ローカルWebサーバー."""

from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, render_template, send_from_directory

from gsc_weekly.config import (
    GSC_PROPERTY_URL,
    GSC_SERVER_HOST,
    GSC_SERVER_PORT,
    GSC_TOKEN_FILE,
    REPORTS_DIR,
)
from gsc_weekly.report import list_reports, save_report

app = Flask(
    __name__,
    template_folder=str(Path(__file__).parent / "templates"),
)


def _auth_ok() -> bool:
    return GSC_TOKEN_FILE.is_file()


@app.route("/")
def index():
    return render_template(
        "dashboard.html",
        auth_ok=_auth_ok(),
        property_url=GSC_PROPERTY_URL,
        token_file=str(GSC_TOKEN_FILE),
        reports=list_reports()[:20],
        has_latest=(REPORTS_DIR / "latest.html").is_file(),
    )


@app.route("/reports/<path:filename>")
def serve_report(filename: str):
    if ".." in filename or "/" in filename or "\\" in filename:
        return "Forbidden", 403
    path = (REPORTS_DIR / filename).resolve()
    if not path.is_file() or REPORTS_DIR.resolve() not in path.parents:
        return "Not found", 404
    return send_from_directory(REPORTS_DIR, filename)


@app.route("/api/generate", methods=["POST"])
def api_generate():
    if not _auth_ok():
        return jsonify({"error": "未認証です。python -m gsc_weekly auth を実行してください。"}), 400
    if not GSC_PROPERTY_URL:
        return jsonify({"error": "GSC_PROPERTY_URL が .env に設定されていません。"}), 400
    try:
        html_path, json_path = save_report()
        return jsonify(
            {
                "ok": True,
                "html": html_path.name,
                "json": json_path.name,
                "url": f"/reports/{html_path.name}",
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/status")
def api_status():
    return jsonify(
        {
            "auth_ok": _auth_ok(),
            "property_url": GSC_PROPERTY_URL,
            "has_latest": (REPORTS_DIR / "latest.html").is_file(),
            "reports": list_reports()[:10],
        }
    )


def run_server():
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"GSC週次レポート: http://{GSC_SERVER_HOST}:{GSC_SERVER_PORT}/")
    app.run(host=GSC_SERVER_HOST, port=GSC_SERVER_PORT, debug=False)

#!/usr/bin/env python3
"""GSC latest.json から改善施策 HTML レポートを生成."""

from __future__ import annotations

import html as html_lib
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "research/output/gsc-weekly/data/latest.json"
REPORTS_DIR = ROOT / "research/reports"


def esc(value: object) -> str:
    return html_lib.escape(str(value))


def ctr_pct(row: dict) -> float:
    ctr = row.get("ctr", 0)
    return ctr * 100 if ctr <= 1 else float(ctr)


def path_from_url(url: str) -> str:
    path = urlparse(url).path or "/"
    return path if path != "/" else "/（トップ）"


def load_data() -> dict:
    if not DATA_PATH.is_file():
        raise FileNotFoundError(
            f"{DATA_PATH} がありません。先に `python -m gsc_weekly generate` を実行してください。"
        )
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def low_ctr_queries(data: dict, min_impr: int = 80, max_pos: float = 10.0, max_ctr: float = 3.0) -> list[dict]:
    rows = []
    for q in data.get("top_queries_latest_week", []):
        impr = int(q.get("impressions", 0))
        pos = float(q.get("position", 99))
        ctr = ctr_pct(q)
        if impr >= min_impr and pos <= max_pos and ctr < max_ctr:
            rows.append({**q, "ctr_pct": round(ctr, 2)})
    rows.sort(key=lambda r: r.get("impressions", 0), reverse=True)
    return rows


def near_page_one(data: dict, min_impr: int = 50) -> list[dict]:
    rows = []
    for p in data.get("top_pages_latest_week", []):
        pos = float(p.get("position", 99))
        impr = int(p.get("impressions", 0))
        if 7 <= pos <= 12 and impr >= min_impr:
            rows.append(
                {
                    "page": p.get("page", ""),
                    "path": path_from_url(p.get("page", "")),
                    "clicks": int(p.get("clicks", 0)),
                    "impressions": impr,
                    "ctr_pct": round(ctr_pct(p), 2),
                    "position": round(pos, 2),
                }
            )
    rows.sort(key=lambda r: r["impressions"], reverse=True)
    return rows


def priority_label(priority: str) -> tuple[str, str]:
    if priority == "high":
        return "最優先", "p-high"
    if priority == "mid":
        return "重要", "p-mid"
    return "推奨", "p-low"


def render(data: dict) -> str:
    summary = data.get("summary", {})
    period = data.get("period", {})
    latest_week = period.get("latest_week", {})
    weekly = data.get("weekly", [])
    latest_w = weekly[-2] if len(weekly) >= 2 else (weekly[-1] if weekly else {})
    recommendations = data.get("recommendations", [])
    page_actions = data.get("page_actions", [])
    low_ctr = low_ctr_queries(data)
    near_one = near_page_one(data)
    gainers = data.get("query_movers", {}).get("gainers", [])[:8]
    losers = data.get("query_movers", {}).get("losers", [])[:8]

    rec_html = []
    for rec in recommendations:
        label, cls = priority_label(rec.get("priority", "low"))
        rec_html.append(
            f"""
            <li class="action-item {cls}">
              <span class="priority {cls}">{esc(label)}</span>
              <strong>{esc(rec.get("title", ""))}</strong>
              <p>{esc(rec.get("body", ""))}</p>
              {f'<div class="evidence">根拠: {esc(rec["evidence"])}</div>' if rec.get("evidence") else ""}
            </li>"""
        )

    page_html = []
    for i, pa in enumerate(page_actions, 1):
        issues = "".join(f'<span class="issue-tag">{esc(issue)}</span>' for issue in pa.get("issues", []))
        actions = "".join(f"<li>{esc(a)}</li>" for a in pa.get("actions", []))
        delta = pa.get("delta")
        delta_html = f'<span class="down">前週比 {delta} クリック</span>' if delta is not None else ""
        page_html.append(
            f"""
            <article class="page-card">
              <div class="page-head">
                <span class="rank">{i}</span>
                <div>
                  <h3><a href="{esc(pa.get("page", ""))}" target="_blank" rel="noopener">{esc(pa.get("path", ""))}</a></h3>
                  <div class="metrics">
                    <span>クリック <strong>{pa.get("clicks", 0)}</strong></span>
                    <span>表示 <strong>{pa.get("impressions", 0):,}</strong></span>
                    <span>CTR <strong>{pa.get("ctr", 0)}%</strong></span>
                    <span>順位 <strong>{pa.get("position", 0)}</strong></span>
                    {delta_html}
                  </div>
                </div>
              </div>
              <p class="queries">主要クエリ: {esc(pa.get("top_queries", "—"))}</p>
              <div class="issues">{issues}</div>
              <ol class="todo">{actions}</ol>
            </article>"""
        )

    low_ctr_rows = "".join(
        f"""<tr>
          <td>{esc(q.get("query", ""))}</td>
          <td class="num">{q.get("clicks", 0)}</td>
          <td class="num">{q.get("impressions", 0):,}</td>
          <td class="num warn">{q.get("ctr_pct", 0)}%</td>
          <td class="num">{round(float(q.get("position", 0)), 1)}</td>
        </tr>"""
        for q in low_ctr[:15]
    ) or '<tr><td colspan="5">該当なし</td></tr>'

    near_rows = "".join(
        f"""<tr>
          <td><a href="{esc(r["page"])}" target="_blank" rel="noopener">{esc(r["path"])}</a></td>
          <td class="num">{r["clicks"]}</td>
          <td class="num">{r["impressions"]:,}</td>
          <td class="num">{r["ctr_pct"]}%</td>
          <td class="num warn">{r["position"]}</td>
        </tr>"""
        for r in near_one[:15]
    ) or '<tr><td colspan="5">該当なし</td></tr>'

    gainer_rows = "".join(
        f'<tr><td>{esc(r.get("query", ""))}</td><td class="num">{r.get("clicks", 0)}</td><td class="num up">+{r.get("delta", 0)}</td></tr>'
        for r in gainers
    ) or '<tr><td colspan="3">—</td></tr>'

    loser_rows = "".join(
        f'<tr><td>{esc(r.get("query", ""))}</td><td class="num">{r.get("clicks", 0)}</td><td class="num down">{r.get("delta", 0)}</td></tr>'
        for r in losers
    ) or '<tr><td colspan="3">—</td></tr>'

    wow_clicks = latest_w.get("wow_clicks")
    wow_impr = latest_w.get("wow_impressions")
    wow_pos = latest_w.get("wow_position")

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>First Books GSC 改善施策 — {esc(latest_week.get("label", ""))}</title>
  <style>
    :root {{
      --bg: #0f1419; --surface: #1a2332; --surface2: #243044; --border: #2d3f56;
      --text: #e8edf4; --muted: #8b9cb3; --accent: #4f9cf9; --accent2: #34d399;
      --warn: #fbbf24; --danger: #f87171;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: "Hiragino Sans", "Noto Sans JP", sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; padding: 2rem 1rem 4rem; }}
    .container {{ max-width: 1080px; margin: 0 auto; }}
    header {{ background: linear-gradient(135deg, #1a2332, #243044); border: 1px solid var(--border); border-radius: 16px; padding: 2rem; margin-bottom: 1.5rem; }}
    header h1 {{ font-size: 1.7rem; margin-bottom: 0.5rem; }}
    .meta {{ color: var(--muted); font-size: 0.9rem; }}
    .meta span {{ margin-right: 1rem; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }}
    .card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; }}
    .card .label {{ color: var(--muted); font-size: 0.85rem; }}
    .card .value {{ font-size: 1.5rem; font-weight: 700; margin-top: 0.2rem; }}
    .card .sub {{ color: var(--muted); font-size: 0.8rem; margin-top: 0.2rem; }}
    section {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem; }}
    section h2 {{ font-size: 1.15rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }}
    .lead {{ color: var(--muted); font-size: 0.92rem; margin-bottom: 1rem; }}
    .action-list {{ list-style: none; }}
    .action-item {{ background: var(--surface2); border-left: 4px solid var(--accent); padding: 1rem 1.2rem; margin-bottom: 0.8rem; border-radius: 0 10px 10px 0; }}
    .action-item.p-high {{ border-left-color: var(--danger); }}
    .action-item.p-mid {{ border-left-color: var(--warn); }}
    .action-item strong {{ display: block; margin-bottom: 0.35rem; }}
    .action-item p {{ color: #c8d4e3; }}
    .evidence {{ font-size: 0.82rem; color: var(--muted); margin-top: 0.4rem; }}
    .priority {{ display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; margin-bottom: 0.4rem; }}
    .p-high {{ background: #7f1d1d; color: #fca5a5; }}
    .p-mid {{ background: #78350f; color: #fde68a; }}
    .p-low {{ background: #1e3a5f; color: #93c5fd; }}
    .page-card {{ background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem; }}
    .page-head {{ display: flex; gap: 0.8rem; align-items: flex-start; }}
    .rank {{ flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; display: grid; place-items: center; }}
    .page-head h3 {{ font-size: 1rem; margin-bottom: 0.35rem; }}
    .page-head a {{ color: var(--text); text-decoration: none; }}
    .page-head a:hover {{ color: var(--accent); }}
    .metrics {{ display: flex; flex-wrap: wrap; gap: 0.8rem; font-size: 0.82rem; color: var(--muted); }}
    .metrics strong {{ color: var(--text); }}
    .queries {{ font-size: 0.84rem; color: var(--muted); margin: 0.7rem 0; }}
    .issues {{ display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.6rem; }}
    .issue-tag {{ font-size: 0.76rem; background: #78350f55; color: #fde68a; border: 1px solid #78350f; border-radius: 4px; padding: 0.1rem 0.45rem; }}
    .todo {{ padding-left: 1.2rem; }}
    .todo li {{ margin-bottom: 0.3rem; color: #c8d4e3; font-size: 0.9rem; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 0.88rem; }}
    th, td {{ padding: 0.55rem 0.6rem; border-bottom: 1px solid var(--border); text-align: left; }}
    th {{ color: var(--muted); font-size: 0.78rem; }}
    .num {{ text-align: right; font-variant-numeric: tabular-nums; }}
    .up {{ color: var(--accent2); }}
    .down {{ color: var(--danger); }}
    .warn {{ color: var(--warn); }}
    .two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }}
    footer {{ text-align: center; color: var(--muted); font-size: 0.8rem; margin-top: 2rem; }}
    @media (max-width: 768px) {{ .two-col {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>First Books — GSC 改善施策レポート</h1>
    <div class="meta">
      <span>対象週: {esc(latest_week.get("label", ""))}</span>
      <span>生成: {esc(data.get("generated_at", ""))}</span>
      <span>{esc(data.get("property_url", ""))}</span>
    </div>
  </header>

  <div class="grid">
    <div class="card"><div class="label">12週間クリック</div><div class="value">{summary.get("clicks", 0):,}</div></div>
    <div class="card"><div class="label">12週間表示</div><div class="value">{summary.get("impressions", 0):,}</div></div>
    <div class="card"><div class="label">平均CTR</div><div class="value">{summary.get("ctr", 0)}%</div></div>
    <div class="card"><div class="label">平均順位</div><div class="value">{summary.get("position", 0)}</div></div>
    <div class="card">
      <div class="label">直近週クリック</div>
      <div class="value">{latest_w.get("clicks", 0):,}</div>
      <div class="sub">{f'前週比 {wow_clicks:+.1f}%' if wow_clicks is not None else ''}</div>
    </div>
    <div class="card">
      <div class="label">直近週順位</div>
      <div class="value">{latest_w.get("position", 0)}</div>
      <div class="sub">{f'前週比 {wow_pos:+.2f}' if wow_pos is not None else ''}</div>
    </div>
  </div>

  <section>
    <h2>サイト全体の改善施策（{len(recommendations)}件）</h2>
    <p class="lead">直近完了週のGSCデータから自動抽出。最優先から着手してください。</p>
    <ul class="action-list">{"".join(rec_html)}</ul>
  </section>

  <section>
    <h2>記事別の改善候補（{len(page_actions)}件）</h2>
    <p class="lead">改善インパクトが大きい順。各記事の具体的なToDoを記載しています。</p>
    {"".join(page_html)}
  </section>

  <section>
    <h2>低CTR × 高表示クエリ</h2>
    <p class="lead">順位10位以内・表示80以上・CTR3%未満。タイトル・メタ改善の候補です。</p>
    <table>
      <thead><tr><th>クエリ</th><th class="num">クリック</th><th class="num">表示</th><th class="num">CTR</th><th class="num">順位</th></tr></thead>
      <tbody>{low_ctr_rows}</tbody>
    </table>
  </section>

  <section>
    <h2>順位8〜12位のページ（1ページ目手前）</h2>
    <p class="lead">表示50以上。コンテンツ強化・内部リンクで上位化を狙えるページです。</p>
    <table>
      <thead><tr><th>ページ</th><th class="num">クリック</th><th class="num">表示</th><th class="num">CTR</th><th class="num">順位</th></tr></thead>
      <tbody>{near_rows}</tbody>
    </table>
  </section>

  <section>
    <h2>クエリ増減（前週比）</h2>
    <div class="two-col">
      <div>
        <h3 style="font-size:0.95rem;margin-bottom:0.6rem;color:var(--accent2);">クリック増加</h3>
        <table><thead><tr><th>クエリ</th><th class="num">今週</th><th class="num">増減</th></tr></thead><tbody>{gainer_rows}</tbody></table>
      </div>
      <div>
        <h3 style="font-size:0.95rem;margin-bottom:0.6rem;color:var(--danger);">クリック減少</h3>
        <table><thead><tr><th>クエリ</th><th class="num">今週</th><th class="num">増減</th></tr></thead><tbody>{loser_rows}</tbody></table>
      </div>
    </div>
  </section>

  <footer>データソース: research/output/gsc-weekly/data/latest.json</footer>
</div>
</body>
</html>"""


def main() -> int:
    data = load_data()
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d")
    dated_path = REPORTS_DIR / f"gsc-improvement-plan-{stamp}.html"
    latest_path = REPORTS_DIR / "gsc-improvement-plan-latest.html"
    html = render(data)
    dated_path.write_text(html, encoding="utf-8")
    latest_path.write_text(html, encoding="utf-8")
    print(f"HTML: {dated_path}")
    print(f"HTML: {latest_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""GSC週次データから改善施策案をルールベースで生成（First Books 向け）."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

PRIORITY_ORDER = {"high": 0, "mid": 1, "low": 2}

BOOK_INTENT_KEYWORDS = (
    "おすすめ",
    "ランキング",
    "小説",
    "漫画",
    "本",
    "読みたい",
    "名作",
    "ベスト",
)
GENRE_KEYWORDS = (
    "ミステリー",
    "恋愛",
    "SF",
    "ファンタジー",
    "ホラー",
    "ノンフィクション",
    "文学",
    "推理",
)
AWARD_KEYWORDS = ("直木賞", "芥川賞", "本屋大賞", "文学賞", "受賞")


def _add(
    items: list[dict[str, str]],
    *,
    priority: str,
    title: str,
    body: str,
    evidence: str = "",
) -> None:
    items.append(
        {
            "priority": priority,
            "title": title,
            "body": body,
            "evidence": evidence,
        }
    )


def _path_from_url(url: str) -> str:
    path = urlparse(url).path or "/"
    return path if path != "/" else "/（トップ）"


def _ctr_pct(row: dict[str, Any]) -> float:
    ctr = row.get("ctr", 0)
    return ctr * 100 if ctr <= 1 else float(ctr)


def _find_latest_week_row(data: dict[str, Any]) -> dict[str, Any] | None:
    weekly = data.get("weekly", [])
    latest = data.get("period", {}).get("latest_week", {})
    start = latest.get("start")
    if start:
        for w in weekly:
            if w.get("week_start") == start:
                return w
    return weekly[-2] if len(weekly) >= 2 else (weekly[-1] if weekly else None)


def generate_recommendations(data: dict[str, Any]) -> list[dict[str, str]]:
    """改善施策リスト（優先度順）."""
    items: list[dict[str, str]] = []
    weekly = data.get("weekly", [])
    latest_w = _find_latest_week_row(data)
    queries = data.get("top_queries_latest_week", [])
    pages = data.get("top_pages_latest_week", [])
    q_movers = data.get("query_movers", {})
    p_movers = data.get("page_movers", {})

    if latest_w:
        wow_pos = latest_w.get("wow_position")
        wow_ctr = latest_w.get("wow_ctr")
        wow_impr = latest_w.get("wow_impressions")
        wow_clicks = latest_w.get("wow_clicks")
        label = latest_w.get("week_label", "直近週")

        if wow_pos is not None and wow_pos > 0.15:
            _add(
                items,
                priority="high",
                title="掲載順位の悪化トレンドへの対応",
                body=(
                    "直近完了週は平均順位が前週より下落しています。"
                    "人気作家・文学賞記事の情報更新、内部リンクの見直し、"
                    "競合の新規記事を確認してください。"
                ),
                evidence=f"{label}: 順位 {latest_w['position']}（前週比 +{wow_pos}）",
            )

        if (
            wow_ctr is not None
            and wow_ctr < -10
            and wow_impr is not None
            and wow_impr > 5
        ):
            _add(
                items,
                priority="high",
                title="表示増・CTR低下 — スニペット改善が最優先",
                body=(
                    "検索結果には表示されているがクリックされていません。"
                    "タイトル・メタディスクリプションに「おすすめ」「ランキング」「作家名」"
                    "など検索意図に合う語を入れ、CTRを改善してください。"
                ),
                evidence=f"{label}: 表示 {wow_impr:+.1f}% / CTR {wow_ctr:+.1f}%",
            )

        if wow_clicks is not None and wow_clicks < -15:
            _add(
                items,
                priority="mid",
                title="クリック減少の要因調査",
                body=(
                    "前週比でクリックが大きく減少しています。"
                    "減少クエリ・ページ（本レポートの増減表）を確認し、"
                    "順位下落かCTR低下かを切り分けて対策してください。"
                ),
                evidence=f"{label}: クリック {wow_clicks:+.1f}%",
            )

    if len(weekly) >= 8:
        early = weekly[:4]
        late = weekly[-4:]
        early_pos = sum(w["position"] for w in early) / len(early)
        late_pos = sum(w["position"] for w in late) / len(late)
        if late_pos - early_pos > 0.25:
            _add(
                items,
                priority="mid",
                title="中期的な順位悪化（12週トレンド）",
                body=(
                    "直近4週の平均順位が、期間前半より悪化しています。"
                    "テンプレート記事の独自性強化や、"
                    "更新頻度・内部リンクの見直しを検討してください。"
                ),
                evidence=f"前半平均順位 {early_pos:.2f} → 直近4週 {late_pos:.2f}",
            )

    ctr_ops = [
        q
        for q in queries
        if q.get("impressions", 0) >= 100
        and q.get("position", 99) <= 8
        and _ctr_pct(q) < 2.0
    ]
    ctr_ops.sort(key=lambda q: q.get("impressions", 0), reverse=True)
    if ctr_ops:
        examples = "、".join(
            f"「{q['query']}」（表示{q['impressions']:,}・CTR {_ctr_pct(q):.2f}%）"
            for q in ctr_ops[:3]
        )
        _add(
            items,
            priority="high",
            title="低CTR・高表示クエリのタイトル／メタ改善",
            body=(
                f"順位は上位圏にあるのにCTRが低いクエリがあります: {examples}。"
                "検索意図（作家名・ジャンル・おすすめ）に合ったタイトルへ変更し、"
                "ItemList 構造化データの精度も確認してください。"
            ),
            evidence=f"該当 {len(ctr_ops)} クエリ",
        )

    page_ops = [
        p
        for p in pages
        if p.get("impressions", 0) >= 100
        and p.get("position", 99) <= 10
        and _ctr_pct(p) < 2.5
    ]
    page_ops.sort(key=lambda p: p.get("impressions", 0), reverse=True)
    if page_ops:
        paths = "、".join(_path_from_url(p["page"]) for p in page_ops[:3])
        _add(
            items,
            priority="high",
            title="人気ページのCTR改善",
            body=(
                f"表示は多いがCTRが低いページ: {paths}。"
                "リード文の独自性追加、上位作品への短いコメント、"
                "関連作家・ジャンルへの内部リンクでスニペット訴求力を高めてください。"
            ),
            evidence=f"代表CTR {_ctr_pct(page_ops[0]):.2f}%（{page_ops[0]['impressions']:,}表示）",
        )

    page_pos = [p for p in pages if 7 <= p.get("position", 0) <= 12 and p.get("impressions", 0) >= 50]
    if page_pos:
        paths = "、".join(_path_from_url(p["page"]) for p in page_pos[:3])
        _add(
            items,
            priority="mid",
            title="順位8〜12位ページの上位化",
            body=(
                f"1ページ目手前のページがあります: {paths}。"
                "作家の特徴・代表作の読み方を追記し、"
                "関連記事・文学賞ページからの内部リンクを強化してください。"
            ),
            evidence=f"{len(page_pos)} ページが8〜12位帯",
        )

    gainers = q_movers.get("gainers", [])
    if gainers:
        top = gainers[0]
        _add(
            items,
            priority="mid",
            title="伸びているクエリの強化",
            body=(
                f"前週比でクリックが伸びたクエリの筆頭は「{top['query']}」（+{top['delta']}）。"
                "該当記事の情報更新・関連記事への内部リンク増強で"
                "勢いを維持してください。"
            ),
            evidence=f"週間 +{top['delta']} クリック",
        )

    losers = q_movers.get("losers", [])
    if losers:
        top = losers[0]
        _add(
            items,
            priority="mid",
            title="落ちているクエリのリカバリ",
            body=(
                f"前週比でクリックが減ったクエリの筆頭は「{top['query']}」（{top['delta']}）。"
                "順位・CTR・競合記事の変化を確認し、必要なら見出し・内容を刷新してください。"
            ),
            evidence=f"週間 {top['delta']} クリック",
        )

    author_q = [
        q
        for q in queries
        if any(k in q.get("query", "") for k in ("おすすめ", "作品", "本", "小説", "漫画"))
        and q.get("impressions", 0) >= 50
    ]
    if len(author_q) >= 3:
        total_impr = sum(q.get("impressions", 0) for q in author_q)
        _add(
            items,
            priority="mid",
            title="作家・作品系クエリのコンテンツ強化",
            body=(
                "「おすすめ」「作品」系のクエリが多く表示されています。"
                "テンプレート本文の薄さを解消し、作家の特徴・読み始めの作品を"
                "記事ごとに追記すると差別化できます。"
            ),
            evidence=f"関連 {len(author_q)} 語 / 表示約 {total_impr:,}",
        )

    award_q = [q for q in queries if any(k in q.get("query", "") for k in AWARD_KEYWORDS)]
    if award_q:
        _add(
            items,
            priority="low",
            title="文学賞系クエリの取りこぼし確認",
            body=(
                f"文学賞関連クエリが検索されています（例: 「{award_q[0]['query']}」）。"
                "受賞作記事と作家記事の相互リンク、賞ページからの導線を確認してください。"
            ),
            evidence=f"{len(award_q)} 語が今週のTOP25内",
        )

    genre_q = [q for q in queries if any(k in q.get("query", "") for k in GENRE_KEYWORDS)]
    if genre_q:
        _add(
            items,
            priority="low",
            title="ジャンル系クエリの拡充",
            body=(
                f"ジャンル関連クエリがあります（例: 「{genre_q[0]['query']}」）。"
                "ジャンル記事のリード文・代表作コメントを充実させ、"
                "作家別記事との導線を強化してください。"
            ),
            evidence=f"{len(genre_q)} 語が今週のTOP25内",
        )

    p_gain = p_movers.get("gainers", [])
    if p_gain and p_gain[0].get("delta", 0) >= 2:
        p = p_gain[0]
        _add(
            items,
            priority="low",
            title="クリックが伸びたページの横展開",
            body=(
                f"{_path_from_url(p['page'])} が前週比 +{p['delta']} クリック。"
                "同テーマの関連記事・内部リンクで流入をさらに伸ばせます。"
            ),
            evidence=f"+{p['delta']} クリック",
        )

    if not items:
        _add(
            items,
            priority="low",
            title="継続モニタリング",
            body=(
                "大きな異常は検出されませんでした。"
                "週次でCTR・順位・クエリ増減を追い、変化が出た週に重点対策してください。"
            ),
        )

    items.sort(key=lambda x: PRIORITY_ORDER.get(x["priority"], 9))
    return items[:12]


def _top_query_summary(pq: list[dict[str, Any]], n: int = 3) -> str:
    parts = []
    for q in pq[:n]:
        parts.append(
            f"「{q['query']}」(表示{q['impressions']:,}・{q['position']:.1f}位)"
        )
    return "、".join(parts)


def generate_page_actions(data: dict[str, Any]) -> list[dict[str, Any]]:
    """改善優先度の高い記事と、記事ごとの施策候補を生成."""
    pages = data.get("top_pages_latest_week", [])
    page_queries = data.get("page_queries_latest_week", {})
    losers = {
        r["page"]: r for r in data.get("page_movers", {}).get("losers", [])
    }

    candidates: list[dict[str, Any]] = []

    for p in pages:
        url = p.get("page", "")
        if not url or "#" in url:
            continue
        impr = int(p.get("impressions", 0))
        clicks = int(p.get("clicks", 0))
        ctr = _ctr_pct(p)
        pos = float(p.get("position", 0))
        pq = page_queries.get(url, [])
        loser = losers.get(url)

        issues: list[str] = []
        actions: list[str] = []
        score = 0.0

        if impr >= 100 and pos <= 10 and ctr < 2.0:
            potential = int(impr * 0.03) - clicks
            issues.append(f"高表示なのにCTR {ctr:.2f}%（機会損失 週+{max(potential, 0)}クリック相当）")
            actions.append(
                "タイトル・メタディスクリプションを刷新（作家名・「おすすめ」「ランキング」を含める）"
            )
            actions.append("リード文に作家の特徴・読み始めの作品を追記して独自性を高める")
            score += impr * (3.0 - ctr)

        if 7 <= pos <= 12 and impr >= 50:
            issues.append(f"順位{pos:.1f}位 — 1ページ目上位への押し上げ余地")
            actions.append("上位3〜5作品に短いコメントを追加し、検索意図との一致度を上げる")
            actions.append("関連作家・ジャンル・文学賞記事からの内部リンクを増やす")
            score += impr * 0.5

        if loser and loser.get("delta", 0) <= -2:
            issues.append(f"前週比 {loser['delta']} クリックの減少")
            actions.append("順位下落かCTR低下かを切り分け（クエリ別順位を確認）")
            actions.append("競合の新規・更新記事を確認し、情報鮮度で対抗")
            score += abs(loser["delta"]) * 50

        if pos <= 4 and impr >= 100 and ctr < 4.0 and not issues:
            issues.append(f"順位{pos:.1f}位と良好だがCTR {ctr:.2f}%に伸び代")
            actions.append("スニペットに代表作・ランキングの魅力を前出しする")
            score += impr * 0.3

        if not issues:
            continue

        if pq:
            head = pq[0]
            if head.get("position", 0) > 5:
                actions.append(
                    f"主要クエリ「{head['query']}」（{head['position']:.1f}位）に合わせて"
                    "h1・冒頭文の検索意図一致度を高める"
                )
            kw_missing = [
                q["query"] for q in pq if q.get("clicks", 0) == 0 and q.get("impressions", 0) >= 30
            ]
            if kw_missing:
                actions.append(
                    f"表示のみでクリック0のクエリ（例:「{kw_missing[0]}」）向けの見出し・FAQを追加"
                )

        candidates.append(
            {
                "page": url,
                "path": _path_from_url(url),
                "clicks": clicks,
                "impressions": impr,
                "ctr": round(ctr, 2),
                "position": round(pos, 2),
                "delta": loser.get("delta") if loser else None,
                "issues": issues,
                "actions": list(dict.fromkeys(actions)),
                "top_queries": _top_query_summary(pq),
                "score": score,
            }
        )

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:8]

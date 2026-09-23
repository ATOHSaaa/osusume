#!/usr/bin/env python3
"""GSC上位20記事に「特徴」「初めて読むなら」セクションを追記."""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "src/content/articles"
UPDATED = date.today().isoformat()

# slug -> (h2_1_title, section1, section2)
CONTENT: dict[str, tuple[str, str, str]] = {
    "akagawa-jiro-recommended-books": (
        "赤川次郎の作品の特徴",
        "ユーモアとミステリーを融合した作品が多く、三毛猫ホームズシリーズや官能ミステリーで知られるベストセラー作家。軽快な読み味と意外なトリックの両方を楽しめる。",
        "初めてなら『三毛猫ホームズの推理』から入るのが定番。探偵ものが好みならこちら、恋愛ミステリーなら『ふたり』、ホラー寄りなら『幽霊列車』もおすすめ。",
    ),
    "shimamoto-rio-recommended-books": (
        "島本理生の作品の特徴",
        "直木賞作家で、恋愛と痛みを繊細に描く作品が多い。若い世代からも支持され、映画化された『ファーストラヴ』でも知られる。",
        "初めてなら『ファーストラヴ』か『ナラタージュ』から。恋愛小説の入門として読みやすく、島本理生の文体がよくわかる。短編なら『よだかの片想い』も手軽。",
    ),
    "terachi-haruna-recommended-books": (
        "寺地はるなの作品の特徴",
        "家族や日常の温かさと切なさを丁寧に描く作家。本屋大賞受賞作を持ち、まちおこしから恋愛まで幅広いテーマを手がける。",
        "初めてなら『ビオレタ』か『水を縫う』から。物語に自然に入りやすく、寺地はるなの優しい筆致が体感できる。",
    ),
    "nonami-asa-recommended-books": (
        "乃南アサの作品の特徴",
        "サスペンスからヒューマンドラマまで幅広く書く人気作家。女性の人生や社会問題を鋭く描きながら、読みやすい物語に仕上げる。",
        "初めてなら『しゃぼん玉』から。社会派のテーマがありながらも引き込まれる長編で、乃南アサの代表作として知られる。",
    ),
    "chihaya-akane-recommended-books": (
        "千早茜の作品の特徴",
        "ヒューマンドラマやミステリーで評価される作家。日常の不穏さと心理描写が特徴で、静かな余韻が残る作品が多い。",
        "初めてなら『透明な夜の香り』から。千早茜の作風がよくわかる入門作で、短めに読み進めやすい。",
    ),
    "mori-eto-recommended-books": (
        "森絵都の作品の特徴",
        "青春や家族の物語で知られる作家。直木賞・本屋大賞を受賞し、映画化作品も多い。優しくも切ない読後感が魅力。",
        "初めてなら『カラフル』から。短く読みやすく、森絵都の温かいタッチがよくわかる。",
    ),
    "makime-manabu-recommended-books": (
        "万城目学の作品の特徴",
        "京都を舞台にした幻想的な物語で知られる作家。直木賞・本屋大賞を受賞し、ユーモアと不思議さが同居する作品が多い。",
        "初めてなら『鴨川ホルモー』から。京都の雰囲気と奇想天外なストーリーが楽しめ、万城目学の世界に入りやすい。",
    ),
    "yuikawa-kei-recommended-books": (
        "唯川恵の作品の特徴",
        "恋愛小説の名手で、大人の恋や切ない関係を繊細に描く。直木賞受賞の実力派として、幅広い世代に読まれている。",
        "初めてなら『肩ごしの恋人』から。唯川恵の恋愛観がよくわかる代表作で、読みやすい長さも魅力。",
    ),
    "kirino-natsuo-recommended-books": (
        "桐野夏生の作品の特徴",
        "社会派ミステリーの旗手。女性のリアルな生活や社会の闇を、容赦ない描写で描く作品が多い。直木賞・芥川賞を受賞。",
        "初めてなら『東京島』から。桐野夏生の世界観がよくわかる長編で、社会派ミステリーの入門にもなる。",
    ),
    "nishimura-kyotaro-recommended-books": (
        "西村京太郎の作品の特徴",
        "日本のトラベルミステリーの巨匠。鉄道や旅先を舞台に、刑事・十津川警部シリーズで知られる。昭和のミステリー黄金期を代表する作家。",
        "初めてなら『殺しの双曲線』から。十津川警部シリーズの入門として定番で、旅と謎の両方が楽しめる。",
    ),
    "kakine-ryosuke-recommended-books": (
        "垣根涼介の作品の特徴",
        "青春小説やヒューマンドラマで知られる作家。若者の成長や友情を描き、直木賞受賞作『君たちに明日はない』で注目を集めた。",
        "初めてなら『君たちに明日はない』から。垣根涼介の代表作で、青春小説の入門として読みやすい。",
    ),
    "dazai-osamu-winner-42-recommended-books": (
        "こがわゆうじろうの作品の特徴",
        "第42回太宰治賞を受賞した作家。日常の違和感や人間関係の微妙なズレを、静かな筆致で描く作品が多い。",
        "太宰治賞受賞作から入るのがおすすめ。受賞作は作家の個性が凝縮されており、こがわゆうじろうの世界を知る最短ルートになる。",
    ),
    "hayashi-mariko-recommended-books": (
        "林真理子の作品の特徴",
        "女性の人生や社会を描くベストセラー作家。直木賞を受賞し、映画化・ドラマ化作品も多い。読みやすくエンタメ性の高い作品が魅力。",
        "初めてなら『葡萄が目にしみる』から。林真理子の作風がよくわかる代表作で、ヒューマンドラマの入門にもなる。",
    ),
    "himeno-kaoruko-recommended-books": (
        "姫野カオルコの作品の特徴",
        "ユーモアと社会風刺を交えた作品で知られる作家。奇想天外な設定の中に現実の鋭さを忍ばせる作風が特徴。",
        "初めてなら『彼女は頭が悪いから』から。姫野カオルコのユーモアと切れ味がよくわかる入門作。",
    ),
    "nakayama-shichiri-recommended-books": (
        "中山七里の作品の特徴",
        "ミステリー作家で、音楽や人間ドラマを織り込んだ作品が多い。直木賞候補作を持ち、シリーズ作品も人気。",
        "初めてなら『護られなかった者たちへ』から。中山七里のミステリーと人間描写のバランスがよくわかる。",
    ),
    "fujino-chiya-recommended-books": (
        "藤野千夜の作品の特徴",
        "日常の中の恋や人生の機微を描く作家。繊細な心理描写と穏やかな語り口が特徴で、静かに心に残る作品が多い。",
        "初めてなら『団地のふたり』から。藤野千夜の優しい作風がよくわかる入門作で、読みやすい長さも魅力。",
    ),
    "aosaki-argo-recommended-books": (
        "青崎有吾の作品の特徴",
        "本格ミステリーの新星。論理的なトリックと軽快な文体が特徴で、直木賞候補作『体育館の殺人』で注目を集めた。",
        "初めてなら『体育館の殺人』から。裏染天馬シリーズの入門として定番で、本格ミステリーの楽しさがよくわかる。",
    ),
    "miyao-tomiko-recommended-books": (
        "宮尾登美子の作品の特徴",
        "歴史小説や時代小説の名手。女性の人生を壮大なスケールで描き、直木賞を複数回受賞した実力派作家。",
        "初めてなら『鬼龍院花子の生涯』から。宮尾登美子の代表作で、時代小説の入門としても読みやすい。",
    ),
    "shishosetsu-recommended-books": (
        "私小説の特徴",
        "作者自身の体験や内面を素材にした小説ジャンル。太宰治や島崎藤村などの作品が代表例で、「私」と「小説」の境界が曖昧なのが特徴。",
        "初めてなら夏目漱石の『こころ』か、太宰治の短編から。短く読みやすい作品で私小説の雰囲気をつかむのがおすすめ。",
    ),
    "dark-fantasy-recommended-books": (
        "ダークファンタジーの特徴",
        "暗い世界観や残酷な設定を持つファンタジー小説。異世界転生やゲーム世界を舞台に、生と死・善悪の境界が曖昧な物語が多い。",
        "初めてなら『オーバーロード』から。ダークファンタジーの定番で、世界観の広がりとキャラクターの魅力がよくわかる。",
    ),
}


def build_body(h2_title: str, section1: str, section2: str, original: str) -> str:
    return f"""## {h2_title}

{section1}

## 初めて読むなら

{section2}

{original}"""


def update_article(slug: str, h2_title: str, section1: str, section2: str) -> None:
    path = ARTICLES / f"{slug}.mdx"
    text = path.read_text(encoding="utf-8")
    parts = text.split("---\n", 2)
    if len(parts) != 3:
        raise ValueError(f"Invalid MDX frontmatter: {path}")

    fm, original_body = parts[1], parts[2].strip()

    if "## 初めて読むなら" in original_body:
        print(f"skip (already updated): {slug}")
        return

    if "updated_at:" in fm:
        fm = re.sub(r'^updated_at: ".*"$', f'updated_at: "{UPDATED}"', fm, count=1, flags=re.M)
    else:
        fm = fm.rstrip() + f'\nupdated_at: "{UPDATED}"\n'

    new_body = build_body(h2_title, section1, section2, original_body)
    path.write_text(f"---\n{fm}---\n\n{new_body}\n", encoding="utf-8")
    print(f"updated: {slug}")


def main() -> None:
    for slug, (h2, s1, s2) in CONTENT.items():
        update_article(slug, h2, s1, s2)


if __name__ == "__main__":
    main()

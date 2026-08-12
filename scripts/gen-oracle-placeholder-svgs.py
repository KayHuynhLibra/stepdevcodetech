"""Generate simple placeholder SVGs for Lenormand + Tea decks."""
from pathlib import Path

LEN = [
    "rider", "clover", "ship", "house", "tree", "clouds", "snake", "coffin",
    "bouquet", "scythe", "whip", "birds", "child", "fox", "bear", "stars",
    "stork", "dog", "tower", "garden", "mountain", "crossroad", "mice", "heart",
    "ring", "book", "letter", "man", "woman", "lily", "sun", "moon", "key",
    "fish", "anchor", "cross",
]
TEA = [
    "tea_ring", "tea_bird", "tea_tree", "tea_heart", "tea_path", "tea_mountain",
    "tea_coin", "tea_house", "tea_snake", "tea_star", "tea_anchor", "tea_cloud",
]

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360" role="img">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{hue}"/>
      <stop offset="100%" stop-color="#0b0614"/>
    </linearGradient>
  </defs>
  <rect width="240" height="360" rx="18" fill="url(#g)"/>
  <rect x="14" y="14" width="212" height="332" rx="12" fill="none" stroke="#e8d7ff" stroke-opacity="0.45" stroke-width="2"/>
  <circle cx="120" cy="140" r="46" fill="#e8d7ff" fill-opacity="0.12" stroke="#e8d7ff" stroke-opacity="0.55"/>
  <text x="120" y="148" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#f4ecff">{num}</text>
  <text x="120" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#f4ecff">{label}</text>
</svg>
"""


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "client" / "public" / "assets" / "oracle"
    for folder, keys, hue in (
        ("lenormand", LEN, "#3d2a5c"),
        ("tea", TEA, "#1f4d4a"),
    ):
        dest = root / folder
        dest.mkdir(parents=True, exist_ok=True)
        for i, key in enumerate(keys, start=1):
            label = key.replace("tea_", "").replace("_", " ")[:12].title()
            (dest / f"{key}.svg").write_text(
                SVG.format(hue=hue, num=i, label=label),
                encoding="utf-8",
            )
        print(folder, len(list(dest.glob("*.svg"))))


if __name__ == "__main__":
    main()

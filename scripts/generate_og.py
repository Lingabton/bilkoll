#!/usr/bin/env python3
"""Generate OG images (1200×630) for each car model with the wow-number."""

import json
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow not installed — skipping OG image generation")
    print("Install with: pip install pillow")
    exit(0)

DATA_DIR = Path(__file__).parent.parent / "data"
OG_DIR = Path(__file__).parent.parent / "docs" / "og"
OG_DIR.mkdir(parents=True, exist_ok=True)

# Colors
BG_DARK = (15, 23, 42)       # #0f172a
BG_GRADIENT = (30, 41, 59)   # #1e293b
WHITE = (255, 255, 255)
MUTED = (148, 163, 184)      # #94a3b8
GREEN = (5, 150, 105)        # #059669
ACCENT = (56, 189, 248)      # #38bdf8


def fmt(n):
    return f"{int(n):,}".replace(",", " ")


def get_font(size, bold=False):
    """Try to load a clean sans-serif font, fall back to default."""
    font_paths = [
        # macOS
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/Library/Fonts/Arial.ttf",
        # Linux (GitHub Actions)
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in font_paths:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def draw_gradient_bg(img):
    """Draw a subtle diagonal gradient background."""
    draw = ImageDraw.Draw(img)
    w, h = img.size
    for y in range(h):
        r = int(BG_DARK[0] + (BG_GRADIENT[0] - BG_DARK[0]) * y / h)
        g = int(BG_DARK[1] + (BG_GRADIENT[1] - BG_DARK[1]) * y / h)
        b = int(BG_DARK[2] + (BG_GRADIENT[2] - BG_DARK[2]) * y / h)
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    return draw


def generate_og(car):
    """Generate a single OG image for a car model."""
    img = Image.new("RGB", (1200, 630))
    draw = draw_gradient_bg(img)

    name = f"{car['make']} {car['model']}"
    variant = car.get("variant", "")
    monthly = fmt(car.get("monthly_cost", 0))
    cost_per_mil = car.get("cost_per_mil", 0)
    total = fmt(car.get("total_4yr", 0))
    fuel_labels = {"el": "Elbil", "hybrid": "Hybrid", "bensin": "Bensin"}
    fuel = fuel_labels.get(car.get("fuel", ""), "")

    font_big = get_font(96, bold=True)
    font_name = get_font(42, bold=True)
    font_sub = get_font(24)
    font_small = get_font(20)
    font_brand = get_font(28, bold=True)

    # Accent line at top
    draw.rectangle([(0, 0), (1200, 5)], fill=ACCENT)

    # Brand
    draw.text((80, 50), "BILKOLL", font=font_brand, fill=ACCENT)

    # Car name
    draw.text((80, 120), name, font=font_name, fill=WHITE)
    if variant:
        draw.text((80, 175), f"{variant} · {fuel}", font=font_sub, fill=MUTED)

    # Big monthly cost number
    draw.text((80, 260), f"{monthly}", font=font_big, fill=WHITE)
    # Unit
    kr_x = 80 + draw.textlength(f"{monthly}", font=font_big) + 12
    draw.text((kr_x, 310), "kr/mån", font=font_sub, fill=MUTED)

    # Secondary stats
    draw.text((80, 400), f"{cost_per_mil} kr/mil  ·  {total} kr totalt  ·  4 år, 1 500 mil/år", font=font_small, fill=MUTED)

    # Tagline
    draw.text((80, 470), "Verklig ägandekostnad baserad på", font=font_small, fill=MUTED)
    draw.text((80, 500), "tusentals begagnatpriser", font=font_small, fill=MUTED)

    # Bottom accent
    draw.rectangle([(0, 620), (1200, 630)], fill=ACCENT)

    # URL
    draw.text((80, 570), "lingabton.github.io/bilkoll", font=font_small, fill=(100, 116, 139))

    slug = car.get("slug", car["id"])
    img.save(OG_DIR / f"{slug}.png", "PNG")
    return slug


def generate_default():
    """Generate a default OG image for the main page."""
    img = Image.new("RGB", (1200, 630))
    draw = draw_gradient_bg(img)

    font_big = get_font(64, bold=True)
    font_sub = get_font(28)
    font_small = get_font(20)
    font_brand = get_font(28, bold=True)

    draw.rectangle([(0, 0), (1200, 5)], fill=ACCENT)
    draw.text((80, 50), "BILKOLL", font=font_brand, fill=ACCENT)
    draw.text((80, 160), "Vad kostar bilen", font=font_big, fill=WHITE)
    draw.text((80, 240), "egentligen?", font=font_big, fill=WHITE)
    draw.text((80, 350), "Verklig ägandekostnad för 23+ bilmodeller", font=font_sub, fill=MUTED)
    draw.text((80, 400), "Baserat på tusentals begagnatpriser från AutoUncle", font=font_small, fill=MUTED)
    draw.rectangle([(0, 620), (1200, 630)], fill=ACCENT)
    draw.text((80, 570), "lingabton.github.io/bilkoll", font=font_small, fill=(100, 116, 139))

    img.save(OG_DIR / "default.png", "PNG")


def main():
    summary = json.load(open(DATA_DIR / "tco_summary.json"))
    models = json.load(open(DATA_DIR / "models.json"))

    # Merge model details into summary
    model_map = {m["id"]: m for m in models}
    for car in summary:
        model = model_map.get(car["id"], {})
        car.setdefault("variant", model.get("variant", ""))
        car.setdefault("make", model.get("make", ""))
        car.setdefault("model", model.get("model", ""))

    print(f"Generating OG images for {len(summary)} models")

    generate_default()
    for car in summary:
        slug = generate_og(car)
        print(f"  {slug}.png")

    print(f"\n  {len(summary) + 1} OG images saved to {OG_DIR}")


if __name__ == "__main__":
    main()

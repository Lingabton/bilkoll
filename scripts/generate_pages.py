#!/usr/bin/env python3
"""Generate static SEO pages for each model and comparison pair."""

import json, os
from itertools import combinations
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
DOCS_DIR = Path(__file__).parent.parent / "docs"

def fmt(n):
    """Format number with Swedish thousand separator."""
    return f"{int(n):,}".replace(",", " ")

def load_data():
    models = json.load(open(DATA_DIR / "models.json"))
    summary = json.load(open(DATA_DIR / "tco_summary.json"))
    tco = {}
    for m in models:
        path = DATA_DIR / "tco" / f"{m['id']}.json"
        if path.exists():
            tco[m['id']] = json.load(open(path))
    # Merge
    merged = []
    for s in summary:
        model = next((m for m in models if m['id'] == s['id']), {})
        t = tco.get(s['id'], {})
        merged.append({**s, **model, 'tco': t})
    return merged

def model_page(car):
    monthly = car.get('monthly_cost', 0)
    total = car.get('total_4yr', 0)
    name = f"{car['make']} {car['model']} {car.get('variant', '')}"
    slug = car.get('slug', car['id'])
    confidence = car.get('confidence', 'low')
    tco = car.get('tco', {})
    breakdown = tco.get('result', {}).get('breakdown', {})

    title = f"{car['make']} {car['model']} ägandekostnad 2026 — {fmt(monthly)} kr/mån | Bilkoll".replace(',', ' ')
    desc = f"Vad kostar en {car['make']} {car['model']} egentligen? {fmt(monthly)} kr/mån baserat på verkliga begagnatpriser. Värdeminskning, drivmedel, skatt, försäkring.".replace(',', ' ')

    rows = ""
    for label, key in [("Värdeminskning", "depreciation"), ("Drivmedel", "fuel"), ("Skatt", "tax"), ("Försäkring", "insurance"), ("Service", "service"), ("Däck", "tires")]:
        val = breakdown.get(key, 0)
        if isinstance(val, dict):
            val = val.get('estimate', 0)
        if val:
            rows += f'<tr><td style="padding:8px 0;color:#475569">{label}</td><td style="padding:8px 0;text-align:right;font-family:monospace;color:#0f172a">{fmt(val)} kr</td></tr>\n'.replace(',', ' ')

    return f'''<!doctype html>
<html lang="sv">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://bilkoll.se/bil/{slug}/">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://bilkoll.se/bil/{slug}/">
<meta property="og:type" content="article">
<meta property="og:locale" content="sv_SE">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"Product","name":"{name}","category":"Vehicle","offers":{{"@type":"Offer","price":"{car.get('newPrice',0)}","priceCurrency":"SEK"}}}}
</script>
</head>
<body style="margin:0;background:#fafaf9;font-family:'Inter',sans-serif;color:#0f172a">
<div style="max-width:640px;margin:0 auto;padding:32px 20px 60px">
<a href="/" style="text-decoration:none;display:flex;align-items:center;gap:8px;margin-bottom:32px">
<div style="width:28px;height:28px;border-radius:8px;background:#0f172a;display:flex;align-items:center;justify-content:center">
<span style="color:white;font-weight:900;font-size:10px">BK</span>
</div>
<span style="font-size:14px;font-weight:700;color:#0f172a">Bilkoll</span>
</a>
<h1 style="font-size:32px;font-weight:800;margin:0 0 8px;line-height:1.15">{car['make']} {car['model']}</h1>
<p style="font-size:14px;color:#64748b;margin:0 0 24px">{car.get('variant','')} · {car.get('fuel','').title()} · Nypris {fmt(car.get('newPrice',0))} kr</p>
<div style="padding:32px;border-radius:16px;background:linear-gradient(135deg,#0f172a,#1e293b);margin-bottom:24px">
<div style="font-size:13px;color:#94a3b8;margin-bottom:4px">Månadskostnad</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:56px;font-weight:900;color:white;line-height:1">{fmt(monthly)} <span style="font-size:18px;color:#94a3b8;font-weight:500">kr/mån</span></div>
<div style="font-size:13px;color:#64748b;margin-top:8px">{car.get('cost_per_mil',0)} kr/mil · {fmt(total)} kr totalt (4 år, 1 500 mil/år)</div>
</div>
<div style="padding:24px;border-radius:16px;background:white;border:1px solid #e2e8f0;margin-bottom:24px">
<h2 style="font-size:14px;font-weight:700;margin:0 0 16px">Kostnadsfördelning (4 år)</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">{rows}
<tr style="border-top:1px solid #e2e8f0"><td style="padding:12px 0;font-weight:700">Totalt</td><td style="padding:12px 0;text-align:right;font-family:monospace;font-weight:700;font-size:16px">{fmt(total)} kr</td></tr>
</table>
</div>
<p style="font-size:12px;color:#94a3b8">Beräknat med 4 års ägande, 1 500 mil/år. Nybilspriser från Skatteverket SKVFS 2025:29. Begagnatpriser från AutoUncle.</p>
<div style="margin-top:24px;text-align:center">
<a href="/" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#0f172a;color:white;text-decoration:none;font-size:14px;font-weight:600">Jämför alla bilar →</a>
</div>
</div>
</body>
</html>'''

def compare_page(a, b):
    name_a = f"{a['make']} {a['model']}"
    name_b = f"{b['make']} {b['model']}"
    diff = abs(a.get('monthly_cost', 0) - b.get('monthly_cost', 0))
    cheaper = name_a if a.get('monthly_cost', 0) < b.get('monthly_cost', 0) else name_b

    title = f"{name_a} vs {name_b} — ägandekostnad jämförelse | Bilkoll"
    desc = f"Jämför {name_a} och {name_b}: {cheaper} är {fmt(diff)} kr/mån billigare. Verklig totalkostnad baserat på begagnatpriser.".replace(',', ' ')

    return f'''<!doctype html>
<html lang="sv">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="https://bilkoll.se/jamfor/{a.get('slug','')}-vs-{b.get('slug','')}/">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="https://bilkoll.se/jamfor/{a.get('slug','')}-vs-{b.get('slug','')}/">
<meta property="og:type" content="article">
<meta property="og:locale" content="sv_SE">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;background:#fafaf9;font-family:'Inter',sans-serif;color:#0f172a">
<div style="max-width:640px;margin:0 auto;padding:32px 20px 60px">
<a href="/" style="text-decoration:none;display:flex;align-items:center;gap:8px;margin-bottom:32px">
<div style="width:28px;height:28px;border-radius:8px;background:#0f172a;display:flex;align-items:center;justify-content:center">
<span style="color:white;font-weight:900;font-size:10px">BK</span>
</div>
<span style="font-size:14px;font-weight:700;color:#0f172a">Bilkoll</span>
</a>
<h1 style="font-size:28px;font-weight:800;margin:0 0 8px;line-height:1.2">{name_a} vs {name_b}</h1>
<p style="font-size:15px;color:#64748b;margin:0 0 24px">Vilken kostar minst att äga?</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
<div style="padding:24px;border-radius:16px;background:white;border:1px solid #e2e8f0;text-align:center">
<div style="font-size:14px;font-weight:700;margin-bottom:8px">{name_a}</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:900;color:{'#059669' if a.get('monthly_cost',0) < b.get('monthly_cost',0) else '#0f172a'}">{fmt(a.get('monthly_cost',0))} kr/mån</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">{a.get('fuel','').title()} · {fmt(a.get('newPrice',0))} kr ny</div>
</div>
<div style="padding:24px;border-radius:16px;background:white;border:1px solid #e2e8f0;text-align:center">
<div style="font-size:14px;font-weight:700;margin-bottom:8px">{name_b}</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:900;color:{'#059669' if b.get('monthly_cost',0) < a.get('monthly_cost',0) else '#0f172a'}">{fmt(b.get('monthly_cost',0))} kr/mån</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">{b.get('fuel','').title()} · {fmt(b.get('newPrice',0))} kr ny</div>
</div>
</div>
<div style="padding:16px 20px;border-radius:12px;background:#ecfdf5;border:1px solid #d1fae5;text-align:center;margin-bottom:24px">
<span style="font-size:14px;font-weight:600;color:#059669">{cheaper} är {fmt(diff)} kr/mån billigare — {fmt(diff*12)} kr/år</span>
</div>
<p style="font-size:12px;color:#94a3b8">Beräknat med 4 års ägande, 1 500 mil/år. Nybilspriser: Skatteverket. Begagnatpriser: AutoUncle.</p>
<div style="margin-top:24px;text-align:center">
<a href="/" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#0f172a;color:white;text-decoration:none;font-size:14px;font-weight:600">Se alla modeller →</a>
</div>
</div>
</body>
</html>'''


def main():
    cars = load_data()
    print(f"Generating pages for {len(cars)} models")

    # Model pages
    for car in cars:
        slug = car.get('slug', car['id'])
        dir_path = DOCS_DIR / "bil" / slug
        dir_path.mkdir(parents=True, exist_ok=True)
        html = model_page(car)
        (dir_path / "index.html").write_text(html, encoding='utf-8')
        print(f"  /bil/{slug}/")

    # Comparison pages (all pairs)
    pairs = list(combinations(cars, 2))
    print(f"\nGenerating {len(pairs)} comparison pages")
    for a, b in pairs:
        slug = f"{a.get('slug', a['id'])}-vs-{b.get('slug', b['id'])}"
        dir_path = DOCS_DIR / "jamfor" / slug
        dir_path.mkdir(parents=True, exist_ok=True)
        html = compare_page(a, b)
        (dir_path / "index.html").write_text(html, encoding='utf-8')

    # Sitemap
    urls = [("https://bilkoll.se/", "1.0")]
    for car in cars:
        urls.append((f"https://bilkoll.se/bil/{car.get('slug', car['id'])}/", "0.8"))
    for a, b in pairs:
        slug = f"{a.get('slug', a['id'])}-vs-{b.get('slug', b['id'])}"
        urls.append((f"https://bilkoll.se/jamfor/{slug}/", "0.6"))

    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for url, priority in urls:
        sitemap += f'  <url><loc>{url}</loc><priority>{priority}</priority><changefreq>weekly</changefreq></url>\n'
    sitemap += '</urlset>'
    (DOCS_DIR / "sitemap.xml").write_text(sitemap, encoding='utf-8')

    print(f"\nDone: {len(cars)} model pages + {len(pairs)} comparisons + sitemap.xml")
    print(f"Total: {len(urls)} URLs")


if __name__ == "__main__":
    main()

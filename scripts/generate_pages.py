#!/usr/bin/env python3
"""
Bilkoll SEO Page Generator — generates 300+ static pages targeting
every major Swedish car cost search query pattern.
"""

import json, os, math
from itertools import combinations
from pathlib import Path
from datetime import datetime

DATA_DIR = Path(__file__).parent.parent / "data"
DOCS_DIR = Path(__file__).parent.parent / "docs"
NOW = datetime.now().strftime("%Y-%m-%d")
MONTH_SV = ["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"]
CURRENT_MONTH = MONTH_SV[datetime.now().month - 1]
CURRENT_YEAR = datetime.now().year

def fmt(n):
    return f"{int(n):,}".replace(",", " ")

def load_data():
    models = json.load(open(DATA_DIR / "models.json"))
    summary = json.load(open(DATA_DIR / "tco_summary.json"))
    tco = {}
    for m in models:
        path = DATA_DIR / "tco" / f"{m['id']}.json"
        if path.exists():
            tco[m['id']] = json.load(open(path))
    merged = []
    for s in summary:
        model = next((m for m in models if m['id'] == s['id']), {})
        t = tco.get(s['id'], {})
        merged.append({**s, **model, 'tco': t})
    return sorted(merged, key=lambda x: x.get('monthly_cost', 99999))

# ═══════════════════════════════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════════════════════════════

def head(title, desc, canonical, extra_schema=""):
    return f'''<!doctype html>
<html lang="sv">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="article">
<meta property="og:locale" content="sv_SE">
<meta property="og:site_name" content="Bilkoll">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
{extra_schema}
</head>'''

def nav():
    return '''<a href="/" style="text-decoration:none;display:flex;align-items:center;gap:8px;margin-bottom:32px">
<div style="width:28px;height:28px;border-radius:8px;background:#0f172a;display:flex;align-items:center;justify-content:center">
<span style="color:white;font-weight:900;font-size:10px">BK</span></div>
<span style="font-size:14px;font-weight:700;color:#0f172a">Bilkoll</span></a>'''

def breadcrumbs_html(crumbs):
    parts = []
    for i, (label, url) in enumerate(crumbs):
        if url:
            parts.append(f'<a href="{url}" style="color:#64748b;text-decoration:none">{label}</a>')
        else:
            parts.append(f'<span style="color:#94a3b8">{label}</span>')
        if i < len(crumbs) - 1:
            parts.append('<span style="color:#cbd5e1;margin:0 6px">/</span>')
    return f'<nav style="font-size:12px;margin-bottom:20px">{"".join(parts)}</nav>'

def breadcrumbs_schema(crumbs):
    items = [{"@type":"ListItem","position":i+1,"name":label,"item":url} for i,(label,url) in enumerate(crumbs) if url]
    return json.dumps({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":items})

def faq_schema(faqs):
    items = [{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]
    return json.dumps({"@context":"https://schema.org","@type":"FAQPage","mainEntity":items})

def car_card(car, rank=None):
    fuel_colors = {"el":"#059669","hybrid":"#2563eb","bensin":"#d97706"}
    fuel_names = {"el":"El","hybrid":"Hybrid","bensin":"Bensin"}
    color = fuel_colors.get(car.get('fuel',''),'#64748b')
    badge = f'<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:{color}15;color:{color};border:1px solid {color}30">{fuel_names.get(car.get("fuel",""),"")}</span>'
    rank_html = f'<span style="font-size:12px;font-weight:800;color:#94a3b8;margin-right:8px">{rank}.</span>' if rank else ''
    return f'''<a href="/bil/{car.get('slug',car['id'])}/" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-radius:12px;background:white;border:1px solid #e2e8f0;text-decoration:none;margin-bottom:8px;transition:border-color 0.15s" onmouseover="this.style.borderColor='#94a3b8'" onmouseout="this.style.borderColor='#e2e8f0'">
<div>{rank_html}<strong style="color:#0f172a">{car['make']} {car['model']}</strong> <span style="color:#94a3b8;font-size:12px">{car.get('variant','')}</span><br><span style="font-size:11px">{badge} <span style="color:#94a3b8;margin-left:4px">Nypris {fmt(car.get("newPrice",0))} kr</span></span></div>
<div style="text-align:right"><span style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:#0f172a">{fmt(car.get('monthly_cost',0))}</span> <span style="font-size:11px;color:#94a3b8">kr/mån</span><br><span style="font-size:11px;color:#94a3b8;font-family:monospace">{car.get('cost_per_mil',0)} kr/mil</span></div></a>'''

def internal_links(cars, current_id=None, max_links=6):
    others = [c for c in cars if c['id'] != current_id][:max_links]
    links = [f'<a href="/bil/{c.get("slug",c["id"])}/" style="font-size:13px;color:#2563eb;text-decoration:none">{c["make"]} {c["model"]}</a>' for c in others]
    return ' · '.join(links)

def related_comparisons(car, cars):
    others = [c for c in cars if c['id'] != car['id']][:4]
    links = []
    for o in others:
        slug = f"{car.get('slug',car['id'])}-vs-{o.get('slug',o['id'])}"
        links.append(f'<a href="/jamfor/{slug}/" style="font-size:12px;color:#2563eb;text-decoration:none">{car["make"]} {car["model"]} vs {o["make"]} {o["model"]}</a>')
    return '<br>'.join(links)

def category_links():
    cats = [("Elbilar","/elbilar/"),("Hybrider","/hybrider/"),("Bensinbilar","/bensinbilar/"),("SUV","/suv/"),("Billigaste bilarna","/billigaste/")]
    return ' · '.join(f'<a href="{u}" style="font-size:12px;color:#2563eb;text-decoration:none">{l}</a>' for l,u in cats)

def footer(cars):
    return f'''<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0">
<div style="font-size:11px;color:#94a3b8;margin-bottom:12px">Alla modeller: {internal_links(cars, max_links=20)}</div>
<div style="font-size:11px;color:#94a3b8;margin-bottom:8px">Kategorier: {category_links()}</div>
<div style="margin-top:16px;text-align:center">
<a href="/" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#0f172a;color:white;text-decoration:none;font-size:14px;font-weight:600">Jämför alla bilar →</a>
</div>
<p style="font-size:10px;color:#cbd5e1;text-align:center;margin-top:16px">Bilkoll av Gabriel Linton · Olav Innovation AB · Nybilspriser: Skatteverket SKVFS 2025:29 · Begagnatpriser: AutoUncle · Uppdaterad {CURRENT_MONTH} {CURRENT_YEAR}</p>
</div>'''

def body_wrap(content):
    return f'''<body style="margin:0;background:#fafaf9;font-family:'Inter',sans-serif;color:#0f172a">
<div style="max-width:640px;margin:0 auto;padding:32px 20px 60px">
{nav()}
{content}
</div></body></html>'''

# ═══════════════════════════════════════════════════════════════
# PAGE GENERATORS
# ═══════════════════════════════════════════════════════════════

def model_page(car, cars):
    m = car.get('monthly_cost', 0)
    total = car.get('total_4yr', 0)
    name = f"{car['make']} {car['model']}"
    full_name = f"{name} {car.get('variant', '')}"
    slug = car.get('slug', car['id'])
    tco = car.get('tco', {})
    breakdown = tco.get('result', {}).get('breakdown', {})

    title = f"{name} ägandekostnad {CURRENT_YEAR} — {fmt(m)} kr/mån | Bilkoll"
    desc = f"Vad kostar en {name} egentligen? {fmt(m)} kr/mån i verklig totalkostnad. Värdeminskning, drivmedel, skatt, försäkring — baserat på {tco.get('result',{}).get('depreciation_curve',[{}])[-1:][0].get('data_points',0) if tco.get('result',{}).get('depreciation_curve') else 0}+ begagnade annonser."
    canonical = f"https://lingabton.github.io/bilkoll/bil/{slug}/"

    faqs = [
        (f"Vad kostar en {name} i månaden?", f"En {name} kostar cirka {fmt(m)} kr/mån att äga, inklusive värdeminskning, drivmedel, skatt, försäkring, service och däck. Beräknat på 4 års ägande och 1 500 mil/år."),
        (f"Hur mycket tappar en {name} i värde?", f"Värdeminskningen för en {name} är cirka {fmt(breakdown.get('depreciation',0))} kr över 4 år, baserat på verkliga begagnatpriser."),
        (f"Vilken bil är billigast att äga — {name} eller {cars[0]['make']} {cars[0]['model']}?", f"{cars[0]['make']} {cars[0]['model']} kostar {fmt(cars[0].get('monthly_cost',0))} kr/mån, medan {name} kostar {fmt(m)} kr/mån."),
        (f"Hur mycket kostar fordonsskatten för en {name}?", f"Fordonsskatten för en {name} är {fmt(breakdown.get('tax',0))} kr totalt över 4 år ({fmt(breakdown.get('tax',0)//4)} kr/år)."),
    ]

    rows = ""
    for label, key in [("Värdeminskning","depreciation"),("Drivmedel","fuel"),("Skatt","tax"),("Försäkring","insurance"),("Service","service"),("Däck","tires")]:
        val = breakdown.get(key, 0)
        if isinstance(val, dict): val = val.get('estimate', 0)
        if val:
            per_month = fmt(val // 48)
            rows += f'<tr><td style="padding:8px 0;color:#475569">{label}</td><td style="padding:8px 0;text-align:right;font-family:monospace;color:#94a3b8;font-size:13px">{per_month} kr/mån</td><td style="padding:8px 0;text-align:right;font-family:monospace;color:#0f172a">{fmt(val)} kr</td></tr>\n'

    schema = f'''<script type="application/ld+json">{json.dumps({"@context":"https://schema.org","@type":"Product","name":full_name,"category":"Vehicle","brand":{"@type":"Brand","name":car["make"]},"offers":{"@type":"Offer","price":str(car.get("newPrice",0)),"priceCurrency":"SEK"}})}</script>
<script type="application/ld+json">{faq_schema(faqs)}</script>
<script type="application/ld+json">{breadcrumbs_schema([("Bilkoll","https://lingabton.github.io/bilkoll/"),("Alla bilar","https://lingabton.github.io/bilkoll/"),(name,canonical)])}</script>'''

    content = f'''{breadcrumbs_html([("Bilkoll","/"),("Alla bilar","/"),(name,None)])}
<h1 style="font-size:32px;font-weight:800;margin:0 0 8px;line-height:1.15">{name}</h1>
<p style="font-size:14px;color:#64748b;margin:0 0 24px">{car.get('variant','')} · {car.get('fuel','').title()} · Nypris {fmt(car.get('newPrice',0))} kr</p>

<div style="padding:32px;border-radius:16px;background:linear-gradient(135deg,#0f172a,#1e293b);margin-bottom:24px">
<div style="font-size:13px;color:#94a3b8;margin-bottom:4px">Månadskostnad</div>
<div style="font-family:'JetBrains Mono',monospace;font-size:52px;font-weight:900;color:white;line-height:1">{fmt(m)} <span style="font-size:18px;color:#94a3b8;font-weight:500">kr/mån</span></div>
<div style="font-size:13px;color:#64748b;margin-top:8px">{car.get('cost_per_mil',0)} kr/mil · {fmt(total)} kr totalt · 4 år, 1 500 mil/år</div>
</div>

<div style="padding:24px;border-radius:16px;background:white;border:1px solid #e2e8f0;margin-bottom:24px">
<h2 style="font-size:14px;font-weight:700;margin:0 0 16px">Kostnadsfördelning (4 år)</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td></td><td style="text-align:right;font-size:11px;color:#94a3b8;padding-bottom:8px">per mån</td><td style="text-align:right;font-size:11px;color:#94a3b8;padding-bottom:8px">totalt</td></tr>
{rows}
<tr style="border-top:1px solid #e2e8f0"><td style="padding:12px 0;font-weight:700">Totalt</td><td style="padding:12px 0;text-align:right;font-family:monospace;font-weight:700">{fmt(m)} kr/mån</td><td style="padding:12px 0;text-align:right;font-family:monospace;font-weight:700;font-size:16px">{fmt(total)} kr</td></tr>
</table>
</div>

<div style="padding:20px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:24px">
<h2 style="font-size:14px;font-weight:700;margin:0 0 12px">Vanliga frågor om {name}</h2>
{"".join(f'<details style="margin-bottom:8px"><summary style="cursor:pointer;font-size:13px;font-weight:600;color:#0f172a;padding:8px 0">{q}</summary><p style="font-size:13px;color:#64748b;margin:4px 0 8px;line-height:1.6">{a}</p></details>' for q,a in faqs)}
</div>

<div style="margin-bottom:24px">
<h3 style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 8px">Jämför {name} med</h3>
{related_comparisons(car, cars)}
</div>

<div style="margin-bottom:24px">
<h3 style="font-size:13px;font-weight:700;color:#0f172a;margin:0 0 8px">Andra populära modeller</h3>
{"".join(car_card(c, i+1) for i,c in enumerate(cars[:5]) if c['id'] != car['id'])}
</div>

<p style="font-size:12px;color:#94a3b8">Beräknat med 4 års ägande, 1 500 mil/år. <a href="/" style="color:#2563eb">Anpassa beräkningen med egna förutsättningar →</a></p>

{footer(cars)}'''

    return head(title, desc, canonical, schema) + body_wrap(content)


def compare_page(a, b, cars):
    name_a, name_b = f"{a['make']} {a['model']}", f"{b['make']} {b['model']}"
    diff = abs(a.get('monthly_cost', 0) - b.get('monthly_cost', 0))
    cheaper = name_a if a.get('monthly_cost', 0) < b.get('monthly_cost', 0) else name_b
    slug = f"{a.get('slug','')}-vs-{b.get('slug','')}"
    canonical = f"https://lingabton.github.io/bilkoll/jamfor/{slug}/"

    title = f"{name_a} vs {name_b} — ägandekostnad {CURRENT_YEAR} | Bilkoll"
    desc = f"{cheaper} är {fmt(diff)} kr/mån billigare att äga. Jämför verklig totalkostnad: värdeminskning, drivmedel, skatt, försäkring."

    faqs = [
        (f"Vilken är billigast — {name_a} eller {name_b}?", f"{cheaper} är {fmt(diff)} kr/mån billigare, det blir {fmt(diff*12)} kr/år eller {fmt(diff*48)} kr över 4 år."),
        (f"Hur mycket kostar en {name_a} i månaden?", f"{name_a} kostar {fmt(a.get('monthly_cost',0))} kr/mån att äga, inklusive alla kostnader."),
        (f"Hur mycket kostar en {name_b} i månaden?", f"{name_b} kostar {fmt(b.get('monthly_cost',0))} kr/mån att äga, inklusive alla kostnader."),
    ]

    schema = f'<script type="application/ld+json">{faq_schema(faqs)}</script>\n<script type="application/ld+json">{breadcrumbs_schema([("Bilkoll","https://lingabton.github.io/bilkoll/"),("Jämför","https://lingabton.github.io/bilkoll/"),(f"{name_a} vs {name_b}",canonical)])}</script>'

    content = f'''{breadcrumbs_html([("Bilkoll","/"),("Jämför","/"),(f"{name_a} vs {name_b}",None)])}
<h1 style="font-size:28px;font-weight:800;margin:0 0 8px;line-height:1.2">{name_a} vs {name_b}</h1>
<p style="font-size:15px;color:#64748b;margin:0 0 24px">Vilken kostar minst att äga {CURRENT_YEAR}?</p>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
<div style="padding:24px;border-radius:16px;background:white;border:1px solid #e2e8f0;text-align:center">
<div style="font-size:14px;font-weight:700;margin-bottom:8px"><a href="/bil/{a.get('slug','')}/" style="color:#0f172a;text-decoration:none">{name_a}</a></div>
<div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:900;color:{'#059669' if a.get('monthly_cost',0) <= b.get('monthly_cost',0) else '#0f172a'}">{fmt(a.get('monthly_cost',0))} kr/mån</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">{a.get('fuel','').title()} · {fmt(a.get('newPrice',0))} kr ny</div>
</div>
<div style="padding:24px;border-radius:16px;background:white;border:1px solid #e2e8f0;text-align:center">
<div style="font-size:14px;font-weight:700;margin-bottom:8px"><a href="/bil/{b.get('slug','')}/" style="color:#0f172a;text-decoration:none">{name_b}</a></div>
<div style="font-family:'JetBrains Mono',monospace;font-size:28px;font-weight:900;color:{'#059669' if b.get('monthly_cost',0) <= a.get('monthly_cost',0) else '#0f172a'}">{fmt(b.get('monthly_cost',0))} kr/mån</div>
<div style="font-size:12px;color:#94a3b8;margin-top:4px">{b.get('fuel','').title()} · {fmt(b.get('newPrice',0))} kr ny</div>
</div>
</div>
<div style="padding:16px 20px;border-radius:12px;background:#ecfdf5;border:1px solid #d1fae5;text-align:center;margin-bottom:24px">
<span style="font-size:14px;font-weight:600;color:#059669">{cheaper} är {fmt(diff)} kr/mån billigare — {fmt(diff*12)} kr/år</span>
</div>

<div style="padding:20px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:24px">
<h2 style="font-size:14px;font-weight:700;margin:0 0 12px">Vanliga frågor</h2>
{"".join(f'<details style="margin-bottom:8px"><summary style="cursor:pointer;font-size:13px;font-weight:600;color:#0f172a;padding:8px 0">{q}</summary><p style="font-size:13px;color:#64748b;margin:4px 0 8px;line-height:1.6">{a}</p></details>' for q,a in faqs)}
</div>

{footer(cars)}'''

    return head(title, desc, canonical, schema) + body_wrap(content)


def category_page(title_text, desc_text, slug, cars_filtered, cars_all, faqs):
    canonical = f"https://lingabton.github.io/bilkoll/{slug}/"
    title = f"{title_text} — {CURRENT_MONTH} {CURRENT_YEAR} | Bilkoll"
    schema = f'<script type="application/ld+json">{faq_schema(faqs)}</script>\n<script type="application/ld+json">{breadcrumbs_schema([("Bilkoll","https://lingabton.github.io/bilkoll/"),(title_text,canonical)])}</script>'

    content = f'''{breadcrumbs_html([("Bilkoll","/"),(title_text,None)])}
<h1 style="font-size:32px;font-weight:800;margin:0 0 8px;line-height:1.15">{title_text}</h1>
<p style="font-size:15px;color:#64748b;margin:0 0 4px;line-height:1.6">{desc_text}</p>
<p style="font-size:12px;color:#94a3b8;margin:0 0 24px">Uppdaterad {CURRENT_MONTH} {CURRENT_YEAR} · Baserat på verkliga begagnatpriser</p>

{"".join(car_card(c, i+1) for i,c in enumerate(cars_filtered))}

<div style="padding:20px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;margin:24px 0">
<h2 style="font-size:14px;font-weight:700;margin:0 0 12px">Vanliga frågor</h2>
{"".join(f'<details style="margin-bottom:8px"><summary style="cursor:pointer;font-size:13px;font-weight:600;color:#0f172a;padding:8px 0">{q}</summary><p style="font-size:13px;color:#64748b;margin:4px 0 8px;line-height:1.6">{a}</p></details>' for q,a in faqs)}
</div>

{footer(cars_all)}'''

    return head(title, desc_text, canonical, schema) + body_wrap(content)


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    cars = load_data()
    total_pages = 0

    print(f"Generating SEO pages for {len(cars)} models\n")

    # ── Model pages ──
    for car in cars:
        slug = car.get('slug', car['id'])
        dir_path = DOCS_DIR / "bil" / slug
        dir_path.mkdir(parents=True, exist_ok=True)
        (dir_path / "index.html").write_text(model_page(car, cars), encoding='utf-8')
        total_pages += 1
    print(f"  {len(cars)} model pages")

    # ── Comparison pages ──
    pairs = list(combinations(cars, 2))
    for a, b in pairs:
        slug = f"{a.get('slug', a['id'])}-vs-{b.get('slug', b['id'])}"
        dir_path = DOCS_DIR / "jamfor" / slug
        dir_path.mkdir(parents=True, exist_ok=True)
        (dir_path / "index.html").write_text(compare_page(a, b, cars), encoding='utf-8')
        total_pages += 1
    print(f"  {len(pairs)} comparison pages")

    # ── Category pages ──
    ev = [c for c in cars if c.get('fuel') == 'el']
    hybrid = [c for c in cars if c.get('fuel') == 'hybrid']
    bensin = [c for c in cars if c.get('fuel') == 'bensin']
    suv = [c for c in cars if 'suv' in c.get('segment', '')]
    cheap = cars[:5]

    categories = [
        ("Billigaste elbilarna att äga", f"Vilka elbilar kostar minst per månad? Vi har jämfört {len(ev)} elbilar baserat på verklig totalkostnad.", "elbilar", ev, [
            ("Vilken elbil är billigast att äga?", f"{ev[0]['make']} {ev[0]['model']} kostar bara {fmt(ev[0].get('monthly_cost',0))} kr/mån — billigaste elbilen att äga just nu."),
            ("Vad kostar en elbil i månaden?", f"En elbil kostar mellan {fmt(ev[0].get('monthly_cost',0))} och {fmt(ev[-1].get('monthly_cost',0))} kr/mån beroende på modell."),
            ("Är elbil billigare än bensinbil?", f"Ofta ja. Billigaste elbilen ({ev[0]['make']} {ev[0]['model']}, {fmt(ev[0].get('monthly_cost',0))} kr/mån) är {'billigare' if ev[0].get('monthly_cost',0) < bensin[0].get('monthly_cost',0) else 'dyrare'} än billigaste bensinbilen ({bensin[0]['make']} {bensin[0]['model']}, {fmt(bensin[0].get('monthly_cost',0))} kr/mån)."),
        ]),
        ("Billigaste hybridbilarna att äga", f"Jämför {len(hybrid)} hybridbilar efter verklig månadskostnad. Värdeminskning, bränsle, skatt — allt inkluderat.", "hybrider", hybrid, [
            ("Vilken hybridbil är billigast att äga?", f"{hybrid[0]['make']} {hybrid[0]['model']} kostar {fmt(hybrid[0].get('monthly_cost',0))} kr/mån."),
            ("Är hybrid billigare än elbil?", f"Det beror på modell. Billigaste hybriden kostar {fmt(hybrid[0].get('monthly_cost',0))} kr/mån vs billigaste elbilen {fmt(ev[0].get('monthly_cost',0))} kr/mån."),
        ]),
        ("Billigaste bensinbilarna att äga", f"Vilka bensinbilar ger mest bil för pengarna? {len(bensin)} modeller jämförda efter total ägandekostnad.", "bensinbilar", bensin, [
            ("Vilken bensinbil är billigast att äga?", f"{bensin[0]['make']} {bensin[0]['model']} kostar {fmt(bensin[0].get('monthly_cost',0))} kr/mån."),
        ]) if bensin else None,
        ("Billigaste SUV att äga", f"Jämför {len(suv)} SUV-modeller efter verklig månadskostnad.", "suv", suv, [
            ("Vilken SUV är billigast att äga?", f"{suv[0]['make']} {suv[0]['model']} kostar {fmt(suv[0].get('monthly_cost',0))} kr/mån — billigaste SUV:en."),
        ]) if suv else None,
        ("Billigaste bilarna att äga i Sverige", f"Topp {len(cheap)} billigaste bilarna att äga {CURRENT_YEAR}. Verklig totalkostnad per månad — inte bara inköpspris.", "billigaste", cheap, [
            ("Vilken bil är billigast att äga?", f"{cheap[0]['make']} {cheap[0]['model']} kostar bara {fmt(cheap[0].get('monthly_cost',0))} kr/mån — billigast av alla modeller vi jämfört."),
            ("Vad kostar det att äga en bil i Sverige?", f"Mellan {fmt(cheap[0].get('monthly_cost',0))} och {fmt(cars[-1].get('monthly_cost',0))} kr/mån beroende på modell. Genomsnittet för våra {len(cars)} modeller är {fmt(sum(c.get('monthly_cost',0) for c in cars)//len(cars))} kr/mån."),
            ("Vad ingår i bilkostnaden?", "Värdeminskning, drivmedel, fordonsskatt, försäkring, service och däck. Värdeminskningen är ofta den största kostnaden."),
        ]),
        (f"Vad kostar en bil i månaden {CURRENT_YEAR}?", f"Komplett guide till bilkostnader i Sverige. Vi har räknat ut den verkliga månadskostnaden för {len(cars)} populära bilmodeller.", "bilkostnad", cars, [
            ("Vad kostar en bil i månaden?", f"En bil kostar mellan {fmt(cars[0].get('monthly_cost',0))} och {fmt(cars[-1].get('monthly_cost',0))} kr/mån. Snittet är {fmt(sum(c.get('monthly_cost',0) for c in cars)//len(cars))} kr/mån."),
            ("Vad kostar det att äga en bil per mil?", f"Mellan {cars[0].get('cost_per_mil',0)} och {cars[-1].get('cost_per_mil',0)} kr/mil beroende på modell och drivlina."),
            ("Hur räknar man ut bilkostnad?", "Totalkostnaden inkluderar: värdeminskning (baserad på verkliga begagnatpriser), drivmedel, fordonsskatt, försäkring, service och däck. Vi använder data från Skatteverket och tusentals begagnatannonser."),
            ("Vilka dolda kostnader har en bil?", "Värdeminskningen är den 'dolda' kostnaden — ofta 40-70% av totalkostnaden. En bil för 500 000 kr kan tappa 200 000 kr i värde på 4 år."),
        ]),
        (f"Elbil vs bensinbil — vad kostar mest {CURRENT_YEAR}?", f"Vi jämför ägandekostnaden för elbilar och bensinbilar. Vilken drivlina är billigast?", "elbil-vs-bensin", cars, [
            ("Är elbil billigare än bensinbil?", f"Det beror på modell. Billigaste elbilen kostar {fmt(ev[0].get('monthly_cost',0))} kr/mån, billigaste bensinbilen {fmt(bensin[0].get('monthly_cost',0))} kr/mån. Elbilar har lägre driftkostnad men ofta högre värdeminskning."),
            ("Hur mycket sparar man med elbil?", "Drivmedel kostar ofta 70-80% mindre med el. Men elbilar har ofta högre inköpspris och snabbare värdeminskning."),
        ]) if bensin else None,
    ]

    for cat in categories:
        if cat is None: continue
        title, desc, slug, filtered, faqs = cat
        dir_path = DOCS_DIR / slug
        dir_path.mkdir(parents=True, exist_ok=True)
        (dir_path / "index.html").write_text(category_page(title, desc, slug, filtered, cars, faqs), encoding='utf-8')
        total_pages += 1
    print(f"  {sum(1 for c in categories if c)} category pages")

    # ── Sitemap ──
    urls = [("https://lingabton.github.io/bilkoll/", "1.0", "daily")]
    for car in cars:
        urls.append((f"https://lingabton.github.io/bilkoll/bil/{car.get('slug', car['id'])}/", "0.8", "weekly"))
    for cat in categories:
        if cat: urls.append((f"https://lingabton.github.io/bilkoll/{cat[2]}/", "0.9", "weekly"))
    for a, b in pairs:
        slug = f"{a.get('slug', a['id'])}-vs-{b.get('slug', b['id'])}"
        urls.append((f"https://lingabton.github.io/bilkoll/jamfor/{slug}/", "0.6", "weekly"))

    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    for url, priority, freq in urls:
        sitemap += f'  <url><loc>{url}</loc><lastmod>{NOW}</lastmod><priority>{priority}</priority><changefreq>{freq}</changefreq></url>\n'
    sitemap += '</urlset>'
    (DOCS_DIR / "sitemap.xml").write_text(sitemap, encoding='utf-8')

    # ── robots.txt ──
    robots = f"User-agent: *\nAllow: /\nSitemap: https://lingabton.github.io/bilkoll/sitemap.xml\n"
    (DOCS_DIR / "robots.txt").write_text(robots, encoding='utf-8')

    print(f"\n  Total: {total_pages} pages + sitemap.xml ({len(urls)} URLs) + robots.txt")


if __name__ == "__main__":
    main()

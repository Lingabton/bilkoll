#!/usr/bin/env python3
"""Update the noscript fallback in frontend/index.html with current data from tco_summary.json."""

import json, re
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
INDEX_HTML = Path(__file__).parent.parent / "frontend" / "index.html"


def fmt(n):
    return f"{int(n):,}".replace(",", " ")


def main():
    summary = json.load(open(DATA_DIR / "tco_summary.json"))
    models = json.load(open(DATA_DIR / "models.json"))
    model_map = {m["id"]: m for m in models}

    cheapest = summary[0]
    most_expensive = summary[-1]
    avg = sum(s["monthly_cost"] for s in summary) // len(summary)
    ev_cars = [s for s in summary if model_map.get(s["id"], {}).get("fuel") == "el"]
    cheapest_ev = ev_cars[0] if ev_cars else None

    # Build list items
    items = "\n".join(
        f'          <li><strong>{s["name"].split(" ", 2)[0]} {s["name"].split(" ", 2)[1] if len(s["name"].split(" ", 2)) > 1 else ""}</strong> — {fmt(s["monthly_cost"])} kr/mån</li>'
        for s in summary
    )

    noscript = f'''    <noscript>
      <div style="max-width:640px;margin:0 auto;padding:32px 20px;font-family:'DM Sans',sans-serif;color:#0f172a">
        <h1 style="font-size:32px;font-weight:800">Bilkoll — Vad kostar bilen egentligen?</h1>
        <p style="color:#64748b;margin-bottom:24px">Vi beräknar den verkliga månadskostnaden — värdeminskning, drivmedel, skatt, försäkring — baserat på tusentals begagnatpriser.</p>
        <h2 style="font-size:18px;font-weight:700;margin-bottom:12px">Månadskostnad — {len(summary)} modeller jämförda</h2>
        <ol style="padding-left:20px;line-height:2">
{items}
        </ol>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">Beräknat med 4 års ägande, 1 500 mil/år. Nybilspriser: Skatteverket SKVFS 2025:29. Begagnatpriser: AutoUncle. Bilkoll av Gabriel Linton, Olav Innovation AB.</p>
        <h2 style="font-size:18px;font-weight:700;margin:24px 0 12px">Vanliga frågor</h2>
        <details><summary style="font-weight:600;cursor:pointer">Vad kostar en bil i månaden?</summary><p style="color:#64748b">En bil kostar mellan {fmt(cheapest["monthly_cost"])} och {fmt(most_expensive["monthly_cost"])} kr/mån beroende på modell. Snittet för våra {len(summary)} modeller är cirka {fmt(avg)} kr/mån.</p></details>
        <details><summary style="font-weight:600;cursor:pointer">Vilken bil är billigast att äga?</summary><p style="color:#64748b">{cheapest["name"]} kostar bara {fmt(cheapest["monthly_cost"])} kr/mån — billigast av alla modeller vi jämfört.</p></details>
        <details><summary style="font-weight:600;cursor:pointer">Är elbil billigare än bensinbil?</summary><p style="color:#64748b">Det beror på modell. Billigaste elbilen ({cheapest_ev["name"].split(" ", 2)[0] + " " + cheapest_ev["name"].split(" ", 2)[1] if cheapest_ev else "?"}, {fmt(cheapest_ev["monthly_cost"]) if cheapest_ev else "?"} kr/mån) är {"billigare" if cheapest_ev and cheapest_ev["monthly_cost"] < cheapest["monthly_cost"] else "dyrare"} än billigaste hybriden ({cheapest["name"].split(" ", 2)[0] + " " + cheapest["name"].split(" ", 2)[1]}, {fmt(cheapest["monthly_cost"])} kr/mån).</p></details>
        <details><summary style="font-weight:600;cursor:pointer">Hur räknar Bilkoll?</summary><p style="color:#64748b">Vi summerar värdeminskning (baserad på verkliga begagnatpriser), drivmedel, fordonsskatt, försäkring, service, däck och besiktning. Alla priser från Skatteverket och AutoUncle.</p></details>
      </div>
    </noscript>'''

    html = INDEX_HTML.read_text()
    html = re.sub(r'    <noscript>.*?</noscript>', noscript, html, flags=re.DOTALL)
    INDEX_HTML.write_text(html)
    print(f"Updated noscript in {INDEX_HTML} with {len(summary)} models")


if __name__ == "__main__":
    main()

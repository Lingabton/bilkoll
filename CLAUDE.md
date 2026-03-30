# CLAUDE.md — Bilkoll MVP

> Implementationsspec för Claude Code.
> Läs hela detta dokument innan du skriver en enda rad kod.

---

## Vad vi bygger

**Bilkoll** = Sveriges första TCO-jämförare med verkliga marknadspriser.
Användaren anger en bilmodell → ser vad den verkligen kostar per månad →
jämför med en annan bil side-by-side.

Killer feature: Värdeminskningen baseras på faktiska begagnatpriser
(scrapad från AutoUncle), inte generiska 15%-kurvor.

**Stack:** Python (scraping/data) + React/Vite/Tailwind (frontend) + GitHub Pages (hosting)
**Kostnad:** ~0 kr (gratis hosting, gratis CI)
**Mönster:** Samma som Smakfynd — publik data → praktiskt verktyg → SEO-trafik

---

## Kritiska designbeslut

Dessa beslut är fattade. Följ dem.

### 1. Statisk HELA vägen — ingen dynamisk backend
Allt är pre-beräknat. GitHub Actions scrapar data veckovis → genererar JSON →
bygger statisk React-app → deployas till GitHub Pages. Ingen server, ingen
Cloudflare Worker, ingen on-demand scraping. Det kommer i framtiden om det
behövs — inte nu.

### 2. Fem modeller först — inte tjugo
Starta med exakt dessa fem modeller som täcker alla jämförelse-scenarion:

| Modell | Varför |
|---|---|
| Volvo XC60 B5 Bensin | Referens-SUV, Sveriges populäraste |
| Tesla Model 3 Long Range | Elbilsreferens |
| Kia Niro EV | Billigare elbil-alternativ |
| Toyota Corolla Hybrid | Snåljåp, hybrid-referens |
| Dacia Jogger TCe | Budget, lägsta inköpspris |

### 3. SEO-sidor från dag 1
Modellsidor och jämförelsesidor genereras som statisk HTML i build-steget.
De ska vara indexerbara av Google utan JavaScript. React hydrerar ovanpå.

### 4. "Wow-siffran" är produktens kärna
Hela UX:et kretsar kring EN stor siffra: **"X XXX kr/mån"** — bilens verkliga
månadskostnad. Den ska vara det första användaren ser. Delbar, skärmdumpbar,
tweetbar.

---

## Repo-struktur

```
bilkoll/
├── CLAUDE.md                    # ← Du läser denna fil
├── README.md
├── package.json                 # Root: scripts för build pipeline
│
├── scraper/                     # Python — datahämtning
│   ├── requirements.txt         # playwright, beautifulsoup4, requests
│   ├── autouncle.py             # Scrapa modellsidor
│   ├── price_source.py          # Abstrakt interface för priskällor
│   ├── tax_calculator.py        # Fordonsskatteberäkning
│   ├── tco_engine.py            # TCO-beräkning → JSON
│   └── validate.py              # Datakvalitetskontroll
│
├── data/
│   ├── models.json              # Modellbibliotek (manuellt kurerat)
│   ├── fuel_prices.json         # Drivmedelspriser
│   ├── prices/                  # Cachade prisdata per modell
│   │   ├── volvo-xc60-b5.json
│   │   └── ...
│   └── tco/                     # Beräknad TCO per modell
│       ├── volvo-xc60-b5.json
│       └── ...
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── HeroResult.jsx       # Stor wow-siffra
│   │   │   ├── CompareView.jsx      # Side-by-side
│   │   │   ├── CostBreakdown.jsx    # Stapeldiagram
│   │   │   ├── DepreciationCurve.jsx # Värdeminskningskurva
│   │   │   ├── SearchBar.jsx        # Fuzzy search
│   │   │   ├── ModelCard.jsx        # Kompakt modellkort
│   │   │   ├── ShareCard.jsx        # OG-bild-generering
│   │   │   └── ConfidenceBadge.jsx  # Datakvalitetsindikator
│   │   └── utils/
│   │       └── tco.js               # Client-side omräkning
│   └── public/
│       └── og/                      # Pre-genererade OG-bilder
│
├── scripts/
│   ├── build_data.py            # Orchestrator: scrape → validate → tco
│   ├── generate_pages.py        # Pre-rendera HTML för SEO
│   └── generate_og.py           # Generera OG-bilder per modell
│
└── .github/
    └── workflows/
        └── update.yml           # Veckovis: scrape + build + deploy
```

---

## Datamodell

### models.json — modellbiblioteket (manuellt kurerat)

```json
[
  {
    "id": "volvo-xc60-b5-bensin",
    "make": "Volvo",
    "model": "XC60",
    "variant": "B5 Bensin AWD",
    "slug": "volvo-xc60",
    "segment": "suv-mellanklass",
    "fuel": "bensin",
    "newPrice": 529900,
    "co2_gkm": 166,
    "consumption_l_per_mil": 0.72,
    "consumption_kwh_per_mil": null,
    "firstRegistered": 2018,
    "serviceInterval_mil": 3000,
    "serviceEstimate_kr": 5500,
    "tireSize": "235/55R19",
    "tireEstimate_kr_per_year": 1800,
    "autouncle_filters": {
      "fuel": "bensin",
      "url_path": "Volvo/XC60/f-bensin"
    }
  },
  {
    "id": "tesla-model-3-lr",
    "make": "Tesla",
    "model": "Model 3",
    "variant": "Long Range AWD",
    "slug": "tesla-model-3",
    "segment": "sedan-mellanklass",
    "fuel": "el",
    "newPrice": 449900,
    "co2_gkm": 0,
    "consumption_l_per_mil": null,
    "consumption_kwh_per_mil": 1.5,
    "firstRegistered": 2019,
    "serviceInterval_mil": 4000,
    "serviceEstimate_kr": 2500,
    "tireSize": "235/45R18",
    "tireEstimate_kr_per_year": 2000,
    "autouncle_filters": {
      "fuel": "elbil",
      "url_path": "Tesla/Model-3/f-elbil"
    }
  }
]
```

**VIKTIGT:** `autouncle_filters.fuel` styr URL-filtret vid scraping.
Detta säkerställer att vi jämför bensin-XC60 med bensin-XC60,
inte blandar diesel och bensin i medianpriset.

### prices/{model-id}.json — scrapad prisdata

```json
{
  "model_id": "volvo-xc60-b5-bensin",
  "scraped_at": "2026-03-29T05:00:00Z",
  "source": "autouncle",
  "years": {
    "2025": {
      "median_price": 445000,
      "p5_price": 360000,
      "p95_price": 520000,
      "count": 42,
      "median_mileage_mil": 1800,
      "avg_days_listed": 28
    },
    "2024": {
      "median_price": 385000,
      "p5_price": 310000,
      "p95_price": 460000,
      "count": 118,
      "median_mileage_mil": 4200,
      "avg_days_listed": 22
    }
  },
  "validation": {
    "is_monotonic": true,
    "min_count_per_year": 42,
    "confidence": "high"
  }
}
```

### tco/{model-id}.json — beräknad TCO

```json
{
  "model_id": "volvo-xc60-b5-bensin",
  "calculated_at": "2026-03-29T05:30:00Z",
  "assumptions": {
    "mileage_per_year": 1500,
    "ownership_years": 4,
    "fuel_price_kr_per_liter": 18.50,
    "electricity_price_kr_per_kwh": 1.50
  },
  "result": {
    "total_cost": 298400,
    "monthly_cost": 6217,
    "cost_per_mil": 50,
    "breakdown": {
      "depreciation": 164900,
      "fuel": 79920,
      "tax": 24800,
      "insurance": { "low": 16000, "high": 28800, "estimate": 22400 },
      "service": 11000,
      "tires": 7200
    },
    "depreciation_curve": [
      { "year": 0, "value": 529900 },
      { "year": 1, "value": 445000, "confidence": "high", "data_points": 42 },
      { "year": 2, "value": 385000, "confidence": "high", "data_points": 118 },
      { "year": 3, "value": 340000, "confidence": "high", "data_points": 165 },
      { "year": 4, "value": 305000, "confidence": "medium", "data_points": 95 }
    ]
  },
  "confidence": "high",
  "data_quality_notes": []
}
```

---

## Implementationsordning

Bygg exakt i denna ordning. Avsluta varje steg innan du går vidare.

### STEG 1: Projekt-setup
```bash
mkdir bilkoll && cd bilkoll
git init
npm init -y
# Python-miljö
python3 -m venv .venv
source .venv/bin/activate
pip install playwright beautifulsoup4 requests
playwright install chromium
# Frontend
npm create vite@latest frontend -- --template react
cd frontend && npm install && npm install -D tailwindcss @tailwindcss/vite
cd ..
```
Skapa `models.json` med alla fem modeller (se schema ovan).

### STEG 2: Scraper med datakvalitetskontroll

**Fil: `scraper/price_source.py`** — abstrakt interface
```python
class PriceSource:
    """Abstrakt interface för priskällor.
    Gör det möjligt att byta från AutoUncle till Bytbil/Blocket
    utan att skriva om resten av systemet."""

    def fetch_prices(self, make, model, fuel_filter, year) -> dict:
        raise NotImplementedError
```

**Fil: `scraper/autouncle.py`** — konkret implementation
- Använd Playwright (headless Chromium)
- URL-mönster: `https://www.autouncle.se/se/begagnade-bilar/{url_path}/y-{year}`
- Extrahera: medianpris, prisintervall, antal annonser, medianmiltal
- **VIKTIGT:** Använd `autouncle_filters.fuel` från models.json
  för att filtrera på rätt drivlina. URL blir t.ex.
  `.../Volvo/XC60/f-bensin/y-2023`
- Rate-limit: max 1 request per 3 sekunder
- Cacha resultat i `data/prices/`
- Scrapa år: nuvarande år - 1 till nuvarande år - 8

**Fil: `scraper/validate.py`** — datakvalitetskontroll
Kör efter varje scrape. Regler:
1. **Monotonicitet:** Äldre årsmodeller ska vara billigare. Om inte → flagga.
2. **Minimalt dataunderlag:** < 10 annonser för en årsmodell → confidence = "low"
3. **Prishopp:** Om medianpris ändras > 20% vs förra scrapen → använd förra veckans data + flagga
4. **Miltalskontroll:** Om medianmiltal per årsmodell avviker kraftigt
   från förväntat (årsmodellsålder × 1500 mil ± 50%) → notera i data_quality_notes
5. Sätt confidence: "high" (>50 annonser), "medium" (10-50), "low" (<10)

### STEG 3: Skatteberäkning

**Fil: `scraper/tax_calculator.py`**

Implementera svensk fordonsskatteberäkning:
```
Grundbelopp: 360 kr/år (alla bilar)

Malus (3 första åren, bilar tagna i trafik efter 1 juni 2022):
  CO2 ≤ 75 g/km:  ingen malus
  CO2 76-125 g/km: 107 kr per gram över 75
  CO2 > 125 g/km:  132 kr per gram över 125 + 107×50

Diesel: +250 kr/år miljötillägg

Efter malus-perioden (3 år):
  Grundbelopp 360 kr + 22 kr per gram CO2 över 0 (bensin/diesel)
  Elbilar: 360 kr
```

Input: co2_gkm, fuel_type, car_age_years
Output: årlig fordonsskatt

### STEG 4: TCO-beräkning

**Fil: `scraper/tco_engine.py`**

```python
def calculate_tco(model: dict, prices: dict, years: int = 4,
                  mileage: int = 1500,
                  fuel_price: float = 18.50,
                  el_price: float = 1.50) -> dict:
    """
    Beräknar TCO.

    Värdeminskning: skillnad mellan inköpspris och marknadspris efter N år.
      - Om begagnad bil: inköpspris = medianpris för nuvarande årsmodell.
      - Använd linjär interpolation mellan datapunkter vid behov.

    Drivmedel: consumption × mileage × 10 × price_per_unit × years
      - Bensin/diesel: liter per mil × kr/liter
      - El: kWh per mil × kr/kWh
      - Hybrid: samma som bensin (konservativt antagande)

    Skatt: tax_calculator.calculate() × years

    Försäkring: VISA INTERVALL, inte en siffra.
      - Uppskatta: low = segment_base × 0.7, high = segment_base × 1.3
      - estimate = medelvärde
      - Segmentbas: liten bil 3500, mellanklass 5000, SUV 5800,
        premium 6500, elbil +500 (stöldrisk)

    Service: serviceEstimate_kr × (mileage × years / serviceInterval_mil)
      - Avrundat uppåt till hela serviceintervaller

    Däck: tireEstimate_kr_per_year × years
    """
```

Skriv resultat till `data/tco/{model-id}.json`.

**Generera även sammanfattningsfil `data/tco_summary.json`:**
```json
[
  {
    "id": "volvo-xc60-b5-bensin",
    "slug": "volvo-xc60",
    "name": "Volvo XC60 B5 Bensin",
    "monthly_cost": 6217,
    "cost_per_mil": 50,
    "total_4yr": 298400,
    "confidence": "high",
    "fuel": "bensin",
    "segment": "suv-mellanklass",
    "newPrice": 529900
  }
]
```

### STEG 5: Frontend — "wow-siffran" först

**Huvudflöde:**
1. Startsida: sökfält + lista med alla modeller sorterade på månadskostnad
2. Klick på modell → HeroResult med stor siffra + breakdown
3. "Jämför med annan bil" → CompareView side-by-side

**Komponent: `HeroResult.jsx`**
```
┌──────────────────────────────────────────┐
│                                          │
│        Volvo XC60 B5 Bensin AWD          │
│                                          │
│            5 200 kr/mån                  │  ← STOR, 48px+
│                                          │
│    50 kr/mil  ·  298 400 kr totalt       │  ← Sekundärt
│    ─────────────────────────────          │
│    baserat på 4 år, 1 500 mil/år         │
│                                          │
│    [Ändra antaganden ▾]                  │
│    [Jämför med annan bil]                │
│    [Dela ↗]                              │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ████████████████░░░░░░ Värdem.55%  │  │
│  │ ██████████░░░░░░░░░░░ Drivmedel27% │  │
│  │ ███░░░░░░░░░░░░░░░░░ Skatt    8%  │  │
│  │ ███░░░░░░░░░░░░░░░░░ Försäkr. 7%  │  │
│  │ ██░░░░░░░░░░░░░░░░░░ Service  2%  │  │
│  │ █░░░░░░░░░░░░░░░░░░░ Däck     1%  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Konfidensindikator:                     │
│  🟢 Hög — baserat på 118 annonser       │
│                                          │
└──────────────────────────────────────────┘
```

Försäkring visas som intervall: "Försäkring: 4 000 – 7 200 kr/år
(beror på din ålder, bostadsort och bonus)"

**"Ändra antaganden"** — expanderbar panel med sliders:
- Körsträcka: 500-3000 mil/år
- Ägandetid: 1-8 år
- Bensinpris: 15-25 kr/l
- Elpris: 0.5-4.0 kr/kWh

Alla omräkningar sker client-side i `utils/tco.js`.
Vid ändring: uppdatera alla siffror i realtid.

**Komponent: `CompareView.jsx`**
Två HeroResults bredvid varandra (stacked på mobil).
Nedanför: tabell med kostnadsbrytning rad-för-rad,
med kolumnen "Skillnad" och färgkodning (grön = billigare, röd = dyrare).
Längst ned: "X kostar Y kr/mån mindre att äga".

**Komponent: `ConfidenceBadge.jsx`**
Visar datakvalitet:
- 🟢 Hög: >50 datapunkter, monoton priskurva
- 🟡 Medel: 10-50 datapunkter
- 🔴 Låg: <10 datapunkter, varning visas

**Komponent: `DepreciationCurve.jsx`**
Chart.js linjediagram som visar bilens värde över tid.
Varje datapunkt visar antal underliggande annonser.
Om confidence = "low" → streckad linje istället för heldragen.

**Komponent: `ShareCard.jsx`**
Generera en snygg bild (canvas → PNG) med:
- Bilmodellens namn
- Stor månadskostnad-siffra
- Jämförelse om relevant ("2 100 kr/mån billigare än BMW 320i")
- "bilkoll.se" branding

### STEG 6: SEO — statiska modellsidor

**Fil: `scripts/generate_pages.py`**

Generera statiska HTML-sidor som React hydrerar ovanpå:

```
dist/
├── index.html
├── bil/
│   ├── volvo-xc60/index.html        ← Pre-renderad med TCO-data
│   ├── tesla-model-3/index.html
│   ├── kia-niro-ev/index.html
│   ├── toyota-corolla/index.html
│   └── dacia-jogger/index.html
├── jamfor/
│   ├── tesla-model-3-vs-volvo-xc60/index.html
│   ├── kia-niro-ev-vs-dacia-jogger/index.html
│   └── ... (generera alla 10 par-kombinationer av 5 modeller)
└── data/
    ├── models.json
    ├── tco_summary.json
    └── tco/*.json
```

Varje modellsida ska ha:
- `<title>`: "Volvo XC60 ägandekostnad 2026 — 5 200 kr/mån | Bilkoll"
- `<meta description>`: "Vad kostar en Volvo XC60 egentligen? Vi har räknat ut
  den verkliga totalkostnaden baserat på 118 begagnade bilar till salu."
- Schema.org `Product` + `AggregateOffer` markup
- OG-bild med wow-siffran
- Synlig HTML-content med TCO-data (inte bara en tom React-container)
- Canonical URL

Jämförelsesidor ska ha:
- `<title>`: "Tesla Model 3 vs Volvo XC60 — ägandekostnad jämförelse | Bilkoll"
- Pre-renderad jämförelsedata i HTML

### STEG 7: Build-pipeline

**Fil: `scripts/build_data.py`** — körs lokalt eller i GitHub Actions

```bash
#!/bin/bash
# Komplett build-pipeline
set -e

echo "=== 1. Scrapa prisdata ==="
python scraper/autouncle.py

echo "=== 2. Validera data ==="
python scraper/validate.py

echo "=== 3. Beräkna TCO ==="
python scraper/tco_engine.py

echo "=== 4. Bygg frontend ==="
cd frontend && npm run build && cd ..

echo "=== 5. Generera SEO-sidor ==="
python scripts/generate_pages.py

echo "=== 6. Generera OG-bilder ==="
python scripts/generate_og.py

echo "=== Klart! Output i dist/ ==="
```

### STEG 8: GitHub Actions

**Fil: `.github/workflows/update.yml`**
```yaml
name: Update data and deploy
on:
  schedule:
    - cron: '0 5 * * 1'   # Varje måndag kl 05:00 UTC
  workflow_dispatch:        # Manuell trigger

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: |
          pip install playwright beautifulsoup4 requests
          playwright install chromium --with-deps
      - run: cd frontend && npm install
      - run: bash scripts/build_data.py
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## Regler

1. **Inga API-nycklar** — allt är scraping eller offentlig data
2. **Max 1 request per 3 sekunder** till AutoUncle
3. **Cacha aggressivt** — scrapa max 1 gång per vecka
4. **Visa alltid datakälla och confidence** — ingen falsk precision
5. **Försäkring = intervall** — aldrig en exakt siffra
6. **Client-side omräkning** — sliders ändrar TCO utan serveranrop
7. **Mobile-first** — alla komponenter stacked på <768px
8. **Svenska** — all UI-text på svenska, kodningstil på engelska
9. **Abstrakt datakälla** — om AutoUncle blockerar ska vi kunna byta till
   Bytbil/Blocket genom att implementera nytt PriceSource-subclass

---

## URL-schema för AutoUncle-scraping

```
Bas: https://www.autouncle.se/se/begagnade-bilar/

Per modell+bränsle+år:
  /Volvo/XC60/f-bensin/y-2023
  /Tesla/Model-3/f-elbil/y-2022
  /Kia/Niro/f-elbil/y-2023
  /Toyota/Corolla/f-hybrid/y-2022
  /Dacia/Jogger/y-2023          (bara bensin finns)

Data att extrahera från varje sida:
  - Marknadsöversikts-texten (innehåller medianpris, prisintervall, antal)
  - Alternativt: parsa individuella annonser om översikt saknas
```

---

## Vad som INTE ingår i MVP

- On-demand scraping / Cloudflare Workers
- Fler än 5 modeller
- AI-sökning / Claude API-integration
- Privat vs tjänstebil
- Leasing vs köp-jämförelse
- Nyhetsbrev / Substack
- Användarekonton / "mitt garage"
- Försäkringsjämförelse-widget
- Regionala elpriser

Allt ovan är framtida faser. Bygg inte för dem nu.
Bygg så att de KAN läggas till utan refactoring.

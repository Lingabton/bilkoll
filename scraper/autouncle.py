#!/usr/bin/env python3
"""Scrape used car prices from AutoUncle.se for TCO calculation."""

import json, time, re, statistics, sys
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
from price_source import PriceSource

DATA_DIR = Path(__file__).parent.parent / "data"
PRICES_DIR = DATA_DIR / "prices"
PRICES_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://www.autouncle.se/se/begagnade-bilar"
RATE_LIMIT = 3  # seconds between requests
CURRENT_YEAR = datetime.now().year


class AutoUncleScraper(PriceSource):
    def __init__(self, headless=True):
        self.headless = headless
        self.browser = None
        self.page = None

    def start(self):
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(headless=self.headless)
        self.page = self.browser.new_page(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )

    def stop(self):
        if self.browser:
            self.browser.close()
        if self.pw:
            self.pw.stop()

    def fetch_prices(self, url_path, fuel_filter, year) -> dict:
        """Fetch price data for a model+year from AutoUncle."""
        # Build URL
        url = f"{BASE_URL}/{url_path}/y-{year}"
        if fuel_filter:
            # fuel filter is already in url_path (e.g. Volvo/XC60/f-bensin)
            pass

        time.sleep(RATE_LIMIT)
        self.page.goto(url, wait_until="domcontentloaded", timeout=15000)
        time.sleep(1.5)  # let JS render

        # Try to extract prices from the page
        prices = []
        mileages = []

        # Method 1: Look for price elements in listing cards
        try:
            cards = self.page.query_selector_all("[data-testid='car-card'], .car-card, .listing-card, article")
            if not cards:
                # Try broader selectors
                cards = self.page.query_selector_all(".result-item, .car-item, [class*='listing']")

            for card in cards:
                text = card.inner_text()
                # Extract price (Swedish format: "199 000 kr" or "199.000 kr")
                price_match = re.search(r'(\d[\d\s.]+)\s*kr', text)
                if price_match:
                    price_str = price_match.group(1).replace(" ", "").replace(".", "")
                    try:
                        p = int(price_str)
                        if 20000 < p < 2000000:  # sanity check
                            prices.append(p)
                    except ValueError:
                        pass

                # Extract mileage ("45 000 mil" or "4 500 mil")
                mil_match = re.search(r'(\d[\d\s.]+)\s*mil', text)
                if mil_match:
                    mil_str = mil_match.group(1).replace(" ", "").replace(".", "")
                    try:
                        m = int(mil_str)
                        if 0 < m < 100000:
                            mileages.append(m)
                    except ValueError:
                        pass
        except Exception as e:
            print(f"    Card parsing error: {e}")

        # Method 2: Try the market overview text
        if not prices:
            try:
                body = self.page.inner_text("body")
                # Look for "X bilar" count
                count_match = re.search(r'(\d+)\s*bilar', body)
                # Look for median/average price mentions
                price_matches = re.findall(r'(\d[\d\s.]+)\s*kr', body)
                for pm in price_matches:
                    price_str = pm.replace(" ", "").replace(".", "")
                    try:
                        p = int(price_str)
                        if 20000 < p < 2000000:
                            prices.append(p)
                    except ValueError:
                        pass
            except Exception:
                pass

        if not prices:
            return {"count": 0}

        prices.sort()
        n = len(prices)
        result = {
            "median_price": int(statistics.median(prices)),
            "count": n,
        }

        if n >= 5:
            p5_idx = max(0, int(n * 0.05))
            p95_idx = min(n - 1, int(n * 0.95))
            result["p5_price"] = prices[p5_idx]
            result["p95_price"] = prices[p95_idx]

        if mileages:
            result["median_mileage_mil"] = int(statistics.median(mileages))

        return result


def scrape_model(scraper, model):
    """Scrape all years for a single model."""
    model_id = model["id"]
    url_path = model["autouncle_filters"]["url_path"]
    fuel_filter = model["autouncle_filters"].get("fuel")
    first_year = model.get("firstRegistered", CURRENT_YEAR - 6)

    print(f"\n{'='*50}")
    print(f"  {model['make']} {model['model']} {model['variant']}")
    print(f"  URL: {BASE_URL}/{url_path}")
    print(f"{'='*50}")

    years_data = {}
    for year in range(CURRENT_YEAR - 1, first_year - 1, -1):
        print(f"  {year}...", end=" ", flush=True)
        try:
            data = scraper.fetch_prices(url_path, fuel_filter, year)
            if data.get("count", 0) > 0:
                years_data[str(year)] = data
                print(f"{data['count']} ads, median {data.get('median_price', '?')} kr")
            else:
                print("no data")
        except Exception as e:
            print(f"error: {e}")

    # Validate monotonicity
    sorted_years = sorted(years_data.keys(), reverse=True)
    is_monotonic = True
    for i in range(len(sorted_years) - 1):
        y1, y2 = sorted_years[i], sorted_years[i + 1]
        if years_data[y1].get("median_price", 0) < years_data[y2].get("median_price", float("inf")):
            is_monotonic = False
            break

    min_count = min((d.get("count", 0) for d in years_data.values()), default=0)
    confidence = "high" if min_count > 50 else "medium" if min_count >= 10 else "low"

    result = {
        "model_id": model_id,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "autouncle",
        "years": years_data,
        "validation": {
            "is_monotonic": is_monotonic,
            "min_count_per_year": min_count,
            "confidence": confidence,
        },
    }

    out_path = PRICES_DIR / f"{model_id}.json"
    json.dump(result, open(out_path, "w"), ensure_ascii=False, indent=2)
    print(f"  → Saved: {out_path} ({len(years_data)} years, confidence: {confidence})")
    return result


def main():
    models = json.load(open(DATA_DIR / "models.json"))

    # Allow filtering by model ID
    if len(sys.argv) > 1:
        filter_id = sys.argv[1]
        models = [m for m in models if filter_id in m["id"]]
        if not models:
            print(f"No model matching '{filter_id}'")
            return

    print(f"Scraping {len(models)} models from AutoUncle")

    scraper = AutoUncleScraper(headless=True)
    scraper.start()

    try:
        for model in models:
            scrape_model(scraper, model)
    finally:
        scraper.stop()

    print(f"\nDone! Scraped {len(models)} models.")


if __name__ == "__main__":
    main()

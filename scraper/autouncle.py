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
RATE_LIMIT = 3
CURRENT_YEAR = datetime.now().year


def parse_price(text):
    """Parse a Swedish price string, handling non-breaking spaces."""
    cleaned = text.replace('\xa0', '').replace(' ', '').replace('.', '').replace(',', '')
    cleaned = re.sub(r'[^\d]', '', cleaned)
    if cleaned and cleaned.isdigit():
        return int(cleaned)
    return None


def parse_mileage(text):
    """Parse mileage in Swedish mil from text."""
    m = re.search(r'([\d\s\xa0.]+)\s*mil', text.replace('\xa0', ' '))
    if m:
        val = parse_price(m.group(1))
        if val and 0 < val < 100000:
            return val
    return None


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

    def _parse_page(self):
        """Parse prices and mileages from currently loaded page."""
        articles = self.page.query_selector_all('article')
        prices = []
        mileages = []
        for article in articles:
            text = article.inner_text()
            price_matches = re.findall(r'([\d\s\xa0.]+)\s*kr', text)
            for pm in price_matches:
                p = parse_price(pm)
                if p and 30000 < p < 2000000:
                    prices.append(p)
                    break
            mil = parse_mileage(text)
            if mil:
                mileages.append(mil)
        return prices, mileages

    def fetch_prices(self, url_path, fuel_filter, year) -> dict:
        """Fetch price data for a model+year from AutoUncle with pagination."""
        url = f"{BASE_URL}/{url_path}/y-{year}"

        time.sleep(RATE_LIMIT)
        self.page.goto(url, wait_until="domcontentloaded", timeout=15000)
        self.page.wait_for_timeout(2000)

        # Scroll to load all visible results
        for _ in range(8):
            self.page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            self.page.wait_for_timeout(800)

        # Get total count
        body_text = self.page.inner_text('body')
        count_match = re.search(r'(\d+)\s*(bilar|resultat|annonser)', body_text)
        total_on_page = int(count_match.group(1)) if count_match else 0

        # Parse first page
        all_prices, all_mileages = self._parse_page()

        # Paginate if there are more results (look for page 2, 3... links)
        page_num = 2
        while len(all_prices) < total_on_page and page_num <= 10:
            next_url = f"{url}?page={page_num}"
            try:
                time.sleep(RATE_LIMIT)
                self.page.goto(next_url, wait_until="domcontentloaded", timeout=15000)
                self.page.wait_for_timeout(2000)
                for _ in range(5):
                    self.page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                    self.page.wait_for_timeout(600)
                prices, mileages = self._parse_page()
                if not prices:
                    break
                all_prices.extend(prices)
                all_mileages.extend(mileages)
                page_num += 1
            except Exception:
                break

        if not all_prices:
            return {"count": 0, "total_on_page": total_on_page}

        all_prices.sort()
        n = len(all_prices)
        result = {
            "median_price": int(statistics.median(all_prices)),
            "count": n,
            "total_on_page": total_on_page,
        }

        if n >= 5:
            p5_idx = max(0, int(n * 0.05))
            p95_idx = min(n - 1, int(n * 0.95))
            result["p5_price"] = all_prices[p5_idx]
            result["p95_price"] = all_prices[p95_idx]

        if n >= 3:
            result["min_price"] = all_prices[0]
            result["max_price"] = all_prices[-1]

        if all_mileages:
            result["median_mileage_mil"] = int(statistics.median(all_mileages))

        return result


def scrape_model(scraper, model):
    """Scrape all years for a single model."""
    model_id = model["id"]
    url_path = model["autouncle_filters"]["url_path"]
    fuel_filter = model["autouncle_filters"].get("fuel")
    first_year = model.get("firstRegistered", CURRENT_YEAR - 6)

    print(f"\n{'='*60}")
    print(f"  {model['make']} {model['model']} {model['variant']}")
    print(f"  URL: {BASE_URL}/{url_path}")
    print(f"{'='*60}")

    years_data = {}
    for year in range(CURRENT_YEAR - 1, first_year - 1, -1):
        print(f"  {year}...", end=" ", flush=True)
        try:
            data = scraper.fetch_prices(url_path, fuel_filter, year)
            count = data.get("count", 0)
            total = data.get("total_on_page", 0)
            if count > 0:
                years_data[str(year)] = data
                p5 = f", p5={data['p5_price']}" if data.get('p5_price') else ""
                p95 = f", p95={data['p95_price']}" if data.get('p95_price') else ""
                print(f"{count} parsed / {total} total, median {data.get('median_price', '?')} kr{p5}{p95}")
            else:
                print(f"no prices found ({total} on page)")
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
    total_ads = sum(d.get("count", 0) for d in years_data.values())
    print(f"  → Saved: {out_path} ({len(years_data)} years, {total_ads} ads, confidence: {confidence})")
    return result


def main():
    models = json.load(open(DATA_DIR / "models.json"))

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

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

# Discount factor: AutoUncle shows asking prices, not transaction prices.
# Real sale prices are typically 5-10% below asking price.
ASKING_PRICE_DISCOUNT = 0.93  # 7% discount


def parse_price(text):
    """Parse a Swedish price string, handling non-breaking spaces."""
    cleaned = text.replace('\xa0', '').replace(' ', '').replace('.', '').replace(',', '')
    cleaned = re.sub(r'[^\d]', '', cleaned)
    if cleaned and cleaned.isdigit():
        return int(cleaned)
    return None


def parse_mileage(text):
    """Parse mileage in Swedish mil from text.

    Guards against picking up year numbers (2018-2026) as mileage.
    Realistic mileage: 1-40000 mil (10-400000 km).
    """
    # Match patterns like "3 500 mil", "15000 mil", "850mil"
    m = re.search(r'([\d\s\xa0.]+)\s*mil\b', text.replace('\xa0', ' '))
    if m:
        raw = m.group(1).strip()
        val = parse_price(raw)
        if val is None:
            return None
        # Filter out year numbers mistakenly matched
        if 2010 <= val <= 2030:
            return None
        # Realistic range: 1-40000 mil (10 km to 400 000 km)
        if 1 <= val <= 40000:
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

    def _dismiss_overlays(self):
        """Try to dismiss cookie consent and other overlays."""
        selectors = [
            'button:has-text("Acceptera")',
            'button:has-text("Godkänn")',
            'button:has-text("Accept")',
            '[class*="cookie"] button',
            '[class*="consent"] button',
        ]
        for sel in selectors:
            try:
                btn = self.page.query_selector(sel)
                if btn and btn.is_visible():
                    btn.click()
                    self.page.wait_for_timeout(500)
            except Exception:
                pass

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
        self._dismiss_overlays()

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

        # Paginate — try both URL patterns AutoUncle might use
        page_num = 2
        max_pages = min(10, (total_on_page // 25) + 2)
        while len(all_prices) < total_on_page and page_num <= max_pages:
            # Try ?page=N first, then /page/N
            next_urls = [
                f"{url}?page={page_num}",
            ]
            success = False
            for next_url in next_urls:
                try:
                    time.sleep(RATE_LIMIT)
                    self.page.goto(next_url, wait_until="domcontentloaded", timeout=15000)
                    self.page.wait_for_timeout(2000)
                    self._dismiss_overlays()
                    for _ in range(8):
                        self.page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                        self.page.wait_for_timeout(600)
                    prices, mileages = self._parse_page()
                    if prices:
                        all_prices.extend(prices)
                        all_mileages.extend(mileages)
                        success = True
                        break
                except Exception:
                    continue
            if not success:
                break
            page_num += 1

        if not all_prices:
            return {"count": 0, "total_on_page": total_on_page}

        # Apply asking price discount (7%) to approximate transaction prices
        all_prices = [int(p * ASKING_PRICE_DISCOUNT) for p in all_prices]
        all_prices.sort()
        n = len(all_prices)

        result = {
            "median_price": int(statistics.median(all_prices)),
            "count": n,
            "total_on_page": total_on_page,
            "price_type": "estimated_transaction",
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
                pct = f" ({round(count/total*100)}%)" if total > 0 else ""
                print(f"{count} parsed / {total} total{pct}, median {data.get('median_price', '?')} kr (est. transaction){p5}{p95}")
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
        "price_type": "estimated_transaction",
        "asking_price_discount": ASKING_PRICE_DISCOUNT,
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
    print(f"  Asking price discount: {ASKING_PRICE_DISCOUNT} ({round((1-ASKING_PRICE_DISCOUNT)*100)}% off)")

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

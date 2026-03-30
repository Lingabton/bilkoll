#!/usr/bin/env python3
"""Validate scraped price data quality."""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
PRICES_DIR = DATA_DIR / "prices"


def validate_model(price_data):
    """Validate a single model's price data. Returns (issues, warnings)."""
    model_id = price_data["model_id"]
    years = price_data.get("years", {})
    issues = []
    warnings = []

    if not years:
        issues.append("No year data at all")
        return issues, warnings

    sorted_years = sorted(years.keys(), reverse=True)

    # 1. Monotonicity: newer cars should be more expensive
    for i in range(len(sorted_years) - 1):
        y_new, y_old = sorted_years[i], sorted_years[i + 1]
        p_new = years[y_new].get("median_price", 0)
        p_old = years[y_old].get("median_price", 0)
        if p_new < p_old and p_new > 0 and p_old > 0:
            issues.append(f"Non-monotonic: {y_new}={p_new}kr < {y_old}={p_old}kr")

    # 2. Minimum data points
    for year, data in years.items():
        count = data.get("count", 0)
        if count < 10:
            warnings.append(f"{year}: only {count} ads (low confidence)")

    # 3. Mileage sanity check
    models = json.load(open(DATA_DIR / "models.json"))
    model = next((m for m in models if m["id"] == model_id), None)
    if model:
        current_year = 2026
        for year, data in years.items():
            expected_mil = (current_year - int(year)) * 1500
            actual_mil = data.get("median_mileage_mil")
            if actual_mil and expected_mil > 0:
                ratio = actual_mil / expected_mil
                if ratio < 0.5 or ratio > 2.0:
                    warnings.append(f"{year}: mileage {actual_mil} mil vs expected ~{expected_mil} mil")

    # 4. Set confidence per year
    for year, data in years.items():
        count = data.get("count", 0)
        if count > 50:
            data["confidence"] = "high"
        elif count >= 10:
            data["confidence"] = "medium"
        else:
            data["confidence"] = "low"

    return issues, warnings


def main():
    print("=" * 50)
    print("  BILKOLL DATA VALIDATION")
    print("=" * 50)

    total_issues = 0
    total_warnings = 0

    for path in sorted(PRICES_DIR.glob("*.json")):
        data = json.load(open(path))
        model_id = data["model_id"]
        issues, warnings = validate_model(data)

        status = "FAIL" if issues else ("WARN" if warnings else "OK")
        years_count = len(data.get("years", {}))
        confidence = data.get("validation", {}).get("confidence", "?")

        print(f"\n  {model_id}: {status} ({years_count} years, confidence: {confidence})")
        for issue in issues:
            print(f"    ERROR: {issue}")
            total_issues += 1
        for warn in warnings:
            print(f"    WARN:  {warn}")
            total_warnings += 1

        # Write back with updated confidence
        json.dump(data, open(path, "w"), ensure_ascii=False, indent=2)

    print(f"\n  {total_issues} errors, {total_warnings} warnings")
    if total_issues > 0:
        print("  FIX ERRORS before running TCO calculation!")
        return 1
    return 0


if __name__ == "__main__":
    exit(main())

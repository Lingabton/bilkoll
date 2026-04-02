#!/usr/bin/env python3
"""TCO (Total Cost of Ownership) calculation engine."""

import json, math
from pathlib import Path
from datetime import datetime, timezone
from tax_calculator import calculate_tax_over_years

DATA_DIR = Path(__file__).parent.parent / "data"
PRICES_DIR = DATA_DIR / "prices"
TCO_DIR = DATA_DIR / "tco"
TCO_DIR.mkdir(parents=True, exist_ok=True)

# Insurance base by segment (annual, approximate)
INSURANCE_BASE = {
    "suv-mellanklass": 5800,
    "sedan-mellanklass": 5000,
    "suv-kompakt": 5200,
    "sedan-kompakt": 4200,
    "mpv-budget": 3800,
}
# EV surcharge for insurance (theft risk)
EV_INSURANCE_SURCHARGE = 500

CURRENT_YEAR = datetime.now().year


def calculate_tco(model, prices, years=4, mileage=1500,
                  fuel_price=18.50, el_price=1.50):
    """Calculate Total Cost of Ownership.

    Args:
        model: dict from models.json
        prices: dict from prices/{id}.json
        years: ownership period in years
        mileage: annual mileage in Swedish mil (1 mil = 10 km)
        fuel_price: SEK per liter
        el_price: SEK per kWh

    Returns: TCO result dict
    """
    new_price = model["newPrice"]
    fuel_type = model["fuel"]
    co2 = model["co2_gkm"]

    # ── Depreciation ──
    # Build depreciation curve from ALL available market data (not just ownership years)
    years_data = prices.get("years", {})
    curve = [{"year": 0, "value": new_price, "confidence": "fixed", "data_points": 0}]

    # Include all years we have data for (up to 10 years back)
    max_curve_years = max(years + 4, len(years_data) + 1, 8)
    for y in range(1, max_curve_years + 1):
        target_year = str(CURRENT_YEAR - y)
        if target_year in years_data:
            yd = years_data[target_year]
            curve.append({
                "year": y,
                "value": yd["median_price"],
                "confidence": yd.get("confidence", "medium"),
                "data_points": yd.get("count", 0),
            })
        else:
            # Interpolate or extrapolate
            known = [(int(k), v["median_price"]) for k, v in years_data.items()
                     if v.get("median_price")]
            if known:
                known.sort(key=lambda x: x[0], reverse=True)
                # Simple linear extrapolation from known data
                target = CURRENT_YEAR - y
                closest = min(known, key=lambda x: abs(x[0] - target))
                # Assume ~12% depreciation per year as fallback
                years_diff = abs(closest[0] - target)
                estimated = int(closest[1] * (0.88 ** years_diff))
                curve.append({
                    "year": y,
                    "value": estimated,
                    "confidence": "estimated",
                    "data_points": 0,
                })

    # Depreciation = purchase price - value after N years
    if len(curve) > years:
        end_value = curve[years]["value"]
    elif curve:
        end_value = curve[-1]["value"]
    else:
        # Fallback: 15% per year
        end_value = int(new_price * (0.85 ** years))

    depreciation = new_price - end_value

    # ── Fuel/electricity ──
    # consumption is per mil (10km), mileage is mil/year
    if fuel_type == "el":
        kwh_per_mil = model.get("consumption_kwh_per_mil", 1.5)
        fuel_cost = kwh_per_mil * mileage * el_price * years
    else:
        l_per_mil = model.get("consumption_l_per_mil", 0.7)
        fuel_cost = l_per_mil * mileage * fuel_price * years

    fuel_cost = round(fuel_cost)

    # ── Tax ──
    # Assume buying new: start at age 0
    tax = calculate_tax_over_years(co2, fuel_type, years, start_age=0)

    # ── Insurance ──
    segment = model.get("segment", "sedan-mellanklass")
    ins_base = INSURANCE_BASE.get(segment, 5000)
    if fuel_type == "el":
        ins_base += EV_INSURANCE_SURCHARGE
    ins_low = round(ins_base * 0.7 * years)
    ins_high = round(ins_base * 1.3 * years)
    ins_estimate = round(ins_base * years)

    # ── Service ──
    service_interval = model.get("serviceInterval_mil", 2500)
    service_cost = model.get("serviceEstimate_kr", 4000)
    total_mil = mileage * years
    service_count = math.ceil(total_mil / service_interval)
    service_total = service_count * service_cost

    # ── Tires ──
    tire_total = model.get("tireEstimate_kr_per_year", 1500) * years

    # ── Total ──
    total = depreciation + fuel_cost + tax + ins_estimate + service_total + tire_total
    monthly = round(total / (years * 12))
    cost_per_mil = round(total / (mileage * years)) if mileage > 0 else 0

    # Confidence based on price data
    confidence = prices.get("validation", {}).get("confidence", "low")

    return {
        "model_id": model["id"],
        "calculated_at": datetime.now(timezone.utc).isoformat(),
        "assumptions": {
            "mileage_per_year": mileage,
            "ownership_years": years,
            "fuel_price_kr_per_liter": fuel_price,
            "electricity_price_kr_per_kwh": el_price,
        },
        "result": {
            "total_cost": total,
            "monthly_cost": monthly,
            "cost_per_mil": cost_per_mil,
            "breakdown": {
                "depreciation": depreciation,
                "fuel": fuel_cost,
                "tax": tax,
                "insurance": {"low": ins_low, "high": ins_high, "estimate": ins_estimate},
                "service": service_total,
                "tires": tire_total,
            },
            "depreciation_curve": curve,
        },
        "confidence": confidence,
        "data_quality_notes": [],
    }


def main():
    models = json.load(open(DATA_DIR / "models.json"))
    fuel_prices = None
    fuel_file = DATA_DIR / "fuel_prices.json"
    if fuel_file.exists():
        fuel_prices = json.load(open(fuel_file))

    print("=" * 50)
    print("  BILKOLL TCO ENGINE")
    print("=" * 50)

    summary = []

    for model in models:
        model_id = model["id"]
        price_file = PRICES_DIR / f"{model_id}.json"

        if not price_file.exists():
            print(f"\n  {model_id}: SKIP (no price data)")
            continue

        prices = json.load(open(price_file))
        fp = fuel_prices.get("bensin", 18.50) if fuel_prices else 18.50
        ep = fuel_prices.get("el", 1.50) if fuel_prices else 1.50

        tco = calculate_tco(model, prices, fuel_price=fp, el_price=ep)
        r = tco["result"]

        # Save
        out = TCO_DIR / f"{model_id}.json"
        json.dump(tco, open(out, "w"), ensure_ascii=False, indent=2)

        print(f"\n  {model['make']} {model['model']} {model['variant']}")
        print(f"    Månadskostnad:  {r['monthly_cost']:>6} kr/mån")
        print(f"    Totalt (4 år):  {r['total_cost']:>6} kr")
        print(f"    Per mil:        {r['cost_per_mil']:>6} kr/mil")
        b = r["breakdown"]
        print(f"    Värdeminskning: {b['depreciation']:>6} kr ({round(b['depreciation']/r['total_cost']*100)}%)")
        print(f"    Drivmedel:      {b['fuel']:>6} kr ({round(b['fuel']/r['total_cost']*100)}%)")
        print(f"    Skatt:          {b['tax']:>6} kr")
        print(f"    Försäkring:     {b['insurance']['low']:>6}–{b['insurance']['high']} kr")
        print(f"    Service:        {b['service']:>6} kr")
        print(f"    Däck:           {b['tires']:>6} kr")
        print(f"    Confidence:     {tco['confidence']}")

        summary.append({
            "id": model_id,
            "slug": model["slug"],
            "name": f"{model['make']} {model['model']} {model['variant']}",
            "monthly_cost": r["monthly_cost"],
            "cost_per_mil": r["cost_per_mil"],
            "total_4yr": r["total_cost"],
            "confidence": tco["confidence"],
            "fuel": model["fuel"],
            "segment": model["segment"],
            "newPrice": model["newPrice"],
        })

    # Save summary
    summary.sort(key=lambda x: x["monthly_cost"])
    summary_path = DATA_DIR / "tco_summary.json"
    json.dump(summary, open(summary_path, "w"), ensure_ascii=False, indent=2)
    print(f"\n  Summary: {summary_path} ({len(summary)} models)")

    # Print ranking
    print(f"\n  RANKING (billigast per månad):")
    for i, s in enumerate(summary):
        print(f"    {i+1}. {s['name']:35} {s['monthly_cost']:>6} kr/mån  ({s['fuel']})")


if __name__ == "__main__":
    main()

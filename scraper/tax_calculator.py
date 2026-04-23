#!/usr/bin/env python3
"""Swedish vehicle tax (fordonsskatt) calculator."""

import math


def calculate_tax(co2_gkm, fuel_type, car_age_years=0):
    """Calculate annual vehicle tax in SEK.

    Args:
        co2_gkm: CO2 emissions in grams per km
        fuel_type: "bensin", "diesel", "el", "hybrid"
        car_age_years: years since first registration

    Returns:
        Annual tax in SEK
    """
    base = 360  # grundbelopp

    # Electric vehicles: just the base
    if fuel_type == "el":
        return base

    # Laddhybrid: treated like bensin for tax (uses WLTP CO2)
    if fuel_type == "laddhybrid":
        fuel_type = "bensin"

    # Malus period (first 3 years, cars registered after June 2022)
    if car_age_years < 3 and co2_gkm > 75:
        malus = 0
        if co2_gkm > 125:
            malus = 107 * 50 + 132 * (co2_gkm - 125)
        elif co2_gkm > 75:
            malus = 107 * (co2_gkm - 75)
        tax = base + malus
    else:
        # After malus period: base + 22 kr per gram CO2
        tax = base + 22 * co2_gkm

    # Diesel surcharge
    if fuel_type == "diesel":
        tax += 250

    return math.ceil(tax)


def calculate_tax_over_years(co2_gkm, fuel_type, years, start_age=0):
    """Calculate total tax over multiple years, accounting for malus phase-out."""
    total = 0
    for y in range(years):
        total += calculate_tax(co2_gkm, fuel_type, car_age_years=start_age + y)
    return total


if __name__ == "__main__":
    # Test cases
    tests = [
        ("Volvo XC60 B5 Bensin", 166, "bensin", 0),
        ("Volvo XC60 B5 Bensin (efter malus)", 166, "bensin", 4),
        ("Tesla Model 3", 0, "el", 0),
        ("Toyota Corolla Hybrid", 101, "hybrid", 0),
        ("Dacia Jogger", 130, "bensin", 0),
        ("Dacia Jogger (efter malus)", 130, "bensin", 4),
    ]
    print("Fordonsskatt-beräkning:")
    for name, co2, fuel, age in tests:
        tax = calculate_tax(co2, fuel, age)
        print(f"  {name:40} CO2={co2:>3}g/km  {fuel:8}  ålder={age}  → {tax:>6} kr/år")

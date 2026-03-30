/**
 * Client-side TCO recalculation.
 */

// CO2 social cost (Swedish Transport Agency estimate, ~1.19 kr/kg CO2)
const CO2_COST_PER_KG = 1.19

function calculateTax(co2, fuel, age) {
  const base = 360
  if (fuel === "el") return base
  if (age < 3 && co2 > 75) {
    let malus = 0
    if (co2 > 125) malus = 107 * 50 + 132 * (co2 - 125)
    else malus = 107 * (co2 - 75)
    return Math.ceil(base + malus)
  }
  let tax = base + 22 * co2
  if (fuel === "diesel") tax += 250
  return Math.ceil(tax)
}

/**
 * Calculate monthly loan payment (annuity).
 * @param {number} principal - loan amount
 * @param {number} annualRate - annual interest rate (e.g. 0.059 for 5.9%)
 * @param {number} months - loan duration in months
 */
function monthlyPayment(principal, annualRate, months) {
  if (annualRate === 0) return principal / months
  const r = annualRate / 12
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export function recalcTCO(detail, model, {
  mileage, years, fuelPrice, elPrice,
  insuranceLevel = 1.0, buyAge = 0,
  loanPct = 0, interestRate = 0.059
}) {
  if (!detail || !model) return null

  const curve = detail.result.depreciation_curve
  const newPrice = model.newPrice
  const fuel = model.fuel
  const co2 = model.co2_gkm

  // Purchase price
  let purchasePrice = newPrice
  if (buyAge > 0 && curve.length > buyAge) {
    purchasePrice = curve[buyAge].value
  } else if (buyAge > 0) {
    purchasePrice = Math.round(newPrice * Math.pow(0.85, buyAge))
  }

  // End value
  const endAge = buyAge + years
  let endValue
  if (curve.length > endAge) {
    endValue = curve[endAge].value
  } else if (curve.length > 0) {
    const lastKnown = curve[curve.length - 1]
    const extraYears = endAge - lastKnown.year
    endValue = Math.round(lastKnown.value * Math.pow(0.88, extraYears))
  } else {
    endValue = Math.round(purchasePrice * Math.pow(0.85, years))
  }

  const depreciation = purchasePrice - endValue

  // Financing cost (interest only — depreciation already covers principal)
  const loanAmount = purchasePrice * (loanPct / 100)
  let interestCost = 0
  if (loanAmount > 0 && interestRate > 0) {
    const months = years * 12
    const totalPayments = monthlyPayment(loanAmount, interestRate, months) * months
    interestCost = Math.round(totalPayments - loanAmount)
  }

  // Fuel
  let fuelCost
  if (fuel === "el") {
    fuelCost = (model.consumption_kwh_per_mil || 1.5) * mileage * elPrice * years
  } else {
    fuelCost = (model.consumption_l_per_mil || 0.7) * mileage * fuelPrice * years
  }
  fuelCost = Math.round(fuelCost)

  // Tax
  let tax = 0
  for (let y = 0; y < years; y++) tax += calculateTax(co2, fuel, buyAge + y)

  // Insurance (per-model data)
  const ins = model.insurance_kr_per_year
  let insAnnual
  if (ins) {
    if (insuranceLevel <= 0.7) insAnnual = ins.low
    else if (insuranceLevel >= 1.3) insAnnual = ins.high
    else {
      // Interpolate between low-mid-high
      if (insuranceLevel <= 1.0) {
        const t = (insuranceLevel - 0.5) / 0.5
        insAnnual = Math.round(ins.low + (ins.mid - ins.low) * t)
      } else {
        const t = (insuranceLevel - 1.0) / 0.5
        insAnnual = Math.round(ins.mid + (ins.high - ins.mid) * t)
      }
    }
  } else {
    insAnnual = 5000
  }
  const insurance = {
    low: ins ? ins.low * years : Math.round(insAnnual * 0.7 * years),
    high: ins ? ins.high * years : Math.round(insAnnual * 1.3 * years),
    estimate: insAnnual * years,
  }

  // Service
  const serviceInterval = model.serviceInterval_mil || 2500
  const serviceCost = model.serviceEstimate_kr || 4000
  const serviceCount = Math.ceil((mileage * years) / serviceInterval)
  const service = serviceCount * serviceCost

  // Tires
  const tires = (model.tireEstimate_kr_per_year || 1500) * years

  // CO2 emissions
  const totalKm = mileage * 10 * years  // mil → km
  const totalCO2_kg = Math.round((co2 * totalKm) / 1000)
  const co2Cost = Math.round(totalCO2_kg * CO2_COST_PER_KG)

  const total = depreciation + fuelCost + tax + insurance.estimate + service + tires + interestCost
  const monthly = Math.round(total / (years * 12))
  const costPerMil = mileage > 0 ? Math.round(total / (mileage * years)) : 0

  return {
    total,
    monthly,
    costPerMil,
    purchasePrice,
    breakdown: {
      depreciation,
      fuel: fuelCost,
      tax,
      insurance,
      service,
      tires,
      interest: interestCost,
    },
    emissions: {
      total_kg: totalCO2_kg,
      total_ton: +(totalCO2_kg / 1000).toFixed(1),
      social_cost: co2Cost,
    },
  }
}

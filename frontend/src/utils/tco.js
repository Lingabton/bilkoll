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
  loanPct = 0, interestRate = 0.059,
  purchasePriceOverride = null,
}) {
  if (!detail || !model) return null

  const curve = detail.result.depreciation_curve
  const newPrice = model.newPrice
  const fuel = model.fuel
  const co2 = model.co2_gkm

  // Purchase price
  let purchasePrice = purchasePriceOverride || newPrice
  if (!purchasePriceOverride && buyAge > 0 && curve.length > buyAge) {
    purchasePrice = curve[buyAge].value
  } else if (!purchasePriceOverride && buyAge > 0) {
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

  // Build explanations for each cost
  const fmt = n => Math.round(n).toLocaleString('sv-SE')
  const consumption = fuel === "el" ? (model.consumption_kwh_per_mil || 1.5) : (model.consumption_l_per_mil || 0.7)
  const fuelUnit = fuel === "el" ? "kWh/mil" : "l/mil"
  const fuelPriceUsed = fuel === "el" ? elPrice : fuelPrice
  const fuelPriceUnit = fuel === "el" ? "kr/kWh" : "kr/l"
  const taxPerYear = years > 0 ? Math.round(tax / years) : 0

  const explanations = {
    depreciation: {
      formula: `Inköpspris ${fmt(purchasePrice)} kr − beräknat värde efter ${years} år (${fmt(endValue)} kr)`,
      detail: `Värdeminskning baseras på medianen av ${fuel === 'el' ? 'elbils' : 'begagnat'}annonser per årsmodell. ${buyAge > 0 ? `Bilen köps som ${buyAge} år gammal.` : 'Bilen köps ny.'} Framtida värde extrapoleras från verkliga begagnatpriser.`,
      source: 'AutoUncle — begagnatpriser från tusentals annonser',
      sourceUrl: 'https://www.autouncle.se/',
    },
    fuel: {
      formula: `${consumption} ${fuelUnit} × ${fmt(mileage)} mil/år × ${fuelPriceUsed} ${fuelPriceUnit} × ${years} år = ${fmt(fuelCost)} kr`,
      detail: model.consumption_note || `Förbrukning baserad på verkliga ägarrapporter, inte WLTP.`,
      source: 'Spritmonitor.de — verklig förbrukning från tusentals ägare',
      sourceUrl: 'https://www.spritmonitor.de/',
    },
    tax: {
      formula: `${co2 > 0 ? `CO₂: ${co2} g/km. ` : 'Elbil: '}${taxPerYear} kr/år × ${years} år = ${fmt(tax)} kr${buyAge < 3 && co2 > 75 ? ' (inkl. malus första 3 åren)' : ''}`,
      detail: `Grundbelopp 360 kr + ${co2 > 0 ? `22 kr per gram CO₂ (${co2} g/km)` : 'ingen CO₂-avgift (elbil)'}. ${fuel === 'diesel' ? 'Diesel: +250 kr/år miljötillägg. ' : ''}${buyAge < 3 && co2 > 75 ? `Malus-period (3 första åren): extra ${co2 > 125 ? `${107*50 + 132*(co2-125)}` : `${107*(co2-75)}`} kr/år.` : ''}`,
      source: 'Skatteverket — fordonsskatteberäkning',
      sourceUrl: 'https://www.skatteverket.se/',
    },
    insurance: {
      formula: `${fmt(insAnnual)} kr/år × ${years} år = ${fmt(insurance.estimate)} kr (spann: ${fmt(insurance.low/years)}–${fmt(insurance.high/years)} kr/år)`,
      detail: model.insurance_note || `Försäkringskostnad baserad på modellspecifika data. Verklig kostnad beror på din ålder, bostadsort, bonus och vald nivå (halv/hel).`,
      source: model.insurance_source || 'Hedvig, Zmarta — genomsnittliga premier per bilmärke',
      sourceUrl: 'https://www.hedvig.com/se/forsakringar/bilforsakring/vad-kostar-bilforsakring',
    },
    service: {
      formula: `${fmt(serviceCost)} kr/service × ${serviceCount} servicetillfällen (var ${fmt(serviceInterval)} mil) = ${fmt(service)} kr`,
      detail: model.service_note || `Servicekostnad baserad på auktoriserad verkstad.`,
      source: 'Tillverkarens serviceplan + Carla.se/Teknikens Värld jämförelser',
    },
    tires: {
      formula: `${fmt(model.tireEstimate_kr_per_year || 1500)} kr/år × ${years} år = ${fmt(tires)} kr`,
      detail: `Däckstorlek: ${model.tireSize || '?'}. Inkluderar vinterdäck och sommardäck, byte och förvaring. Elbilsdäck kostar ~50% mer än vanliga.`,
      source: 'Branschsnitt baserat på däckstorlek',
    },
    interest: interestCost > 0 ? {
      formula: `${loanPct}% av ${fmt(purchasePrice)} kr = ${fmt(loanAmount)} kr lån, ${(interestRate*100).toFixed(1)}% ränta, ${years*12} mån → ${fmt(interestCost)} kr i räntekostnad`,
      detail: `Annuitetslån. Total återbetalning: ${fmt(loanAmount + interestCost)} kr. Räntan kan variera — Tesla erbjuder ibland 0%, medan bankränta ofta ligger på 5-7%.`,
      source: 'Beräknat med annuitetsformel',
    } : null,
  }

  return {
    total,
    monthly,
    costPerMil,
    purchasePrice,
    endValue,
    breakdown: {
      depreciation,
      fuel: fuelCost,
      tax,
      insurance,
      service,
      tires,
      interest: interestCost,
    },
    explanations,
    emissions: {
      total_kg: totalCO2_kg,
      total_ton: +(totalCO2_kg / 1000).toFixed(1),
      social_cost: co2Cost,
    },
  }
}

/**
 * Client-side TCO recalculation.
 */

// CO2 social cost (Swedish Transport Agency estimate, ~1.19 kr/kg CO2)
const CO2_COST_PER_KG = 1.19

// Besiktning (vehicle inspection): 490 kr, first at age 3, then every 2 years
const BESIKTNING_KR = 490

function calculateTax(co2, fuel, age) {
  const base = 360
  if (fuel === "el") return base
  // Laddhybrid uses same tax rules as bensin (based on WLTP CO2)
  const effectiveFuel = fuel === "laddhybrid" ? "bensin" : fuel
  if (age < 3 && co2 > 75) {
    let malus = 0
    if (co2 > 125) malus = 107 * 50 + 132 * (co2 - 125)
    else malus = 107 * (co2 - 75)
    return Math.ceil(base + malus)
  }
  let tax = base + 22 * co2
  if (effectiveFuel === "diesel") tax += 250
  return Math.ceil(tax)
}

function calculateBesiktning(years, startAge) {
  let total = 0
  for (let y = 0; y < years; y++) {
    const age = startAge + y
    if (age >= 3 && (age - 3) % 2 === 0) {
      total += BESIKTNING_KR
    }
  }
  return total
}

/**
 * Calculate monthly loan payment (annuity).
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
  // Use real CO2 for social cost if available (PHEV WLTP CO2 is fantasy)
  const realCo2 = model.real_co2_gkm || co2

  // Purchase price
  let purchasePrice = purchasePriceOverride || newPrice
  if (!purchasePriceOverride && buyAge > 0 && curve.length > buyAge) {
    purchasePrice = curve[buyAge].value
  } else if (!purchasePriceOverride && buyAge > 0) {
    purchasePrice = Math.round(newPrice * Math.pow(0.85, buyAge))
  }

  // End value after ownership period
  const endAge = buyAge + years
  let endValue

  if (curve.length > endAge) {
    endValue = curve[endAge].value
  } else if (curve.length > 0) {
    const knownPoints = curve.filter(p => p.year >= Math.max(1, buyAge) && p.value > 0)
    let annualRate = 0.85

    if (knownPoints.length >= 2) {
      const first = knownPoints[0]
      const last = knownPoints[knownPoints.length - 1]
      const yearSpan = last.year - first.year
      if (yearSpan > 0 && first.value > 0 && last.value > 0) {
        annualRate = Math.pow(last.value / first.value, 1 / yearSpan)
        annualRate = Math.max(0.75, Math.min(0.95, annualRate))
      }
    }

    const yearsToExtrapolate = years
    endValue = Math.round(purchasePrice * Math.pow(annualRate, yearsToExtrapolate))
  } else {
    endValue = Math.round(purchasePrice * Math.pow(0.85, years))
  }

  if (endValue > purchasePrice) endValue = Math.round(purchasePrice * Math.pow(0.85, years))

  const depreciation = Math.max(0, purchasePrice - endValue)

  // Financing cost
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
    const baseConsumption = model.consumption_kwh_per_mil || 1.5
    // 8% annual average winter increase (5 months winter in Sweden)
    const winterFactor = 1.08
    fuelCost = baseConsumption * winterFactor * mileage * elPrice * years
  } else if (fuel === "laddhybrid") {
    // PHEV: conservative = no regular charging, pure bensin cost
    fuelCost = (model.consumption_l_per_mil || 0.7) * mileage * fuelPrice * years
  } else {
    // bensin, diesel, hybrid (self-charging)
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
  let service = 0
  let serviceDetail = ''
  const schedule = model.service_schedule
  if (schedule && schedule.length > 0) {
    const yearCosts = []
    for (let y = 0; y < years; y++) {
      const carYear = buyAge + y
      const cost = schedule[carYear % schedule.length] || 0
      service += cost
      yearCosts.push(cost)
    }
    serviceDetail = yearCosts.map((c, i) => `år ${buyAge + i + 1}: ${c.toLocaleString('sv-SE')} kr`).join(', ')
  } else {
    const serviceInterval = model.serviceInterval_mil || 2500
    const serviceCost = model.serviceEstimate_kr || 4000
    const serviceCount = Math.ceil((mileage * years) / serviceInterval)
    service = serviceCount * serviceCost
    serviceDetail = `${serviceCost.toLocaleString('sv-SE')} kr × ${serviceCount} tillfällen`
  }

  // Tires
  const tires = (model.tireEstimate_kr_per_year || 1500) * years

  // Besiktning
  const besiktning = calculateBesiktning(years, buyAge)

  // CO2 emissions — use real CO2 for social cost, not WLTP
  const totalKm = mileage * 10 * years
  const totalCO2_kg = Math.round((realCo2 * totalKm) / 1000)
  const co2Cost = Math.round(totalCO2_kg * CO2_COST_PER_KG)

  const total = depreciation + fuelCost + tax + insurance.estimate + service + tires + besiktning + interestCost
  const monthly = Math.round(total / (years * 12))
  const costPerMil = mileage > 0 ? Math.round(total / (mileage * years)) : 0

  // Build explanations
  const fmt = n => Math.round(n).toLocaleString('sv-SE')
  const consumption = fuel === "el" ? (model.consumption_kwh_per_mil || 1.5) : (model.consumption_l_per_mil || 0.7)
  const fuelUnit = fuel === "el" ? "kWh/mil" : "l/mil"
  const fuelPriceUsed = fuel === "el" ? elPrice : fuelPrice
  const fuelPriceUnit = fuel === "el" ? "kr/kWh" : "kr/l"
  const taxPerYear = years > 0 ? Math.round(tax / years) : 0

  const explanations = {
    depreciation: {
      formula: `Inköpspris ${fmt(purchasePrice)} kr − beräknat värde efter ${years} år (${fmt(endValue)} kr) = ${fmt(depreciation)} kr`,
      detail: (() => {
        const endPt = curve.length > endAge ? curve[endAge] : null
        const dataInfo = endPt && endPt.data_points > 0
          ? `Slutvärdet baseras på ${endPt.data_points} annonser (${endPt.confidence === 'high' ? 'hög' : endPt.confidence === 'medium' ? 'medel' : 'låg'} tillförlitlighet).`
          : `Slutvärdet är extrapolerat — ingen direkt data för år ${endAge}.`
        const curveInfo = curve.filter(p => p.data_points > 0).map(p => `${p.year}år: ${fmt(p.value)} kr (${p.data_points} annonser)`).join(' → ')
        return `${buyAge > 0 ? `Bilen köps som ${buyAge} år gammal för ${fmt(purchasePrice)} kr.` : 'Bilen köps ny.'} ${dataInfo}\n\nPriskurva: ${curveInfo}\n\n⚠️ Priserna är uppskattade transaktionspriser (7% under utropspris).`
      })(),
      source: 'AutoUncle — medianer justerade från utropspris till uppskattad transaktionsnivå (−7%)',
      sourceUrl: 'https://www.autouncle.se/',
    },
    fuel: {
      formula: fuel === "el"
        ? `${consumption} ${fuelUnit} × 1.08 (vinterfaktor) × ${fmt(mileage)} mil/år × ${fuelPriceUsed} ${fuelPriceUnit} × ${years} år = ${fmt(fuelCost)} kr`
        : fuel === "laddhybrid"
          ? `${consumption} ${fuelUnit} × ${fmt(mileage)} mil/år × ${fuelPriceUsed} ${fuelPriceUnit} × ${years} år = ${fmt(fuelCost)} kr (utan laddning)`
          : `${consumption} ${fuelUnit} × ${fmt(mileage)} mil/år × ${fuelPriceUsed} ${fuelPriceUnit} × ${years} år = ${fmt(fuelCost)} kr`,
      detail: (() => {
        let note = model.consumption_note || `Förbrukning baserad på verkliga ägarrapporter.`
        if (fuel === "el") note += '\n\n❄️ +8% vinterjustering inräknad (genomsnitt helår, baserat på ~5 månaders vinterförhållanden i Sverige).'
        if (fuel === "laddhybrid") note += '\n\n🔌 Beräknad utan regelbunden laddning (konservativt antagande). Med daglig laddning kan drivmedelskostnaden halveras.'
        return note
      })(),
      source: 'Spritmonitor.de — verklig förbrukning från tusentals ägare',
      sourceUrl: 'https://www.spritmonitor.de/',
    },
    tax: {
      formula: `${co2 > 0 ? `CO₂: ${co2} g/km${fuel === 'laddhybrid' ? ' (WLTP)' : ''}. ` : 'Elbil: '}${taxPerYear} kr/år × ${years} år = ${fmt(tax)} kr${buyAge < 3 && co2 > 75 ? ' (inkl. malus första 3 åren)' : ''}`,
      detail: `Grundbelopp 360 kr + ${co2 > 0 ? `22 kr per gram CO₂ (${co2} g/km)` : 'ingen CO₂-avgift (elbil)'}. ${fuel === 'diesel' ? 'Diesel: +250 kr/år miljötillägg. ' : ''}${buyAge < 3 && co2 > 75 ? `Malus-period (3 första åren): extra ${co2 > 125 ? `${107*50 + 132*(co2-125)}` : `${107*(co2-75)}`} kr/år.` : ''}${fuel === 'laddhybrid' ? '\n\n⚠️ Skatten baseras på WLTP-CO₂ (' + co2 + ' g/km), inte verkligt utsläpp (~' + (model.real_co2_gkm || co2) + ' g/km utan laddning).' : ''}`,
      source: 'Skatteverket — fordonsskatteberäkning',
      sourceUrl: 'https://www.skatteverket.se/',
    },
    insurance: {
      formula: `${fmt(insAnnual)} kr/år × ${years} år = ${fmt(insurance.estimate)} kr (spann: ${fmt(insurance.low/years)}–${fmt(insurance.high/years)} kr/år)`,
      detail: `⚠️ Försäkring är den mest osäkra posten. Verklig kostnad beror på din ålder, bostadsort, bonus, körsträcka och val av halv-/helförsäkring. Vårt estimat (${fmt(insAnnual)} kr/år) baseras på genomsnittspriser för ${model.make}-modeller. ${model.insurance_note || ''} Jämför alltid hos minst 3 försäkringsbolag.`,
      source: model.insurance_source || 'Hedvig, Zmarta — genomsnitt per bilmärke. Inte individuell offert!',
      sourceUrl: 'https://www.zmarta.se/forsakring/bilforsakring',
    },
    service: {
      formula: schedule ? `${serviceDetail} = ${fmt(service)} kr totalt` : serviceDetail + ` = ${fmt(service)} kr`,
      detail: model.service_note || `Servicekostnad baserad på auktoriserad verkstad.`,
      source: 'Tillverkarens serviceplan + Carla.se/Teknikens Värld jämförelser',
    },
    tires: {
      formula: `${fmt(model.tireEstimate_kr_per_year || 1500)} kr/år × ${years} år = ${fmt(tires)} kr`,
      detail: `Däckstorlek: ${model.tireSize || '?'}. Inkluderar vinterdäck och sommardäck, byte och förvaring. Elbilsdäck kostar ~50% mer pga högre vikt.`,
      source: 'Branschsnitt baserat på däckstorlek',
    },
    besiktning: besiktning > 0 ? {
      formula: `${besiktning / BESIKTNING_KR} besiktningar × ${BESIKTNING_KR} kr = ${fmt(besiktning)} kr`,
      detail: `Första besiktning vid 3 års ålder, sedan vartannat år. ${BESIKTNING_KR} kr per tillfälle (2024 års pris).`,
      source: 'Bilprovningen / Opus',
    } : null,
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
      besiktning,
      interest: interestCost,
    },
    explanations,
    emissions: {
      total_kg: totalCO2_kg,
      total_ton: +(totalCO2_kg / 1000).toFixed(1),
      social_cost: co2Cost,
      note: realCo2 !== co2 ? `Verkligt CO₂: ~${realCo2} g/km (WLTP: ${co2} g/km)` : null,
    },
  }
}

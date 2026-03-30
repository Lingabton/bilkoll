import { useState, useEffect, useMemo } from 'react'
import './index.css'
import RankingTable from './components/RankingTable'
import CostBreakdown from './components/CostBreakdown'
import DepreciationChart from './components/DepreciationChart'
import Assumptions from './components/Assumptions'
import { recalcTCO } from './utils/tco'

function App() {
  const [models, setModels] = useState([])
  const [details, setDetails] = useState({})  // id → TCO detail
  const [selected, setSelected] = useState(null)
  const [mileage, setMileage] = useState(1500)
  const [years, setYears] = useState(4)
  const [fuelPrice, setFuelPrice] = useState(18.50)
  const [elPrice, setElPrice] = useState(1.50)
  const [insuranceLevel, setInsuranceLevel] = useState(1.0)
  const [buyAge, setBuyAge] = useState(0)
  const [loanPct, setLoanPct] = useState(0)
  const [interestRate, setInterestRate] = useState(5.9)

  // Load summary + models
  useEffect(() => {
    Promise.all([
      fetch('/tco_summary.json').then(r => r.json()),
      fetch('/models.json').then(r => r.json()),
    ]).then(([summary, mods]) => {
      // Merge model data into summary
      const merged = summary.map(s => ({
        ...s,
        ...(mods.find(m => m.id === s.id) || {}),
      }))
      setModels(merged)
    })
  }, [])

  // Load detail when selected
  useEffect(() => {
    if (!selected || details[selected]) return
    fetch(`/${selected}.json`).then(r => r.json()).then(d => {
      setDetails(prev => ({ ...prev, [selected]: d }))
    })
  }, [selected])

  const params = { mileage, years, fuelPrice, elPrice, insuranceLevel, buyAge, loanPct, interestRate: interestRate / 100 }

  // Recalculate all cars with current params
  const recalculated = useMemo(() => {
    return models.map(m => {
      const detail = details[m.id]
      if (!detail) return m
      const result = recalcTCO(detail, m, params)
      if (!result) return m
      return { ...m, monthly_cost: result.monthly, cost_per_mil: result.costPerMil, _recalc: result }
    }).sort((a, b) => a.monthly_cost - b.monthly_cost)
  }, [models, details, mileage, years, fuelPrice, elPrice, insuranceLevel, buyAge, loanPct, interestRate])

  // Preload all details for live recalculation
  useEffect(() => {
    models.forEach(m => {
      if (!details[m.id]) {
        fetch(`/${m.id}.json`).then(r => r.json()).then(d => {
          setDetails(prev => ({ ...prev, [m.id]: d }))
        })
      }
    })
  }, [models])

  const selectedDetail = selected && details[selected]
  const selectedModel = models.find(m => m.id === selected)
  const selectedResult = selectedDetail && selectedModel
    ? recalcTCO(selectedDetail, selectedModel, params)
    : null

  const fuelLabel = { el: "El", hybrid: "Hybrid", bensin: "Bensin", diesel: "Diesel" }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <header className="max-w-3xl mx-auto px-5 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🚗</span>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Bilkoll</h1>
        </div>
        <p className="text-stone-500 text-sm">
          Vad kostar en bil <em>egentligen</em>? Vi räknar ut totalkostnaden per månad — värdeminskning, drivmedel, skatt, försäkring, service och däck.
        </p>
        <p className="text-stone-400 text-xs mt-1">
          Baserat på verkliga begagnatpriser, inte gissningar.
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-5 pb-16">
        {/* Controls */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mt-4">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Dina förutsättningar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Körsträcka</label>
              <input
                type="range" min="500" max="3000" step="100" value={mileage}
                onChange={e => setMileage(Number(e.target.value))}
                className="w-full accent-stone-800"
              />
              <div className="text-sm font-mono text-stone-900 mt-1">{mileage.toLocaleString('sv-SE')} mil/år</div>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Ägartid</label>
              <input
                type="range" min="1" max="8" step="1" value={years}
                onChange={e => setYears(Number(e.target.value))}
                className="w-full accent-stone-800"
              />
              <div className="text-sm font-mono text-stone-900 mt-1">{years} år</div>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Köpa årsmodell</label>
              <input
                type="range" min="0" max="6" step="1" value={buyAge}
                onChange={e => setBuyAge(Number(e.target.value))}
                className="w-full accent-stone-800"
              />
              <div className="text-sm font-mono text-stone-900 mt-1">{buyAge === 0 ? "Ny bil" : `${buyAge} år gammal`}</div>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Bensinpris</label>
              <input
                type="range" min="14" max="28" step="0.50" value={fuelPrice}
                onChange={e => setFuelPrice(Number(e.target.value))}
                className="w-full accent-stone-800"
              />
              <div className="text-sm font-mono text-stone-900 mt-1">{fuelPrice.toFixed(1)} kr/l</div>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Elpris</label>
              <input
                type="range" min="0.50" max="4.00" step="0.10" value={elPrice}
                onChange={e => setElPrice(Number(e.target.value))}
                className="w-full accent-stone-800"
              />
              <div className="text-sm font-mono text-stone-900 mt-1">{elPrice.toFixed(2)} kr/kWh</div>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Försäkringsnivå</label>
              <input
                type="range" min="0.5" max="1.5" step="0.1" value={insuranceLevel}
                onChange={e => setInsuranceLevel(Number(e.target.value))}
                className="w-full accent-stone-800"
              />
              <div className="text-sm font-mono text-stone-900 mt-1">
                {insuranceLevel <= 0.7 ? "Billig" : insuranceLevel >= 1.3 ? "Dyr" : insuranceLevel === 1.0 ? "Medel" : insuranceLevel < 1.0 ? "Under medel" : "Över medel"}
              </div>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Finansiering</label>
              <input
                type="range" min="0" max="100" step="10" value={loanPct}
                onChange={e => setLoanPct(Number(e.target.value))}
                className="w-full accent-stone-800"
              />
              <div className="text-sm font-mono text-stone-900 mt-1">
                {loanPct === 0 ? "Kontant" : `${loanPct}% lån`}
              </div>
            </div>
            {loanPct > 0 && (
              <div>
                <label className="block text-xs text-stone-500 mb-1">Ränta</label>
                <input
                  type="range" min="0" max="12" step="0.1" value={interestRate}
                  onChange={e => setInterestRate(Number(e.target.value))}
                  className="w-full accent-stone-800"
                />
                <div className="text-sm font-mono text-stone-900 mt-1">{interestRate.toFixed(1)}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Ranking */}
        {recalculated.length > 0 && (
          <RankingTable
            cars={recalculated}
            selected={selected}
            onSelect={id => setSelected(selected === id ? null : id)}
            fuelLabel={fuelLabel}
          />
        )}

        {/* Detail view */}
        {selectedResult && selectedDetail && (
          <div className="mt-6 space-y-6">
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <h2 className="text-lg font-semibold text-stone-900 mb-1">
                {selectedModel.make} {selectedModel.model} {selectedModel.variant}
              </h2>
              <p className="text-xs text-stone-400 mb-4">
                {buyAge === 0 ? "Köp ny" : `Köp ${buyAge} år gammal`} · äga {years} år · {mileage.toLocaleString('sv-SE')} mil/år
                {selectedDetail.confidence === "low" && <span className="ml-2 text-amber-500"> · ⚠ Begränsat datamaterial</span>}
              </p>

              <CostBreakdown
                breakdown={selectedResult.breakdown}
                total={selectedResult.total}
                emissions={selectedResult.emissions}
                purchasePrice={selectedResult.purchasePrice}
              />
            </div>

            {selectedDetail.result.depreciation_curve?.length > 1 && (
              <DepreciationChart curve={selectedDetail.result.depreciation_curve} />
            )}
          </div>
        )}

        {/* How it works */}
        <section className="mt-16 text-center">
          <h2 className="text-lg font-semibold text-stone-900 mb-3">Hur räknar vi?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              ["📉", "Värdeminskning", "Verkliga begagnatpriser från tusentals annonser — inte estimat."],
              ["⛽", "Drivmedel", "Aktuellt bränslepris × bilens förbrukning × din körsträcka."],
              ["📋", "Övriga kostnader", "Fordonsskatt (inkl. malus), försäkring, service och däck."],
            ].map(([emoji, title, desc]) => (
              <div key={title} className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="text-xl mb-2">{emoji}</div>
                <div className="text-sm font-semibold text-stone-900">{title}</div>
                <p className="text-xs text-stone-500 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-16 text-center text-xs text-stone-400 space-y-1">
          <p>Bilkoll av Gabriel Linton · Olav Innovation AB</p>
          <p>Prisdata uppdateras veckovis. Försäkringskostnad är ett estimat.</p>
        </footer>
      </main>
    </div>
  )
}

export default App

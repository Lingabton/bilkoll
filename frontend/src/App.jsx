import { useState, useEffect, useMemo } from 'react'
import './index.css'
import RankingTable from './components/RankingTable'
import CostBreakdown from './components/CostBreakdown'
import DepreciationChart from './components/DepreciationChart'
import Assumptions from './components/Assumptions'

function App() {
  const [cars, setCars] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [mileage, setMileage] = useState(1500)
  const [fuelPrice, setFuelPrice] = useState(18.50)
  const [elPrice, setElPrice] = useState(1.50)

  useEffect(() => {
    fetch('/tco_summary.json').then(r => r.json()).then(setCars)
  }, [])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    fetch(`/${selected}.json`).then(r => r.json()).then(setDetail)
  }, [selected])

  const fuelLabel = { el: "El", hybrid: "Hybrid", bensin: "Bensin", diesel: "Diesel" }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* Header */}
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
        {/* Ranking */}
        {cars.length > 0 && (
          <RankingTable
            cars={cars}
            selected={selected}
            onSelect={id => setSelected(selected === id ? null : id)}
            fuelLabel={fuelLabel}
          />
        )}

        {/* Detail view */}
        {detail && (
          <div className="mt-6 space-y-6 animate-in">
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <h2 className="text-lg font-semibold text-stone-900 mb-1">
                {detail.model_id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </h2>
              <p className="text-xs text-stone-400 mb-4">
                Beräknat {detail.assumptions.ownership_years} år, {detail.assumptions.mileage_per_year.toLocaleString('sv-SE')} mil/år
                {detail.confidence === "low" && <span className="ml-2 text-amber-500">⚠ Begränsat datamaterial</span>}
              </p>

              <CostBreakdown breakdown={detail.result.breakdown} total={detail.result.total_cost} />
            </div>

            {detail.result.depreciation_curve?.length > 1 && (
              <DepreciationChart curve={detail.result.depreciation_curve} />
            )}

            <Assumptions detail={detail} />
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

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-stone-400 space-y-1">
          <p>Bilkoll av Gabriel Linton · Olav Innovation AB</p>
          <p>Prisdata uppdateras veckovis. Försäkringskostnad är ett estimat — kontakta ditt försäkringsbolag för exakt pris.</p>
        </footer>
      </main>
    </div>
  )
}

export default App

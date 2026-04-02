import { useState, useEffect, useMemo } from 'react'
import './index.css'
import RankingTable from './components/RankingTable'
import CostBreakdown from './components/CostBreakdown'
import DepreciationChart from './components/DepreciationChart'
import CompareView from './components/CompareView'
import SearchBar from './components/SearchBar'
import CustomCarForm from './components/CustomCarForm'
import { recalcTCO } from './utils/tco'

function Slider({ label, value, min, max, step, format, onChange }) {
  const pct = (value - min) / (max - min)
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <label className="text-[13px] text-slate-500 font-medium">{label}</label>
        <span className="text-[15px] font-mono font-semibold text-slate-900">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
        style={{ '--val': pct }}
      />
    </div>
  )
}

function App() {
  const [models, setModels] = useState([])
  const [details, setDetails] = useState({})
  const [selected, setSelected] = useState(null)
  const [mileage, setMileage] = useState(1500)
  const [years, setYears] = useState(4)
  const [fuelPrice, setFuelPrice] = useState(18.50)
  const [elPrice, setElPrice] = useState(1.50)
  const [insuranceLevel, setInsuranceLevel] = useState(1.0)
  const [buyAge, setBuyAge] = useState(0)
  const [loanPct, setLoanPct] = useState(0)
  const [interestRate, setInterestRate] = useState(5.9)
  const [showSettings, setShowSettings] = useState(false)
  const [compareWith, setCompareWith] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/tco_summary.json').then(r => r.json()),
      fetch('/models.json').then(r => r.json()),
    ]).then(([summary, mods]) => {
      setModels(summary.map(s => ({ ...s, ...(mods.find(m => m.id === s.id) || {}) })))
    })
  }, [])

  useEffect(() => {
    models.forEach(m => {
      if (!details[m.id]) {
        fetch(`/${m.id}.json`).then(r => r.json()).then(d => {
          setDetails(prev => ({ ...prev, [m.id]: d }))
        })
      }
    })
  }, [models])

  const params = { mileage, years, fuelPrice, elPrice, insuranceLevel, buyAge, loanPct, interestRate: interestRate / 100 }

  const recalculated = useMemo(() => {
    return models.map(m => {
      const detail = details[m.id]
      if (!detail) return m
      const result = recalcTCO(detail, m, params)
      if (!result) return m
      return { ...m, monthly_cost: result.monthly, cost_per_mil: result.costPerMil, _recalc: result }
    }).sort((a, b) => a.monthly_cost - b.monthly_cost)
  }, [models, details, mileage, years, fuelPrice, elPrice, insuranceLevel, buyAge, loanPct, interestRate])

  const selectedDetail = selected && details[selected]
  const selectedModel = models.find(m => m.id === selected)
  const selectedResult = selectedDetail && selectedModel ? recalcTCO(selectedDetail, selectedModel, params) : null

  const cheapest = recalculated[0]
  const expensive = recalculated[recalculated.length - 1]
  const diff = cheapest && expensive ? expensive.monthly_cost - cheapest.monthly_cost : 0

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-800 font-sans">

      {/* ═══ HERO ═══ */}
      <div className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-slate-50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-radial from-blue-100/60 via-transparent to-transparent rounded-full blur-3xl" />

        <header className="relative max-w-2xl mx-auto px-6 pt-10 pb-10">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm">
              <span className="text-white font-extrabold text-[11px] tracking-tight">BK</span>
            </div>
            <span className="text-[15px] font-bold text-slate-900 tracking-tight">Bilkoll</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium ml-1">Beta</span>
          </div>

          <h1 className="text-[40px] sm:text-[52px] font-extrabold tracking-tight leading-[1.08] text-slate-900 mb-4">
            Vad kostar bilen<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">egentligen?</span>
          </h1>
          <p className="text-slate-500 text-[17px] leading-relaxed max-w-lg">
            Vi beräknar den verkliga månadskostnaden — värdeminskning, drivmedel, skatt, försäkring — baserat på tusentals begagnatpriser.
          </p>

          {/* Quick stats */}
          {cheapest && expensive && (
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ["Billigast", cheapest.monthly_cost, "text-emerald-600", cheapest.name?.split(' ').slice(0,2).join(' ')],
                ["Dyrast", expensive.monthly_cost, "text-rose-600", expensive.name?.split(' ').slice(0,2).join(' ')],
                ["Skillnad", diff, "text-slate-900", `${(diff * 12).toLocaleString('sv-SE')} kr/år`],
              ].map(([label, val, color, sub]) => (
                <div key={label} className="px-4 py-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</div>
                  <div className={`text-[22px] font-mono font-bold ${color} mt-0.5 tabular-nums`}>
                    {val.toLocaleString('sv-SE')}
                    <span className="text-[11px] font-normal text-slate-400 ml-1">kr/mån</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          )}
        </header>
      </div>

      <main className="max-w-2xl mx-auto px-6 pb-20 pt-8">

        {/* ═══ SETTINGS ═══ */}
        <div className="mb-8">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer font-medium"
          >
            <svg className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Anpassa beräkning
            <span className="text-[11px] text-slate-400 font-normal">
              {mileage.toLocaleString('sv-SE')} mil/år · {years} år · {buyAge === 0 ? 'ny bil' : `${buyAge} år gammal`}
            </span>
          </button>

          {showSettings && (
            <div className="mt-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm animate-slide-up">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Slider label="Körsträcka" value={mileage} min={500} max={3000} step={100}
                  format={v => `${v.toLocaleString('sv-SE')} mil/år`} onChange={setMileage} />
                <Slider label="Ägartid" value={years} min={1} max={8} step={1}
                  format={v => `${v} år`} onChange={setYears} />
                <Slider label="Köpa årsmodell" value={buyAge} min={0} max={6} step={1}
                  format={v => v === 0 ? 'Ny bil' : `${v} år gammal`} onChange={setBuyAge} />
                <Slider label="Bensinpris" value={fuelPrice} min={14} max={28} step={0.5}
                  format={v => `${v.toFixed(1)} kr/l`} onChange={setFuelPrice} />
                <Slider label="Elpris" value={elPrice} min={0.5} max={4} step={0.1}
                  format={v => `${v.toFixed(2)} kr/kWh`} onChange={setElPrice} />
                <Slider label="Försäkringsnivå" value={insuranceLevel} min={0.5} max={1.5} step={0.1}
                  format={v => v <= 0.7 ? 'Billig' : v >= 1.3 ? 'Dyr' : v < 1.0 ? 'Under medel' : v > 1.0 ? 'Över medel' : 'Medel'}
                  onChange={setInsuranceLevel} />
                <Slider label="Finansiering" value={loanPct} min={0} max={100} step={10}
                  format={v => v === 0 ? 'Kontant' : `${v}% lån`} onChange={setLoanPct} />
                {loanPct > 0 && (
                  <Slider label="Ränta" value={interestRate} min={0} max={12} step={0.1}
                    format={v => `${v.toFixed(1)}%`} onChange={setInterestRate} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ CUSTOM CAR ═══ */}
        {recalculated.length > 0 && (
          <div className="mb-8">
            <CustomCarForm models={recalculated} details={details} params={params} />
          </div>
        )}

        {/* ═══ SEARCH ═══ */}
        {recalculated.length > 0 && (
          <div className="mb-6">
            <SearchBar cars={recalculated} onSelect={id => { setSelected(id); setCompareWith(null) }} />
          </div>
        )}

        {/* ═══ RANKING ═══ */}
        {recalculated.length > 0 && (
          <RankingTable
            cars={recalculated}
            selected={selected}
            onSelect={id => setSelected(selected === id ? null : id)}
          />
        )}

        {/* ═══ DETAIL ═══ */}
        {selectedResult && selectedDetail && selectedModel && (
          <div className="mt-6 space-y-4 animate-slide-up">
            {/* Big number */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-xl">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-radial from-blue-400/10 to-transparent rounded-full blur-2xl" />
              <div className="relative">
                <div className="text-sm text-slate-400 mb-2">{selectedModel.make} {selectedModel.model} {selectedModel.variant}</div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[60px] font-mono font-black text-white leading-none tracking-tighter tabular-nums">
                    {selectedResult.monthly.toLocaleString('sv-SE')}
                  </span>
                  <span className="text-xl text-slate-400 font-medium">kr/mån</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400 mt-2">
                  <span><span className="font-mono text-slate-200">{selectedResult.costPerMil}</span> kr/mil</span>
                  <span><span className="font-mono text-slate-200">{selectedResult.total.toLocaleString('sv-SE')}</span> kr totalt</span>
                  <span>{buyAge === 0 ? 'Ny' : `${buyAge} år`} · {years} år · {mileage.toLocaleString('sv-SE')} mil/år</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {/* Compare */}
              <div className="flex-1 relative">
                {compareWith ? (
                  <button onClick={() => setCompareWith(null)}
                    className="w-full text-sm py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-600">
                    Avsluta jämförelse
                  </button>
                ) : (
                  <select
                    value=""
                    onChange={e => setCompareWith(e.target.value)}
                    className="w-full text-sm py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-600 appearance-none"
                  >
                    <option value="" disabled>Jämför med...</option>
                    {recalculated.filter(c => c.id !== selected).map(c => (
                      <option key={c.id} value={c.id}>{c.make} {c.model} — {c.monthly_cost.toLocaleString('sv-SE')} kr/mån</option>
                    ))}
                  </select>
                )}
              </div>
              {/* Share */}
              <button onClick={() => {
                const text = `${selectedModel.make} ${selectedModel.model} kostar ${selectedResult.monthly.toLocaleString('sv-SE')} kr/mån att äga (${years} år, ${mileage.toLocaleString('sv-SE')} mil/år). Kolla din bil på bilkoll.se`
                if (navigator.share) navigator.share({ title: 'Bilkoll', text }).catch(() => {})
                else navigator.clipboard?.writeText(text)
              }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-500 text-sm"
              >
                Dela ↗
              </button>
            </div>

            {/* Compare view */}
            {compareWith && (() => {
              const carB = recalculated.find(c => c.id === compareWith)
              const detailB = details[compareWith]
              if (!carB || !detailB) return null
              return <CompareView carA={selectedModel} carB={carB} detailA={selectedDetail} detailB={detailB} params={params} />
            })()}

            {/* Breakdown */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-5">Kostnadsfördelning</h3>
              <CostBreakdown
                breakdown={selectedResult.breakdown}
                total={selectedResult.total}
                emissions={selectedResult.emissions}
                purchasePrice={selectedResult.purchasePrice}
                years={years}
                explanations={selectedResult.explanations}
              />
            </div>

            {/* Depreciation */}
            {selectedDetail.result.depreciation_curve?.length > 1 && (
              <DepreciationChart curve={selectedDetail.result.depreciation_curve} />
            )}
          </div>
        )}

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="mt-20">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Hur vi räknar</h2>
            <p className="text-sm text-slate-400">Ingen magi. Bara data.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              ["Värdeminskning", "Verkliga begagnatpriser från tusentals annonser — inte schabloner.", "from-rose-50 to-white", "text-rose-600", "border-rose-100"],
              ["Drivmedel", "Aktuellt bensin- och elpris multiplicerat med bilens faktiska förbrukning.", "from-amber-50 to-white", "text-amber-600", "border-amber-100"],
              ["Skatt + Försäkring + Service", "Fordonsskatt inkl. malus, modellspecifik försäkring, verkstadskostnader och däck.", "from-blue-50 to-white", "text-blue-600", "border-blue-100"],
            ].map(([title, desc, gradient, textColor, border]) => (
              <div key={title} className={`rounded-2xl bg-gradient-to-b ${gradient} border ${border} p-5 shadow-sm`}>
                <div className={`text-sm font-bold ${textColor} mb-2`}>{title}</div>
                <p className="text-[13px] text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ DATA SOURCE ═══ */}
        <section className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-[11px] text-slate-500 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Nybilspriser: Skatteverket SKVFS 2025:29. Begagnatpriser: AutoUncle. Uppdateras veckovis.
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="mt-16 pt-8 border-t border-slate-200 text-center space-y-2">
          <p className="text-xs text-slate-400">Bilkoll av Gabriel Linton &middot; Olav Innovation AB</p>
          <p className="text-[10px] text-slate-300">Alla beräkningar är ungefärliga. Försäkringskostnad baseras på modellsegment, inte individuell offert.</p>
        </footer>
      </main>
    </div>
  )
}

export default App

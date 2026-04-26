import { useState, useEffect, useMemo, useCallback } from 'react'
import './index.css'
import RankingTable from './components/RankingTable'
import CostBreakdown from './components/CostBreakdown'
import DepreciationChart from './components/DepreciationChart'
import CompareView from './components/CompareView'
import SearchBar from './components/SearchBar'
import CustomCarForm from './components/CustomCarForm'
import { recalcTCO } from './utils/tco'

const DEFAULTS = { mileage: 1500, years: 4, fuelPrice: 18.50, elPrice: 1.50, insuranceLevel: 1.0, buyAge: 0, loanPct: 0, interestRate: 5.9 }

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('bilkoll_settings'))
    return s ? { ...DEFAULTS, ...s } : DEFAULTS
  } catch { return DEFAULTS }
}

function Slider({ label, value, min, max, step, format, onChange, id }) {
  const pct = (value - min) / (max - min)
  const formatted = format(value)
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <label htmlFor={id} className="text-[13px] text-slate-500 font-medium">{label}</label>
        <span className="text-[15px] font-mono font-semibold text-slate-900">{formatted}</span>
      </div>
      <input
        id={id}
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={formatted}
        className="w-full"
        style={{ '--val': pct }}
      />
    </div>
  )
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-lg animate-slide-up">
      {message}
    </div>
  )
}

function App() {
  const init = loadSettings()
  const [models, setModels] = useState([])
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [mileage, setMileage] = useState(init.mileage)
  const [years, setYears] = useState(init.years)
  const [fuelPrice, setFuelPrice] = useState(init.fuelPrice)
  const [elPrice, setElPrice] = useState(init.elPrice)
  const [insuranceLevel, setInsuranceLevel] = useState(init.insuranceLevel)
  const [buyAge, setBuyAge] = useState(init.buyAge)
  const [loanPct, setLoanPct] = useState(init.loanPct)
  const [interestRate, setInterestRate] = useState(init.interestRate)
  const [showSettings, setShowSettings] = useState(false)
  const [compareWith, setCompareWith] = useState(null)
  const [toast, setToast] = useState(null)
  const [fuelFilter, setFuelFilter] = useState('alla')

  // Persist settings
  useEffect(() => {
    const s = { mileage, years, fuelPrice, elPrice, insuranceLevel, buyAge, loanPct, interestRate }
    localStorage.setItem('bilkoll_settings', JSON.stringify(s))
  }, [mileage, years, fuelPrice, elPrice, insuranceLevel, buyAge, loanPct, interestRate])

  // Update page title
  useEffect(() => {
    if (selected && models.length) {
      const m = models.find(m => m.id === selected)
      if (m) document.title = `${m.make} ${m.model} — ${m.monthly_cost?.toLocaleString('sv-SE')} kr/mån | Bilkoll`
    } else {
      document.title = 'Bilkoll — Vad kostar bilen egentligen?'
    }
  }, [selected, models])

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}tco_summary.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}models.json`).then(r => r.json()),
    ]).then(([summary, mods]) => {
      setModels(summary.map(s => ({ ...s, ...(mods.find(m => m.id === s.id) || {}) })))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    models.forEach(m => {
      if (!details[m.id]) {
        fetch(`${import.meta.env.BASE_URL}${m.id}.json`).then(r => r.json()).then(d => {
          setDetails(prev => ({ ...prev, [m.id]: d }))
        }).catch(() => {})
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
  const selectedResult = useMemo(() => {
    return selectedDetail && selectedModel ? recalcTCO(selectedDetail, selectedModel, params) : null
  }, [selectedDetail, selectedModel, mileage, years, fuelPrice, elPrice, insuranceLevel, buyAge, loanPct, interestRate])

  const cheapest = recalculated[0]
  const expensive = recalculated[recalculated.length - 1]
  const diff = cheapest && expensive ? expensive.monthly_cost - cheapest.monthly_cost : 0

  const isDefault = mileage === DEFAULTS.mileage && years === DEFAULTS.years && buyAge === DEFAULTS.buyAge && fuelPrice === DEFAULTS.fuelPrice && elPrice === DEFAULTS.elPrice && insuranceLevel === DEFAULTS.insuranceLevel && loanPct === DEFAULTS.loanPct

  const resetSettings = useCallback(() => {
    setMileage(DEFAULTS.mileage); setYears(DEFAULTS.years); setFuelPrice(DEFAULTS.fuelPrice)
    setElPrice(DEFAULTS.elPrice); setInsuranceLevel(DEFAULTS.insuranceLevel); setBuyAge(DEFAULTS.buyAge)
    setLoanPct(DEFAULTS.loanPct); setInterestRate(DEFAULTS.interestRate)
  }, [])

  const handleShare = useCallback(() => {
    const text = `${selectedModel.make} ${selectedModel.model} kostar ${selectedResult.monthly.toLocaleString('sv-SE')} kr/mån att äga (${years} år, ${mileage.toLocaleString('sv-SE')} mil/år). Kolla din bil på bilkoll.se`
    if (navigator.share) {
      navigator.share({ title: 'Bilkoll', text }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(text)
      setToast('Kopierat till urklipp!')
    }
  }, [selectedModel, selectedResult, years, mileage])

  // Get confidence info for selected model
  const selectedConfidence = selectedDetail?.confidence
  const selectedDataPoints = selectedDetail?.result?.depreciation_curve?.filter(p => p.data_points > 0).reduce((s, p) => s + p.data_points, 0) || 0
  const isPlaceholder = selectedDetail?.source === 'estimated_placeholder' || selectedDetail?.price_type === 'estimated_placeholder'

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-800 font-sans">

      {/* ═══ HERO ═══ */}
      <div className="relative overflow-hidden border-b border-slate-200">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-slate-50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-radial from-blue-100/60 via-transparent to-transparent rounded-full blur-3xl" />

        <header className="relative max-w-2xl mx-auto px-5 pt-8 pb-8 sm:px-6 sm:pt-10 sm:pb-10">
          <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm">
              <span className="text-white font-extrabold text-[11px] tracking-tight">BK</span>
            </div>
            <span className="text-[15px] font-bold text-slate-900 tracking-tight">Bilkoll</span>
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium ml-1">Beta</span>
          </div>

          <h1 className="font-display text-[36px] sm:text-[52px] font-bold tracking-tight leading-[1.08] text-slate-900 mb-3 sm:mb-4">
            Vad kostar bilen<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-400">egentligen?</span>
          </h1>
          <p className="text-slate-500 text-[15px] sm:text-[17px] leading-relaxed max-w-lg">
            Verklig månadskostnad för {models.length || '...'} bilmodeller — värdeminskning, drivmedel, skatt, försäkring — baserat på tusentals begagnatpriser.
          </p>

          {/* Quick stats — asymmetric layout */}
          {cheapest && expensive && (
            <div className="mt-6 sm:mt-8">
              <div className="grid grid-cols-[1fr_auto] gap-3 sm:gap-4">
                {/* Winner — large card */}
                <div className="px-5 py-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-white border border-emerald-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-3 right-3 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    #1 billigast
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium mb-1">Billigast att äga</div>
                  <div className="font-mono text-[32px] sm:text-[38px] font-black text-emerald-700 leading-none tabular-nums tracking-tight">
                    {cheapest.monthly_cost.toLocaleString('sv-SE')}
                    <span className="text-[14px] font-normal text-emerald-500 ml-1">kr/mån</span>
                  </div>
                  <div className="text-[13px] text-slate-600 mt-1.5 font-medium">{cheapest.name?.split(' ').slice(0,2).join(' ')}</div>
                </div>

                {/* Right column — stacked small cards */}
                <div className="flex flex-col gap-2 sm:gap-3 min-w-[130px]">
                  <div className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm flex-1 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-400 font-medium">Dyrast</div>
                    <div className="font-mono text-[16px] font-bold text-rose-500 tabular-nums">{expensive.monthly_cost.toLocaleString('sv-SE')} <span className="text-[10px] font-normal text-slate-400">kr/mån</span></div>
                    <div className="text-[10px] text-slate-400 truncate">{expensive.name?.split(' ').slice(0,2).join(' ')}</div>
                  </div>
                  <div className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm flex-1 flex flex-col justify-center">
                    <div className="text-[10px] text-slate-400 font-medium">Skillnad</div>
                    <div className="font-mono text-[16px] font-bold text-slate-900 tabular-nums">{diff.toLocaleString('sv-SE')} <span className="text-[10px] font-normal text-slate-400">kr/mån</span></div>
                    <div className="text-[10px] text-slate-400">{(diff * 12).toLocaleString('sv-SE')} kr/år</div>
                  </div>
                </div>
              </div>
              <div className="mt-2.5 text-[11px] text-slate-400 text-center">
                {years} års ägande · {mileage.toLocaleString('sv-SE')} mil/år · {buyAge === 0 ? 'köpt ny' : `${buyAge} år gammal`} · {recalculated.length} modeller
              </div>
            </div>
          )}
        </header>
      </div>

      <main className="max-w-2xl mx-auto px-5 sm:px-6 pb-20 pt-6 sm:pt-8">

        {/* ═══ SETTINGS ═══ */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer font-medium"
              aria-expanded={showSettings}
              aria-controls="settings-panel"
            >
              <svg className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Anpassa beräkning
              <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                {mileage.toLocaleString('sv-SE')} mil/år · {years} år · {buyAge === 0 ? 'ny bil' : `${buyAge} år gammal`}
              </span>
            </button>
            {!isDefault && (
              <button onClick={resetSettings}
                className="text-[11px] text-sky-500 hover:text-sky-700 cursor-pointer font-medium ml-auto">
                Återställ
              </button>
            )}
          </div>

          {showSettings && (
            <div id="settings-panel" className="mt-4 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm animate-slide-up" role="region" aria-label="Beräkningsinställningar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
                <Slider id="s-mil" label="Körsträcka" value={mileage} min={500} max={3000} step={100}
                  format={v => `${v.toLocaleString('sv-SE')} mil/år`} onChange={setMileage} />
                <Slider id="s-yr" label="Ägartid" value={years} min={1} max={8} step={1}
                  format={v => `${v} år`} onChange={setYears} />
                <Slider id="s-age" label="Köpa årsmodell" value={buyAge} min={0} max={6} step={1}
                  format={v => v === 0 ? 'Ny bil' : `${v} år gammal`} onChange={setBuyAge} />
                <Slider id="s-fuel" label="Bensinpris" value={fuelPrice} min={14} max={28} step={0.5}
                  format={v => `${v.toFixed(1)} kr/l`} onChange={setFuelPrice} />
                <Slider id="s-el" label="Elpris" value={elPrice} min={0.5} max={4} step={0.1}
                  format={v => `${v.toFixed(2)} kr/kWh`} onChange={setElPrice} />
                <Slider id="s-ins" label="Försäkringsnivå" value={insuranceLevel} min={0.5} max={1.5} step={0.1}
                  format={v => v <= 0.7 ? 'Billig' : v >= 1.3 ? 'Dyr' : v < 1.0 ? 'Under medel' : v > 1.0 ? 'Över medel' : 'Medel'}
                  onChange={setInsuranceLevel} />
                <Slider id="s-loan" label="Finansiering" value={loanPct} min={0} max={100} step={10}
                  format={v => v === 0 ? 'Kontant' : `${v}% lån`} onChange={setLoanPct} />
                {loanPct > 0 && (
                  <Slider id="s-rate" label="Ränta" value={interestRate} min={0} max={12} step={0.1}
                    format={v => `${v.toFixed(1)}%`} onChange={setInterestRate} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ LOADING ═══ */}
        {loading && (
          <div className="text-center py-12 text-slate-400 text-sm animate-fade-in">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-sky-500 rounded-full animate-spin mx-auto mb-3" />
            Laddar bildata...
          </div>
        )}

        {/* ═══ SEARCH ═══ */}
        {recalculated.length > 0 && (
          <div className="mb-5 sm:mb-6">
            <SearchBar cars={recalculated} onSelect={id => { setSelected(id); setCompareWith(null) }} />
          </div>
        )}

        {/* ═══ FILTER + RANKING ═══ */}
        {recalculated.length > 0 && (
          <>
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1" role="radiogroup" aria-label="Filtrera drivlina">
              {[
                ['alla', 'Alla'],
                ['el', 'El'],
                ['hybrid', 'Hybrid'],
                ['bensin', 'Bensin'],
                ['laddhybrid', 'PHEV'],
                ['diesel', 'Diesel'],
              ].map(([val, label]) => {
                const count = val === 'alla' ? recalculated.length : recalculated.filter(c => c.fuel === val).length
                if (val !== 'alla' && count === 0) return null
                return (
                  <button key={val} role="radio" aria-checked={fuelFilter === val}
                    onClick={() => setFuelFilter(val)}
                    className={`shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      fuelFilter === val
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}>
                    {label} <span className="text-[10px] opacity-60">{count}</span>
                  </button>
                )
              })}
            </div>
            <RankingTable
              cars={fuelFilter === 'alla' ? recalculated : recalculated.filter(c => c.fuel === fuelFilter)}
              selected={selected}
              onSelect={id => setSelected(selected === id ? null : id)}
            />
          </>
        )}

        {/* ═══ DETAIL ═══ */}
        {selectedResult && selectedDetail && selectedModel && (
          <div className="mt-5 sm:mt-6 space-y-4 animate-slide-up" role="region" aria-label={`Detaljer för ${selectedModel.make} ${selectedModel.model}`}>

            {/* Placeholder warning */}
            {isPlaceholder && (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-800 flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                <span><strong>Estimerad data.</strong> Värdeminskningen för denna modell baseras på schabloner, inte verkliga begagnatpriser. Siffrorna kan avvika 20–40% från verkligheten.</span>
              </div>
            )}

            {/* Big number */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 shadow-xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500" />
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-radial from-sky-400/10 to-transparent rounded-full blur-2xl" />
              <div className="relative">
                {/* Close button */}
                <button onClick={() => setSelected(null)} className="absolute top-0 right-0 text-slate-500 hover:text-white transition-colors cursor-pointer p-1" aria-label="Stäng detaljer">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="text-sm text-slate-400 mb-2">{selectedModel.make} {selectedModel.model} <span className="text-slate-500">{selectedModel.variant}</span></div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[48px] sm:text-[60px] font-mono font-black text-white leading-none tracking-tighter tabular-nums animate-count-up">
                    {selectedResult.monthly.toLocaleString('sv-SE')}
                  </span>
                  <span className="text-lg sm:text-xl text-slate-400 font-medium">kr/mån</span>
                </div>
                <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 text-[13px] sm:text-sm text-slate-400 mt-2">
                  <span><span className="font-mono text-slate-200">{selectedResult.costPerMil}</span> kr/mil</span>
                  <span><span className="font-mono text-slate-200">{selectedResult.total.toLocaleString('sv-SE')}</span> kr totalt</span>
                  <span>{buyAge === 0 ? 'Ny' : `${buyAge} år`} · {years} år · {mileage.toLocaleString('sv-SE')} mil/år</span>
                </div>

                {/* Confidence indicator */}
                {selectedDataPoints > 0 && !isPlaceholder && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedConfidence === 'high' ? 'bg-emerald-400' : selectedConfidence === 'medium' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                    <span className="text-slate-500">Baserat på {selectedDataPoints.toLocaleString('sv-SE')} begagnatannonser</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[140px] relative">
                {compareWith ? (
                  <button onClick={() => setCompareWith(null)}
                    className="w-full text-sm py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-600">
                    ✕ Avsluta jämförelse
                  </button>
                ) : (
                  <select
                    value=""
                    onChange={e => setCompareWith(e.target.value)}
                    aria-label="Jämför med annan bil"
                    className="w-full text-sm py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-600 appearance-none"
                  >
                    <option value="" disabled>Jämför med...</option>
                    {recalculated.filter(c => c.id !== selected).map(c => (
                      <option key={c.id} value={c.id}>{c.make} {c.model} — {c.monthly_cost.toLocaleString('sv-SE')} kr/mån</option>
                    ))}
                  </select>
                )}
              </div>
              <a
                href={`https://www.autouncle.se/se/begagnade-bilar/${selectedModel.autouncle_filters?.url_path || ''}`}
                target="_blank" rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 transition-colors text-white text-sm font-medium text-center"
              >
                Hitta begagnad →
              </a>
              <button onClick={handleShare}
                aria-label="Dela bilkostnad"
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
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-5 font-display">Kostnadsfördelning</h3>
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

        {/* ═══ CUSTOM CAR ═══ */}
        {recalculated.length > 0 && (
          <div className="mt-10 sm:mt-12">
            <CustomCarForm models={recalculated} details={details} params={params} />
          </div>
        )}

        {/* ═══ HOW IT WORKS ═══ */}
        <section className="mt-16 sm:mt-20">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="font-display text-xl font-bold text-slate-900 mb-2">Hur vi räknar</h2>
            <p className="text-sm text-slate-400">Ingen magi. Bara data.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              ["Värdeminskning", "Verkliga begagnatpriser från tusentals annonser — inte schabloner. Justerade 7% från utropspris till uppskattad köpeskilling.", "from-rose-50 to-white", "text-rose-500", "border-rose-100"],
              ["Drivmedel", "Verklig förbrukning från Spritmonitor, inte tillverkarens WLTP. Elbilar inkluderar 8% vinterjustering.", "from-amber-50 to-white", "text-amber-500", "border-amber-100"],
              ["Skatt + Försäkring + Service", "Fordonsskatt inkl. malus, modellspecifik försäkring (intervall), verkstadskostnader, däck och besiktning.", "from-sky-50 to-white", "text-sky-500", "border-sky-100"],
            ].map(([title, desc, gradient, textColor, border]) => (
              <div key={title} className={`rounded-2xl bg-gradient-to-b ${gradient} border ${border} p-5 shadow-sm`}>
                <div className={`text-sm font-bold ${textColor} mb-2 font-display`}>{title}</div>
                <p className="text-[13px] text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ WHAT'S NOT INCLUDED ═══ */}
        <section className="mt-8 p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-3 font-display">Vad ingår inte?</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[12px] text-slate-500">
            {["Parkering", "Tvätt & vård", "Trängselskatt", "Laddbox (EV)", "Batteriersättning", "Tillbehör"].map(item => (
              <div key={item} className="flex items-center gap-1.5">
                <span className="text-slate-300">—</span> {item}
              </div>
            ))}
          </div>
        </section>

        {/* ═══ DATA SOURCE ═══ */}
        <section className="mt-8 sm:mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-[11px] text-slate-500 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {recalculated.length} modeller · Nybilspriser: Skatteverket · Begagnatpriser: AutoUncle · Förbrukning: Spritmonitor
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-200 text-center space-y-2">
          <p className="text-xs text-slate-400">Bilkoll av Gabriel Linton &middot; Olav Innovation AB</p>
          <p className="text-[10px] text-slate-300">Alla beräkningar är ungefärliga. Försäkringskostnad baseras på modellgenomsnitt, inte individuell offert. Värdeminskning baserad på utropspriser justerade −7%.</p>
        </footer>
      </main>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

export default App

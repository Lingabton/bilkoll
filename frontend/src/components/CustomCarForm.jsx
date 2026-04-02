import { useState, useMemo } from 'react'
import { recalcTCO } from '../utils/tco'

export default function CustomCarForm({ models, details, params, onResult }) {
  const [askingPrice, setAskingPrice] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [carAge, setCarAge] = useState(3)
  const [result, setResult] = useState(null)

  const sortedModels = useMemo(() =>
    [...models].sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`))
  , [models])

  const handleCalculate = () => {
    const price = parseInt(askingPrice.replace(/\s/g, ''))
    if (!price || !selectedModel) return

    const model = models.find(m => m.id === selectedModel)
    const detail = details[selectedModel]
    if (!model || !detail) return

    // Calculate TCO with the actual asking price and car age
    const tco = recalcTCO(detail, model, {
      ...params,
      buyAge: carAge,
      purchasePriceOverride: price,
    })

    if (!tco) return

    // Also calculate what it would cost buying new for comparison
    const newTco = recalcTCO(detail, model, { ...params, buyAge: 0 })

    setResult({
      tco,
      model,
      price,
      carAge,
      newComparison: newTco,
    })

    if (onResult) onResult({ tco, model, price, carAge })
  }

  const fuelLabel = { el: 'El', hybrid: 'Hybrid', bensin: 'Bensin', diesel: 'Diesel' }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <span className="text-white text-lg">🔍</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Kolla en specifik bil</h2>
            <p className="text-[13px] text-slate-500">Hittat en begagnad bil? Se vad den kostar att äga.</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Model selector */}
          <div>
            <label className="block text-[13px] text-slate-500 font-medium mb-1.5">Vilken bil?</label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all cursor-pointer appearance-none"
            >
              <option value="">Välj märke och modell...</option>
              {sortedModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.make} {m.model} {m.variant} ({fuelLabel[m.fuel] || m.fuel})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Asking price */}
            <div>
              <label className="block text-[13px] text-slate-500 font-medium mb-1.5">Begärt pris (kr)</label>
              <input
                type="text"
                value={askingPrice}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '')
                  setAskingPrice(raw ? parseInt(raw).toLocaleString('sv-SE') : '')
                }}
                placeholder="t.ex. 250 000"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all font-mono"
              />
            </div>

            {/* Car age */}
            <div>
              <label className="block text-[13px] text-slate-500 font-medium mb-1.5">Årsmodell</label>
              <select
                value={carAge}
                onChange={e => setCarAge(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all cursor-pointer appearance-none"
              >
                {[0,1,2,3,4,5,6,7,8].map(age => (
                  <option key={age} value={age}>
                    {age === 0 ? `${new Date().getFullYear()} (ny)` : `${new Date().getFullYear() - age} (${age} år)`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={!selectedModel || !askingPrice}
            className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Räkna ut månadskostnad
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="border-t border-slate-200 bg-slate-50/50 p-6 animate-slide-up">
          <div className="text-center mb-4">
            <div className="text-sm text-slate-500 mb-1">
              {result.model.make} {result.model.model} · {new Date().getFullYear() - result.carAge} · {result.price.toLocaleString('sv-SE')} kr
            </div>
            <div className="font-mono text-[40px] font-black text-slate-900 leading-none">
              {result.tco.monthly.toLocaleString('sv-SE')}
              <span className="text-lg text-slate-400 font-medium ml-1">kr/mån</span>
            </div>
            <div className="text-sm text-slate-500 mt-2">
              {result.tco.costPerMil} kr/mil · {result.tco.total.toLocaleString('sv-SE')} kr totalt ({params.years} år)
            </div>
          </div>

          {/* Breakdown mini */}
          <div className="space-y-1.5 mb-4">
            {[
              ['Värdeminskning', result.tco.breakdown.depreciation],
              ['Drivmedel', result.tco.breakdown.fuel],
              ['Skatt', result.tco.breakdown.tax],
              ['Försäkring', result.tco.breakdown.insurance?.estimate],
              ['Service', result.tco.breakdown.service],
              ['Däck', result.tco.breakdown.tires],
            ].filter(([_, v]) => v > 0).map(([label, val]) => (
              <div key={label} className="flex justify-between text-[13px]">
                <span className="text-slate-500">{label}</span>
                <span className="font-mono text-slate-700 tabular-nums">
                  {Math.round(val / (params.years * 12)).toLocaleString('sv-SE')} kr/mån
                </span>
              </div>
            ))}
          </div>

          {/* Comparison to buying new */}
          {result.newComparison && (
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-center">
              <div className="text-[11px] text-slate-400 mb-1">Jämfört med att köpa ny</div>
              {result.tco.monthly < result.newComparison.monthly ? (
                <div className="text-sm text-emerald-600 font-semibold">
                  {(result.newComparison.monthly - result.tco.monthly).toLocaleString('sv-SE')} kr/mån billigare som begagnad
                </div>
              ) : (
                <div className="text-sm text-rose-500 font-semibold">
                  {(result.tco.monthly - result.newComparison.monthly).toLocaleString('sv-SE')} kr/mån dyrare (ovanligt!)
                </div>
              )}
              <div className="text-[11px] text-slate-400 mt-0.5">
                Ny: {result.newComparison.monthly.toLocaleString('sv-SE')} kr/mån ({result.model.newPrice.toLocaleString('sv-SE')} kr)
              </div>
            </div>
          )}

          {/* Service/insurance notes */}
          {(result.model.service_note || result.model.insurance_note) && (
            <div className="mt-3 space-y-1.5">
              {result.model.service_note && (
                <div className="text-[11px] text-slate-400 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  💡 {result.model.service_note}
                </div>
              )}
              {result.model.insurance_note && (
                <div className="text-[11px] text-slate-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  🛡️ {result.model.insurance_note}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

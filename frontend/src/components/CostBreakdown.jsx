import { useState } from 'react'

const CATEGORIES = [
  { key: "depreciation", label: "Värdeminskning", color: "#e11d48" },
  { key: "fuel", label: "Drivmedel", color: "#d97706" },
  { key: "interest", label: "Ränta", color: "#7c3aed" },
  { key: "tax", label: "Skatt", color: "#2563eb" },
  { key: "insurance", label: "Försäkring", color: "#9333ea", isRange: true },
  { key: "service", label: "Service", color: "#0d9488" },
  { key: "tires", label: "Däck", color: "#64748b" },
  { key: "besiktning", label: "Besiktning", color: "#a1a1aa" },
]

export default function CostBreakdown({ breakdown, total, emissions, purchasePrice, years = 4, explanations = {} }) {
  const [expanded, setExpanded] = useState(null)
  const months = years * 12

  const active = CATEGORIES.filter(({ key }) => {
    const val = key === "insurance" ? breakdown[key]?.estimate : breakdown[key]
    return val && val > 0
  })

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-3 mb-6 bg-slate-100">
        {active.map(({ key, color }) => {
          const val = key === "insurance" ? breakdown[key]?.estimate : breakdown[key]
          return (
            <div key={key} className="transition-all duration-500" style={{ width: `${(val / total) * 100}%`, backgroundColor: color }} />
          )
        })}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3 text-[11px] text-slate-400">
        <div className="w-2.5" />
        <span className="flex-1" />
        <span className="w-10 text-right"></span>
        <span className="w-20 text-right">per mån</span>
        <span className="w-28 text-right">totalt ({years} år)</span>
      </div>

      {/* Rows */}
      <div className="space-y-0.5">
        {active.map(({ key, label, color, isRange }) => {
          const val = isRange ? breakdown[key]?.estimate : breakdown[key]
          const pct = Math.round((val / total) * 100)
          const perMonth = Math.round(val / months)
          const isOpen = expanded === key
          const expl = explanations[key]

          return (
            <div key={key}>
              <button
                onClick={() => setExpanded(isOpen ? null : key)}
                className="w-full flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[13px] text-slate-600 flex-1 flex items-center gap-1.5">
                  {label}
                  {expl && (
                    <svg className={`w-3 h-3 text-slate-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </span>
                <span className="text-[11px] text-slate-400 w-10 text-right tabular-nums">{pct}%</span>
                <span className="font-mono text-[12px] text-slate-500 w-20 text-right tabular-nums">
                  {perMonth.toLocaleString('sv-SE')} kr
                </span>
                <span className="font-mono text-[13px] text-slate-900 w-28 text-right tabular-nums font-medium">
                  {val.toLocaleString('sv-SE')} kr
                </span>
              </button>

              {/* Expanded explanation */}
              {isOpen && expl && (
                <div className="ml-[22px] mr-2 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-100 animate-slide-up">
                  {/* Formula */}
                  <div className="font-mono text-[11px] text-slate-700 bg-white rounded px-2.5 py-1.5 border border-slate-200 mb-2">
                    {expl.formula}
                  </div>
                  {/* Detail */}
                  <p className="text-[12px] text-slate-500 leading-relaxed mb-2">
                    {expl.detail}
                  </p>
                  {/* Source */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Källa:</span>
                    {expl.sourceUrl ? (
                      <a href={expl.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 underline underline-offset-2">
                        {expl.source}
                      </a>
                    ) : (
                      <span className="text-slate-500">{expl.source}</span>
                    )}
                  </div>
                  {/* Contextual CTA */}
                  {key === 'insurance' && (
                    <a href="https://www.zmarta.se/forsakring/bilforsakring" target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-sky-600 hover:text-sky-800 font-medium">
                      Jämför försäkringspriser hos Zmarta →
                    </a>
                  )}
                  {key === 'interest' && (
                    <a href="https://www.lendo.se/billan" target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-sky-600 hover:text-sky-800 font-medium">
                      Jämför billån hos Lendo →
                    </a>
                  )}
                  {key === 'tires' && (
                    <a href="https://www.dackia.se/" target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-sky-600 hover:text-sky-800 font-medium">
                      Boka däckbyte hos Däckia →
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Insurance range note */}
      {breakdown.insurance && expanded !== 'insurance' && (
        <div className="mt-1 ml-[22px] text-[10px] text-slate-400">
          Försäkring: {breakdown.insurance.low.toLocaleString('sv-SE')} – {breakdown.insurance.high.toLocaleString('sv-SE')} kr beroende på din profil
        </div>
      )}

      {/* Total */}
      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-200">
        <div className="w-2.5" />
        <span className="text-sm font-bold text-slate-900 flex-1">Totalt</span>
        <span className="w-10" />
        <span className="font-mono text-[13px] font-bold text-slate-700 w-20 text-right tabular-nums">
          {Math.round(total / months).toLocaleString('sv-SE')} kr
        </span>
        <span className="font-mono font-bold text-slate-900 text-[15px] w-28 text-right tabular-nums">
          {total.toLocaleString('sv-SE')} kr
        </span>
      </div>

      {purchasePrice && (
        <div className="flex items-center justify-between mt-1 ml-[22px]">
          <span className="text-[11px] text-slate-400">Inköpspris</span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">{purchasePrice.toLocaleString('sv-SE')} kr</span>
        </div>
      )}

      {/* CO2 */}
      {emissions && emissions.total_kg > 0 && (
        <div className="mt-5 pt-4 border-t border-dashed border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
              <span className="text-[13px] text-slate-600">CO₂-utsläpp</span>
            </div>
            <span className="font-mono text-[13px] text-slate-900 font-medium tabular-nums">{emissions.total_ton} ton</span>
          </div>
          <div className="ml-[18px] mt-1.5 text-[11px] text-slate-400 leading-relaxed">
            Samhällskostnad: {emissions.social_cost.toLocaleString('sv-SE')} kr (Transportstyrelsen, ~1,19 kr/kg).
            {emissions.total_ton >= 1 && ` Motsvarar ~${Math.round(emissions.total_ton / 0.9)} flygresor Stockholm–London.`}
            {emissions.note && <><br/>{emissions.note}</>}
          </div>
        </div>
      )}
      {emissions && emissions.total_kg === 0 && (
        <div className="mt-5 pt-4 border-t border-dashed border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[13px] text-emerald-700 font-medium">Noll utsläpp vid körning</span>
          </div>
          <div className="ml-[18px] mt-1 text-[10px] text-slate-400">Utsläpp vid produktion och elgenerering ingår inte.</div>
        </div>
      )}
    </div>
  )
}

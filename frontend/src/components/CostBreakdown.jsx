const CATEGORIES = [
  { key: "depreciation", label: "Värdeminskning", color: "bg-red-400" },
  { key: "fuel", label: "Drivmedel", color: "bg-amber-400" },
  { key: "interest", label: "Ränta", color: "bg-violet-400" },
  { key: "tax", label: "Skatt", color: "bg-blue-400" },
  { key: "insurance", label: "Försäkring", color: "bg-purple-400", isRange: true },
  { key: "service", label: "Service", color: "bg-teal-400" },
  { key: "tires", label: "Däck", color: "bg-stone-400" },
]

export default function CostBreakdown({ breakdown, total, emissions, purchasePrice }) {
  return (
    <div>
      {/* Purchase price context */}
      {purchasePrice && (
        <div className="text-xs text-stone-400 mb-3">
          Inköpspris: <span className="font-mono text-stone-600">{purchasePrice.toLocaleString('sv-SE')} kr</span>
        </div>
      )}

      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-6 mb-4">
        {CATEGORIES.map(({ key, color }) => {
          const val = key === "insurance" ? breakdown[key]?.estimate : breakdown[key]
          if (!val || val <= 0) return null
          const pct = (val / total) * 100
          return (
            <div
              key={key}
              className={`${color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${key}: ${Math.round(pct)}%`}
            />
          )
        })}
      </div>

      {/* Legend + values */}
      <div className="space-y-2">
        {CATEGORIES.map(({ key, label, color, isRange }) => {
          const val = isRange ? breakdown[key]?.estimate : breakdown[key]
          if (!val || val <= 0) return null
          const pct = Math.round((val / total) * 100)
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-sm ${color}`} />
                <span className="text-stone-600">{label}</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-stone-900">
                  {val.toLocaleString('sv-SE')} kr
                </span>
                <span className="text-stone-400 text-xs ml-2">({pct}%)</span>
                {isRange && (
                  <div className="text-[10px] text-stone-400">
                    {breakdown[key].low.toLocaleString('sv-SE')}–{breakdown[key].high.toLocaleString('sv-SE')} kr
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-stone-200">
        <span className="font-semibold text-stone-900">Totalt</span>
        <span className="font-mono font-bold text-stone-900 text-lg">
          {total.toLocaleString('sv-SE')} kr
        </span>
      </div>

      {/* CO2 emissions */}
      {emissions && emissions.total_kg > 0 && (
        <div className="mt-4 pt-3 border-t border-dashed border-stone-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🌍</span>
              <span className="text-sm text-stone-600">CO₂-utsläpp</span>
            </div>
            <span className="font-mono text-stone-900 text-sm">
              {emissions.total_ton} ton
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-stone-400 ml-7">Samhällskostnad för utsläppen</span>
            <span className="font-mono text-xs text-stone-500">
              {emissions.social_cost.toLocaleString('sv-SE')} kr
            </span>
          </div>
          <p className="text-[10px] text-stone-400 mt-2 ml-7">
            Baserat på Transportstyrelsens värdering av CO₂ (~1,19 kr/kg).
            {emissions.total_ton >= 5
              ? ` Det motsvarar ungefär ${Math.round(emissions.total_ton / 0.9)} flygresor Stockholm–London.`
              : emissions.total_kg === 0
                ? ""
                : ` ${emissions.total_ton} ton — ungefär ${Math.round(emissions.total_ton / 0.9)} flygresor Stockholm–London.`
            }
          </p>
        </div>
      )}
      {emissions && emissions.total_kg === 0 && (
        <div className="mt-4 pt-3 border-t border-dashed border-stone-200">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌿</span>
            <span className="text-sm text-green-700">Noll utsläpp vid körning</span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1 ml-7">
            Elbilar har inga avgasutsläpp. Utsläpp vid produktion och elgenerering ingår inte.
          </p>
        </div>
      )}
    </div>
  )
}

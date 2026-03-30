const CATEGORIES = [
  { key: "depreciation", label: "Värdeminskning", color: "bg-red-400" },
  { key: "fuel", label: "Drivmedel", color: "bg-amber-400" },
  { key: "tax", label: "Skatt", color: "bg-blue-400" },
  { key: "insurance", label: "Försäkring", color: "bg-purple-400", isRange: true },
  { key: "service", label: "Service", color: "bg-teal-400" },
  { key: "tires", label: "Däck", color: "bg-stone-400" },
]

export default function CostBreakdown({ breakdown, total }) {
  return (
    <div>
      {/* Stacked bar */}
      <div className="flex rounded-full overflow-hidden h-6 mb-4">
        {CATEGORIES.map(({ key, color }) => {
          const val = key === "insurance" ? breakdown[key]?.estimate : breakdown[key]
          if (!val) return null
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
          if (!val) return null
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
    </div>
  )
}

export default function RankingTable({ cars, selected, onSelect }) {
  const maxCost = Math.max(...cars.map(c => c.monthly_cost))

  const fuelConfig = {
    el: { label: "El", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    hybrid: { label: "Hybrid", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    bensin: { label: "Bensin", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    diesel: { label: "Diesel", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
    laddhybrid: { label: "PHEV", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3 sm:mb-4">
        <h2 className="text-sm font-bold text-slate-900 font-display">{cars.length} modeller</h2>
        <span className="text-[11px] text-slate-400">Sorterat: billigast per månad</span>
      </div>

      <div className="space-y-1.5 sm:space-y-2" role="list" aria-label="Bilmodeller sorterade efter månadskostnad">
        {cars.map((car, i) => {
          const isSelected = selected === car.id
          const fc = fuelConfig[car.fuel] || fuelConfig.bensin
          const barWidth = (car.monthly_cost / maxCost) * 100
          const costPct = cars.length > 1 ? (car.monthly_cost - cars[0].monthly_cost) / (maxCost - cars[0].monthly_cost || 1) : 0
          const isWinner = i === 0
          // Color: green for cheap, through yellow, to red for expensive
          const r = Math.round(34 + costPct * 205)
          const g = Math.round(197 - costPct * 150)
          const b = Math.round(94 - costPct * 60)
          const barColor = `rgb(${r},${g},${b})`

          return (
            <button
              key={car.id}
              onClick={() => onSelect(car.id)}
              role="listitem"
              aria-selected={isSelected}
              aria-label={`${car.make} ${car.model}, ${car.monthly_cost.toLocaleString('sv-SE')} kr per månad`}
              className={`ranking-item group w-full text-left rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden ${
                isSelected
                  ? "bg-white border-emerald-300 shadow-md ring-1 ring-emerald-100"
                  : isWinner
                    ? "winner-row hover:shadow-sm"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
              style={{ animationDelay: `${Math.min(i, 15) * 30}ms` }}
            >
              {/* Cost indicator bar at bottom */}
              <div className="cost-bar" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />

              <div className="relative px-3 py-3 sm:px-4 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[11px] sm:text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-emerald-100 text-emerald-700' :
                    i <= 2 ? 'bg-slate-100 text-slate-600' :
                    'bg-slate-50 text-slate-400'
                  }`}>
                    {i + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-[13px] sm:text-[14px] text-slate-900 truncate">{car.make} {car.model}</div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                      <span className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded ${fc.bg} ${fc.text} border ${fc.border}`}>
                        {fc.label}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden sm:inline">{car.variant}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-[16px] sm:text-[18px] text-slate-900 tabular-nums">
                    {car.monthly_cost.toLocaleString('sv-SE')}
                    <span className="text-[10px] sm:text-[11px] font-normal text-slate-400 ml-1">kr/mån</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono tabular-nums">
                    {car.cost_per_mil} kr/mil
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

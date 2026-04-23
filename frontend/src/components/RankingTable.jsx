export default function RankingTable({ cars, selected, onSelect }) {
  const maxCost = Math.max(...cars.map(c => c.monthly_cost))

  const fuelConfig = {
    el: { label: "El", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    hybrid: { label: "Hybrid", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    bensin: { label: "Bensin", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    diesel: { label: "Diesel", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-900 font-display">{cars.length} modeller</h2>
        <span className="text-[11px] text-slate-400">Billigast per månad</span>
      </div>

      <div className="space-y-2">
        {cars.map((car, i) => {
          const isSelected = selected === car.id
          const fc = fuelConfig[car.fuel] || fuelConfig.bensin
          const barWidth = (car.monthly_cost / maxCost) * 100

          return (
            <button
              key={car.id}
              onClick={() => onSelect(car.id)}
              className={`ranking-item group w-full text-left rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden ${
                isSelected
                  ? "bg-white border-sky-200 shadow-md ring-1 ring-sky-100"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
              }`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              {/* Cost bar */}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-slate-50 to-transparent transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />

              <div className="relative px-4 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-emerald-100 text-emerald-700' :
                    i <= 2 ? 'bg-slate-100 text-slate-600' :
                    'bg-slate-50 text-slate-400'
                  }`}>
                    {i + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] text-slate-900 truncate">{car.make} {car.model}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${fc.bg} ${fc.text} border ${fc.border}`}>
                        {fc.label}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">{car.variant}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-[18px] text-slate-900 tabular-nums">
                    {car.monthly_cost.toLocaleString('sv-SE')}
                    <span className="text-[11px] font-normal text-slate-400 ml-1">kr/mån</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {car.cost_per_mil} kr/mil &middot; {Math.round(car.newPrice / 1000)}k ny
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

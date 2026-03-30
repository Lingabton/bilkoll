export default function RankingTable({ cars, selected, onSelect, fuelLabel }) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
        Månadskostnad — billigast först
      </h2>
      <div className="space-y-2">
        {cars.map((car, i) => {
          const isSelected = selected === car.id
          const fuelColors = {
            el: "bg-green-50 text-green-700 border-green-200",
            hybrid: "bg-blue-50 text-blue-700 border-blue-200",
            bensin: "bg-orange-50 text-orange-700 border-orange-200",
            diesel: "bg-stone-100 text-stone-600 border-stone-200",
          }
          return (
            <button
              key={car.id}
              onClick={() => onSelect(car.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-white border-stone-400 shadow-sm"
                  : "bg-white border-stone-200 hover:border-stone-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-stone-400 text-sm font-mono w-5">{i + 1}</span>
                  <div>
                    <div className="font-semibold text-stone-900 text-sm">{car.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${fuelColors[car.fuel] || fuelColors.bensin}`}>
                        {fuelLabel[car.fuel] || car.fuel}
                      </span>
                      <span className="text-xs text-stone-400">
                        Nypris {Math.round(car.newPrice / 1000)}k kr
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-stone-900 font-mono">
                    {car.monthly_cost.toLocaleString('sv-SE')}
                    <span className="text-xs font-normal text-stone-400 ml-1">kr/mån</span>
                  </div>
                  <div className="text-xs text-stone-400">
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

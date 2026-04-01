import { recalcTCO } from '../utils/tco'

const COST_ROWS = [
  { key: "depreciation", label: "Värdeminskning" },
  { key: "fuel", label: "Drivmedel" },
  { key: "tax", label: "Skatt" },
  { key: "insurance", label: "Försäkring", isRange: true },
  { key: "service", label: "Service" },
  { key: "tires", label: "Däck" },
  { key: "interest", label: "Ränta" },
]

export default function CompareView({ carA, carB, detailA, detailB, params }) {
  if (!carA || !carB || !detailA || !detailB) return null

  const rA = recalcTCO(detailA, carA, params)
  const rB = recalcTCO(detailB, carB, params)
  if (!rA || !rB) return null

  const diffMonthly = rA.monthly - rB.monthly
  const cheaper = diffMonthly > 0 ? 'B' : diffMonthly < 0 ? 'A' : null
  const years = params.years

  function fmt(n) { return n.toLocaleString('sv-SE') }

  function DiffCell({ a, b }) {
    const d = a - b
    if (d === 0) return <span className="text-slate-300">—</span>
    return (
      <span className={d > 0 ? 'text-rose-500' : 'text-emerald-600'}>
        {d > 0 ? '+' : ''}{fmt(d)}
      </span>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] text-sm border-b border-slate-100">
        <div className="px-4 py-3" />
        <div className="px-4 py-3 text-center font-semibold text-slate-900 border-x border-slate-100 bg-slate-50/50">
          {carA.make} {carA.model}
        </div>
        <div className="px-4 py-3 text-center font-semibold text-slate-900 bg-slate-50/50">
          {carB.make} {carB.model}
        </div>
        <div className="px-4 py-3 text-center text-[11px] text-slate-400 bg-slate-50/50 w-20">Diff</div>
      </div>

      {/* Monthly cost — hero row */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] border-b border-slate-200 bg-slate-50/30">
        <div className="px-4 py-3 text-sm font-bold text-slate-900">Per månad</div>
        <div className="px-4 py-3 text-center border-x border-slate-100">
          <span className={`font-mono text-lg font-bold ${cheaper === 'A' ? 'text-emerald-600' : 'text-slate-900'}`}>
            {fmt(rA.monthly)} <span className="text-xs text-slate-400 font-normal">kr</span>
          </span>
        </div>
        <div className="px-4 py-3 text-center">
          <span className={`font-mono text-lg font-bold ${cheaper === 'B' ? 'text-emerald-600' : 'text-slate-900'}`}>
            {fmt(rB.monthly)} <span className="text-xs text-slate-400 font-normal">kr</span>
          </span>
        </div>
        <div className="px-4 py-3 text-center font-mono text-sm w-20">
          <DiffCell a={rA.monthly} b={rB.monthly} />
        </div>
      </div>

      {/* Cost rows */}
      {COST_ROWS.map(({ key, label, isRange }) => {
        const valA = isRange ? rA.breakdown[key]?.estimate : rA.breakdown[key]
        const valB = isRange ? rB.breakdown[key]?.estimate : rB.breakdown[key]
        if ((!valA || valA <= 0) && (!valB || valB <= 0)) return null
        return (
          <div key={key} className="grid grid-cols-[1fr_1fr_1fr_auto] border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
            <div className="px-4 py-2 text-[13px] text-slate-500">{label}</div>
            <div className="px-4 py-2 text-center font-mono text-[13px] text-slate-700 border-x border-slate-50 tabular-nums">
              {fmt(valA || 0)} kr
            </div>
            <div className="px-4 py-2 text-center font-mono text-[13px] text-slate-700 tabular-nums">
              {fmt(valB || 0)} kr
            </div>
            <div className="px-4 py-2 text-center font-mono text-[11px] w-20 tabular-nums">
              <DiffCell a={valA || 0} b={valB || 0} />
            </div>
          </div>
        )
      })}

      {/* Total */}
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] border-t border-slate-200 bg-slate-50/30">
        <div className="px-4 py-3 text-sm font-bold text-slate-900">Totalt ({years} år)</div>
        <div className="px-4 py-3 text-center font-mono text-sm font-bold text-slate-900 border-x border-slate-100 tabular-nums">
          {fmt(rA.total)} kr
        </div>
        <div className="px-4 py-3 text-center font-mono text-sm font-bold text-slate-900 tabular-nums">
          {fmt(rB.total)} kr
        </div>
        <div className="px-4 py-3 text-center font-mono text-[12px] font-bold w-20 tabular-nums">
          <DiffCell a={rA.total} b={rB.total} />
        </div>
      </div>

      {/* CO2 comparison */}
      {(rA.emissions.total_kg > 0 || rB.emissions.total_kg > 0) && (
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] border-t border-dashed border-slate-200">
          <div className="px-4 py-2 text-[13px] text-slate-500">CO₂-utsläpp</div>
          <div className="px-4 py-2 text-center font-mono text-[13px] tabular-nums border-x border-slate-50">
            {rA.emissions.total_kg === 0
              ? <span className="text-emerald-600">0 ton</span>
              : <span className="text-slate-700">{rA.emissions.total_ton} ton</span>}
          </div>
          <div className="px-4 py-2 text-center font-mono text-[13px] tabular-nums">
            {rB.emissions.total_kg === 0
              ? <span className="text-emerald-600">0 ton</span>
              : <span className="text-slate-700">{rB.emissions.total_ton} ton</span>}
          </div>
          <div className="px-4 py-2 text-center font-mono text-[11px] w-20 tabular-nums">
            <DiffCell a={rA.emissions.total_kg} b={rB.emissions.total_kg} />
          </div>
        </div>
      )}

      {/* Summary */}
      {cheaper && (
        <div className="px-4 py-3 text-center text-sm bg-emerald-50 border-t border-emerald-100">
          <span className="font-semibold text-emerald-700">
            {cheaper === 'A' ? `${carA.make} ${carA.model}` : `${carB.make} ${carB.model}`} är {fmt(Math.abs(diffMonthly))} kr/mån billigare
          </span>
          <span className="text-emerald-600"> — {fmt(Math.abs(diffMonthly) * 12)} kr/år</span>
        </div>
      )}
    </div>
  )
}

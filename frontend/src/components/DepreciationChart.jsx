export default function DepreciationChart({ curve }) {
  if (!curve || curve.length < 2) return null

  const maxVal = Math.max(...curve.map(c => c.value))
  const width = 560
  const height = 180
  const pad = { top: 24, right: 20, bottom: 36, left: 20 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const points = curve.map((c, i) => ({
    x: pad.left + (i / (curve.length - 1)) * innerW,
    y: pad.top + (1 - c.value / maxVal) * innerH,
    ...c,
  }))

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = `${line} L ${points[points.length - 1].x} ${height - pad.bottom} L ${points[0].x} ${height - pad.bottom} Z`

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900">Värdeminskning</h3>
        <span className="text-[11px] text-slate-400 font-mono">
          -{Math.round((1 - points[points.length - 1].value / points[0].value) * 100)}% totalt
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        <defs>
          <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e11d48" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#e11d48" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0.25, 0.5, 0.75].map(pct => (
          <line key={pct}
            x1={pad.left} x2={width - pad.right}
            y1={pad.top + innerH * (1 - pct)} y2={pad.top + innerH * (1 - pct)}
            stroke="#f1f5f9" strokeWidth="1"
          />
        ))}

        <path d={area} fill="url(#depGrad)" />
        <path d={line} fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5}
              fill={p.confidence === "estimated" ? "#e2e8f0" : "#e11d48"}
              stroke="white" strokeWidth="2.5" />
            <text x={p.x} y={height - 10} textAnchor="middle"
              fontSize="11" fontFamily="'JetBrains Mono', monospace" fill="#94a3b8">
              {p.year === 0 ? "Ny" : `${p.year}å`}
            </text>
            <text x={p.x} y={p.y - 12} textAnchor="middle"
              fontSize="10" fontFamily="'JetBrains Mono', monospace"
              fill={p.confidence === "estimated" ? "#cbd5e1" : "#64748b"}>
              {Math.round(p.value / 1000)}k
            </text>
          </g>
        ))}
      </svg>

      <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-600" /> Marknadspris
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-200" /> Estimerat
        </div>
      </div>
    </div>
  )
}

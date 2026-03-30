export default function DepreciationChart({ curve }) {
  if (!curve || curve.length < 2) return null

  const maxVal = Math.max(...curve.map(c => c.value))
  const width = 560
  const height = 160
  const pad = { top: 20, right: 40, bottom: 30, left: 60 }
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
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <h3 className="text-sm font-semibold text-stone-900 mb-3">Värdeminskning</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Area */}
        <path d={area} fill="url(#depGrad)" />
        <defs>
          <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Line */}
        <path d={line} fill="none" stroke="#ef4444" strokeWidth="2" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.confidence === "estimated" ? 3 : 4}
              fill={p.confidence === "estimated" ? "#d4d4d4" : "#ef4444"}
              stroke="white" strokeWidth="2" />
            {/* Year label */}
            <text x={p.x} y={height - 8} textAnchor="middle" fontSize="10" fill="#a1a1aa">
              {p.year === 0 ? "Ny" : `${p.year} år`}
            </text>
            {/* Price label */}
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#71717a">
              {Math.round(p.value / 1000)}k
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-4 text-[10px] text-stone-400 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" /> Verklig data
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-stone-300" /> Estimat
        </div>
      </div>
    </div>
  )
}

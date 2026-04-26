import { useState, useRef, useEffect } from 'react'

export default function SearchBar({ cars, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const inputRef = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  const q = query.toLowerCase()
  const filtered = q.length > 0
    ? cars.filter(c => {
        const text = `${c.make} ${c.model} ${c.variant} ${c.fuel}`.toLowerCase()
        return q.split(' ').every(word => text.includes(word))
      }).slice(0, 8)
    : []

  const fuelLabels = { el: 'El', hybrid: 'Hybrid', bensin: 'Bensin', diesel: 'Diesel', laddhybrid: 'PHEV' }
  const fuelColors = {
    el: 'bg-emerald-100 text-emerald-700',
    hybrid: 'bg-blue-100 text-blue-700',
    bensin: 'bg-amber-100 text-amber-700',
    diesel: 'bg-slate-100 text-slate-600',
    laddhybrid: 'bg-violet-100 text-violet-700',
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={`Sök bland ${cars.length} modeller...`}
          aria-label="Sök bilmodell"
          aria-expanded={open && filtered.length > 0}
          role="combobox"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-slide-up max-h-[320px] overflow-y-auto" role="listbox">
          {filtered.map(car => (
            <button
              key={car.id}
              onClick={() => { onSelect(car.id); setQuery(''); setOpen(false) }}
              role="option"
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer border-b border-slate-50 last:border-0"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-slate-900">{car.make} {car.model}</span>
                <span className="text-xs text-slate-400 ml-1.5 hidden sm:inline">{car.variant}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${fuelColors[car.fuel] || 'bg-slate-100 text-slate-500'}`}>
                  {fuelLabels[car.fuel] || car.fuel}
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">{car.monthly_cost?.toLocaleString('sv-SE')}</span>
                <span className="text-[10px] text-slate-400">kr/mån</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

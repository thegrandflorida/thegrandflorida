'use client'

const LEGEND_ITEMS = [
  { label: 'Excellent (85+)', color: '#14b8a6' },
  { label: 'Good (70–84)', color: '#84cc16' },
  { label: 'Fair (50–69)', color: '#f59e0b' },
  { label: 'Poor (<50)', color: '#ef4444' },
]

export function MapLegend() {
  return (
    <div className="absolute bottom-8 right-4 z-10 rounded-lg border border-slate-700/60 bg-slate-900/85 backdrop-blur-sm px-3 py-2.5 text-xs text-slate-300">
      <p className="font-semibold text-slate-200 mb-2">Opportunity Score</p>
      <ul className="space-y-1.5">
        {LEGEND_ITEMS.map(({ label, color }) => (
          <li key={label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

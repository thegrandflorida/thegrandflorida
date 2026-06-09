'use client'

interface MapControlsProps {
  autoSearch: boolean
  onToggle: () => void
  onManualSearch: () => void
  showManualButton: boolean
}

export function MapControls({ autoSearch, onToggle, onManualSearch, showManualButton }: MapControlsProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
      <label className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/85 backdrop-blur-sm px-3 py-2 text-xs text-slate-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={autoSearch}
          onChange={onToggle}
          className="rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
        />
        Search as I move the map
      </label>

      {showManualButton && (
        <button
          type="button"
          onClick={onManualSearch}
          className="rounded-lg border border-teal-500/60 bg-teal-500/10 px-3 py-2 text-xs font-medium text-teal-400 hover:bg-teal-500/20 transition-colors backdrop-blur-sm"
        >
          Search this area
        </button>
      )}
    </div>
  )
}

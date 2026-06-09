import { cn } from '@/lib/utils/cn'
import { forwardRef } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-xs font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full h-9 rounded-lg bg-slate-900 border border-slate-700',
            'text-sm text-slate-100 placeholder:text-slate-500',
            'px-3 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors',
            icon && 'pl-9',
            error && 'border-red-500/50 focus:ring-red-500/30',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
)

Input.displayName = 'Input'

// ── Range slider ──────────────────────────────────────────────────────────────

interface RangeProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  valueLabel?: string
}

export const Range = forwardRef<HTMLInputElement, RangeProps>(
  ({ label, valueLabel, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5 w-full">
      {(label || valueLabel) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs font-medium text-slate-300">{label}</span>}
          {valueLabel && <span className="text-xs text-teal-400 font-mono">{valueLabel}</span>}
        </div>
      )}
      <input
        ref={ref}
        type="range"
        className={cn(
          'w-full h-1.5 rounded-full appearance-none cursor-pointer',
          'bg-slate-700 accent-teal-500',
          className
        )}
        {...props}
      />
    </div>
  )
)

Range.displayName = 'Range'

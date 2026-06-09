import { cn } from '@/lib/utils/cn'
import { forwardRef } from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-medium text-slate-300">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'w-full h-9 rounded-lg bg-slate-900 border border-slate-700',
          'text-sm text-slate-100 px-3',
          'focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50',
          'disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
          error && 'border-red-500/50',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>{placeholder}</option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
)

Select.displayName = 'Select'

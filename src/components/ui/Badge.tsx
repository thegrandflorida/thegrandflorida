import { cn } from '@/lib/utils/cn'
import type { ScoreGrade } from '@/types/database'

// ── Generic badge ─────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  size?: 'sm' | 'md'
  className?: string
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-slate-700 text-slate-200',
  success: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
  warning: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  danger:  'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  info:    'bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/30',
  muted:   'bg-slate-800 text-slate-400',
}

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// ── Score grade badge (A / B / C / D / F) ────────────────────────────────────

interface GradeBadgeProps {
  grade: ScoreGrade | null | undefined
  score?: number | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const gradeStyles: Record<ScoreGrade, { ring: string; text: string; bg: string }> = {
  A: { ring: 'ring-green-500/40',  text: 'text-green-400',  bg: 'bg-green-500/10' },
  B: { ring: 'ring-lime-500/40',   text: 'text-lime-400',   bg: 'bg-lime-500/10' },
  C: { ring: 'ring-amber-500/40',  text: 'text-amber-400',  bg: 'bg-amber-500/10' },
  D: { ring: 'ring-orange-500/40', text: 'text-orange-400', bg: 'bg-orange-500/10' },
  F: { ring: 'ring-red-500/40',    text: 'text-red-400',    bg: 'bg-red-500/10' },
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-11 h-11 text-base',
  lg: 'w-16 h-16 text-2xl',
}

export function GradeBadge({ grade, score, size = 'md', className }: GradeBadgeProps) {
  if (!grade) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center rounded-full ring-1',
        'ring-slate-700 bg-slate-800 text-slate-500',
        sizeClasses[size],
        className
      )}>
        <span className="font-bold leading-none">—</span>
      </div>
    )
  }

  const styles = gradeStyles[grade]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-full ring-1',
        styles.ring, styles.bg,
        sizeClasses[size],
        className
      )}
    >
      <span className={cn('font-bold leading-none', styles.text)}>{grade}</span>
      {score != null && size === 'lg' && (
        <span className={cn('text-[10px] leading-none mt-0.5', styles.text)}>
          {score.toFixed(0)}
        </span>
      )}
    </div>
  )
}

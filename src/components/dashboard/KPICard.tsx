'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  trend?: { value: number; label: string }
  icon?: React.ReactNode
  loading?: boolean
}

export function KPICard({ title, value, subtitle, trend, icon, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card className="p-5 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </Card>
    )
  }

  const isPositive = trend && trend.value >= 0

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
        {icon && <div className="text-teal-400 opacity-70">{icon}</div>}
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-100">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{trend.value.toFixed(1)}%
          </span>
        )}
        {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
      </div>
    </Card>
  )
}

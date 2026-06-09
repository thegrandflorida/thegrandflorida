// =============================================================================
// Formatting utilities — currency, numbers, dates, addresses
// =============================================================================

export function formatCurrency(
  value: number | null | undefined,
  opts?: { compact?: boolean; decimals?: number }
): string {
  if (value == null) return '—'

  if (opts?.compact) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: opts?.decimals ?? 0,
  }).format(value)
}

export function formatNumber(
  value: number | null | undefined,
  decimals = 0
): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)
}

export function formatAcres(value: number | null | undefined): string {
  if (value == null) return '—'
  if (value >= 100) return `${formatNumber(value, 1)} ac`
  if (value >= 10) return `${formatNumber(value, 2)} ac`
  return `${formatNumber(value, 3)} ac`
}

export function formatSqft(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${formatNumber(value)} sf`
}

export function formatDate(
  value: string | null | undefined,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  if (!value) return '—'
  const date = new Date(value)
  if (isNaN(date.getTime())) return '—'

  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { month: 'numeric', day: 'numeric', year: '2-digit' }
      : style === 'medium'
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { month: 'long', day: 'numeric', year: 'numeric' }

  return date.toLocaleDateString('en-US', options)
}

export function formatRelativeDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export function formatAddress(
  street: string | null,
  city: string | null,
  state: string | null,
  zip: string | null
): string {
  const parts = [street, city, state && zip ? `${state} ${zip}` : state ?? zip]
  return parts.filter(Boolean).join(', ') || 'Address unavailable'
}

export function formatPctChange(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatScore(score: number | null | undefined): string {
  if (score == null) return '—'
  return score.toFixed(1)
}

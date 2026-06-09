'use client'

import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, formatAcres } from '@/lib/utils/format'
import type { SalesHistory, MarketComp } from '@/types/database'

interface CompsResponse {
  data: {
    sales_history: SalesHistory[]
    comparable_sales: MarketComp[]
  }
}

async function fetchComps(id: string): Promise<CompsResponse['data']> {
  const res = await fetch(`/api/properties/${id}/comps`)
  if (!res.ok) throw new Error('Failed to fetch comps')
  const json: CompsResponse = await res.json()
  return json.data
}

interface Props {
  propertyId: string
}

export function PropertyComps({ propertyId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['comps', propertyId],
    queryFn: () => fetchComps(propertyId),
    enabled: Boolean(propertyId),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Unable to load comps"
        description="There was an error loading comparable sales data."
      />
    )
  }

  const { sales_history, comparable_sales } = data
  const hasAnything = sales_history.length > 0 || comparable_sales.length > 0

  if (!hasAnything) {
    return (
      <EmptyState
        title="No comps found"
        description="No sales history or comparable sales data is available for this property."
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Sales History */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sales_history.length === 0 ? (
            <p className="text-sm text-slate-400 px-5 py-4">No sales history available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 text-slate-400">
                    <th className="text-left px-5 py-2.5 font-medium">Date</th>
                    <th className="text-right px-3 py-2.5 font-medium">Price</th>
                    <th className="text-right px-3 py-2.5 font-medium">$/SqFt</th>
                    <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Buyer / Seller</th>
                    <th className="text-left px-5 py-2.5 font-medium hidden md:table-cell">Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {sales_history.map((sale) => (
                    <tr key={sale.id} className="border-b border-slate-700/30 last:border-0">
                      <td className="px-5 py-2.5 text-slate-300">{formatDate(sale.sale_date, 'short')}</td>
                      <td className="px-3 py-2.5 text-right text-slate-200 font-medium">
                        {formatCurrency(sale.sale_price)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-400">
                        {sale.price_per_sqft != null ? `$${sale.price_per_sqft.toFixed(0)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell">
                        <span>{sale.grantee ?? '—'}</span>
                        {sale.grantor && (
                          <>
                            <span className="mx-1 text-slate-600">/</span>
                            <span>{sale.grantor}</span>
                          </>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-slate-500 hidden md:table-cell font-mono text-[10px]">
                        {sale.instrument_number ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparable Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Comparable Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {comparable_sales.length === 0 ? (
            <p className="text-sm text-slate-400">No comparable sales available.</p>
          ) : (
            <div className="space-y-3">
              {comparable_sales.map((comp) => (
                <div
                  key={comp.id}
                  className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-xs font-medium text-slate-200 truncate">
                          {comp.address ?? 'Address unavailable'}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {comp.distance_miles != null && (
                          <span className="text-[10px] text-slate-400">
                            {comp.distance_miles.toFixed(2)} mi away
                          </span>
                        )}
                        {comp.lot_size_acres != null && (
                          <span className="text-[10px] text-slate-400">
                            {formatAcres(comp.lot_size_acres)}
                          </span>
                        )}
                        {comp.zoning_code && (
                          <Badge variant="default" size="sm">{comp.zoning_code}</Badge>
                        )}
                        {comp.similarity_score != null && (
                          <Badge variant="info" size="sm">
                            {(comp.similarity_score * 100).toFixed(0)}% match
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-100">
                        {formatCurrency(comp.sale_price)}
                      </p>
                      {comp.price_per_acre != null && (
                        <p className="text-[10px] text-slate-400">
                          {formatCurrency(comp.price_per_acre)}/ac
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {formatDate(comp.sale_date, 'short')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

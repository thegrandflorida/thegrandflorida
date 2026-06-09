import { useQuery } from '@tanstack/react-query'

export interface KPIs {
  total_properties: number
  avg_opportunity_score: number
  active_listings: number
  high_score_properties: number
}

async function fetchKPIs(): Promise<KPIs> {
  const res = await fetch('/api/properties/kpis')
  if (!res.ok) throw new Error('Failed to fetch KPIs')
  const json = await res.json()
  return json.data
}

export function useKPIs() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis'],
    queryFn: fetchKPIs,
    staleTime: 5 * 60 * 1000,
  })

  return { kpis, isLoading }
}

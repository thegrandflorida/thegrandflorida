import { useQuery } from '@tanstack/react-query'
import type { ScoringConfig } from '@/types/database'

async function fetchScoringConfigs(): Promise<ScoringConfig[]> {
  const res = await fetch('/api/scoring/config')
  if (!res.ok) throw new Error('Failed to fetch scoring configs')
  const json = await res.json()
  return json.data ?? json
}

export function useScoringConfigs() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['scoring-configs'],
    queryFn: fetchScoringConfigs,
  })

  return { configs: data ?? [], isLoading, refetch }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alert } from '@/types/database'

interface AlertsResponse {
  data: Alert[]
  unread_count: number
}

async function fetchAlerts(): Promise<AlertsResponse> {
  const res = await fetch('/api/alerts')
  if (!res.ok) throw new Error('Failed to fetch alerts')
  return res.json()
}

async function markAllReadFn(): Promise<void> {
  const res = await fetch('/api/alerts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mark_read: true }),
  })
  if (!res.ok) throw new Error('Failed to mark alerts as read')
}

export function useAlerts() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
  })

  const mutation = useMutation({
    mutationFn: markAllReadFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  return {
    alerts: data?.data ?? [],
    unreadCount: data?.unread_count ?? 0,
    markAllRead: mutation.mutate,
    isLoading,
  }
}

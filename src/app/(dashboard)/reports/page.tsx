'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, FileText } from 'lucide-react'
import type { EmailReport } from '@/types/database'
import { formatDate } from '@/lib/utils/format'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

async function fetchReports(): Promise<EmailReport[]> {
  const res = await fetch('/api/reports')
  if (!res.ok) throw new Error('Failed to fetch reports')
  const json = await res.json()
  return json.data
}

async function sendDailyDigest(): Promise<void> {
  const res = await fetch('/api/reports/daily-digest', { method: 'POST' })
  if (!res.ok) throw new Error('Failed to send digest')
}

export default function ReportsPage() {
  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: fetchReports,
  })

  const [sending, setSending] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  async function handleSendDigest() {
    setSending(true)
    setSentMessage(null)
    try {
      await sendDailyDigest()
      setSentMessage('Daily digest sent successfully.')
      refetch()
    } catch {
      setSentMessage('Failed to send digest. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Email digest history and report management.</p>
        </div>
        <Button variant="primary" onClick={handleSendDigest} loading={sending}>
          <Send className="w-4 h-4" />
          Send digest now
        </Button>
      </div>

      {sentMessage && (
        <p className="text-sm text-teal-400 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-2">
          {sentMessage}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No reports sent yet"
          description="Your email digest history will appear here."
        />
      ) : (
        <div className="rounded-xl border border-slate-700/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/60 bg-slate-800/60">
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Properties</th>
                <th className="text-left text-xs font-medium text-slate-400 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {reports.map((report) => (
                <tr key={report.id} className="bg-slate-800/30 hover:bg-slate-800/60 transition-colors">
                  <td className="px-4 py-3 text-slate-300">{formatDate(report.sent_at ?? report.created_at)}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{report.report_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-slate-400">{report.property_ids?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        report.status === 'sent'
                          ? 'bg-green-500/15 text-green-400'
                          : report.status === 'failed'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {report.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

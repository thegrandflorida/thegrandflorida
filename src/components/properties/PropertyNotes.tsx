'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatRelativeDate } from '@/lib/utils/format'
import type { PropertyNote } from '@/types/database'

interface NotesResponse {
  data: PropertyNote[]
}

async function fetchNotes(id: string): Promise<PropertyNote[]> {
  const res = await fetch(`/api/properties/${id}/notes`)
  if (!res.ok) throw new Error('Failed to fetch notes')
  const json: NotesResponse = await res.json()
  return json.data
}

interface Props {
  propertyId: string
}

export function PropertyNotes({ propertyId }: Props) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: notes, isLoading, error } = useQuery({
    queryKey: ['notes', propertyId],
    queryFn: () => fetchNotes(propertyId),
    enabled: Boolean(propertyId),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/properties/${propertyId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      if (!res.ok) throw new Error('Failed to add note')
      setContent('')
      await queryClient.invalidateQueries({ queryKey: ['notes', propertyId] })
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <CardTitle>Notes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add note form */}
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a note about this property..."
            rows={3}
            className="w-full rounded-lg bg-slate-900/60 border border-slate-700/60 px-3 py-2.5
              text-sm text-slate-200 placeholder:text-slate-500 outline-none resize-none
              focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 transition"
          />
          {submitError && (
            <p className="text-xs text-red-400">{submitError}</p>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={!content.trim()}
            >
              Add Note
            </Button>
          </div>
        </form>

        {/* Notes list */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-400">Failed to load notes.</p>
        ) : !notes || notes.length === 0 ? (
          <EmptyState
            title="No notes yet"
            description="Add your first note above."
            className="py-8"
          />
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4"
              >
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {note.body}
                </p>
                <p className="text-[10px] text-slate-500 mt-2">
                  {formatRelativeDate(note.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

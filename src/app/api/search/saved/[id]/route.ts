import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { deleteSavedSearch } from '@/lib/db/users'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{ id: string }>
}

const UpdateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  alert_enabled: z.boolean().optional(),
  alert_frequency: z.enum(['realtime', 'daily', 'weekly']).optional(),
  alert_score_threshold: z.number().min(0).max(100).optional(),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { id } = await params

    const body = await request.json()
    const parsed = UpdateSavedSearchSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid update payload', parsed.error.flatten()))
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('saved_searches')
      .update(parsed.data)
      .eq('id', id)
      .eq('user_id', authUser.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return errorResponse(Errors.NOT_FOUND)
      throw error
    }

    return successResponse(data)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { id } = await params

    await deleteSavedSearch(authUser.id, id)

    return successResponse({ deleted: true })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

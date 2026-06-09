import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { createAdminClient } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{ id: string }>
}

const NoteSchema = z.object({
  body: z.string().min(1).max(5000),
  is_private: z.boolean().optional().default(true),
})

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { id } = await params

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('property_notes')
      .select('*')
      .eq('property_id', id)
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return successResponse(data)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { id } = await params

    const body = await request.json()
    const parsed = NoteSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid note', parsed.error.flatten()))
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('property_notes')
      .insert({ ...parsed.data, property_id: id, user_id: authUser.id })
      .select()
      .single()

    if (error) throw error
    return successResponse(data, undefined, 201)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

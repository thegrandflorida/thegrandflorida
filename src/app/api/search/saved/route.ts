import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getUserSavedSearches, createSavedSearch } from '@/lib/db/users'

const CreateSavedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  filters: z.record(z.string(), z.unknown()),
  sort_by: z.string().optional(),
  sort_dir: z.enum(['asc', 'desc']).optional(),
  alert_enabled: z.boolean().optional().default(false),
  alert_frequency: z.enum(['realtime', 'daily', 'weekly']).optional(),
  alert_score_threshold: z.number().min(0).max(100).optional(),
})

export async function GET() {
  try {
    const { authUser } = await requireAuth()
    const searches = await getUserSavedSearches(authUser.id)
    return successResponse(searches)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

export async function POST(request: NextRequest) {
  try {
    const { authUser } = await requireAuth()

    const body = await request.json()
    const parsed = CreateSavedSearchSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid saved search', parsed.error.flatten()))
    }

    const search = await createSavedSearch(authUser.id, parsed.data as never)

    return successResponse(search, undefined, 201)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

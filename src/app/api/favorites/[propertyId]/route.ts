import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { addFavorite, removeFavorite, updateFavorite } from '@/lib/db/users'

interface Params {
  params: Promise<{ propertyId: string }>
}

const UpdateFavoriteSchema = z.object({
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  stage: z.enum(['watching', 'analyzing', 'under_contract', 'pass']).optional(),
})

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { propertyId } = await params

    const favorite = await addFavorite(authUser.id, propertyId)
    return successResponse(favorite, undefined, 201)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { propertyId } = await params

    const body = await request.json()
    const parsed = UpdateFavoriteSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid update', parsed.error.flatten()))
    }

    const updated = await updateFavorite(authUser.id, propertyId, parsed.data)
    return successResponse(updated)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { propertyId } = await params

    await removeFavorite(authUser.id, propertyId)
    return successResponse({ deleted: true })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

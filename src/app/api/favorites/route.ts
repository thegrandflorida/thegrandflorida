import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getUserFavorites } from '@/lib/db/users'

export async function GET() {
  try {
    const { authUser } = await requireAuth()
    const favorites = await getUserFavorites(authUser.id)
    return successResponse(favorites)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { sendDailyDigest } from '@/lib/email/digest'

// POST /api/reports/daily-digest — trigger an on-demand digest for the current user
export async function POST() {
  try {
    const { authUser, user } = await requireAuth()

    if (!user) return errorResponse(Errors.NOT_FOUND)

    const report = await sendDailyDigest(authUser.id, user.email)

    return successResponse(report)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[POST /api/reports/daily-digest]', err)
    return errorResponse(Errors.INTERNAL())
  }
}

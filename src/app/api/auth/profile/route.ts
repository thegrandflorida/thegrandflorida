import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { getCurrentUser, upsertUserProfile } from '@/lib/db/users'

const UpdateProfileSchema = z.object({
  full_name: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  gc_license_number: z.string().max(50).optional(),
  notification_preferences: z
    .object({
      email: z.boolean(),
      sms: z.boolean(),
      push: z.boolean(),
    })
    .optional(),
})

export async function GET() {
  try {
    await requireAuth()
    const user = await getCurrentUser()
    if (!user) return errorResponse(Errors.NOT_FOUND)
    return successResponse(user)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { authUser } = await requireAuth()

    const body = await request.json()
    const parsed = UpdateProfileSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid profile update', parsed.error.flatten()))
    }

    const updated = await upsertUserProfile(authUser.id, authUser.email, parsed.data)
    return successResponse(updated)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    return errorResponse(Errors.INTERNAL())
  }
}

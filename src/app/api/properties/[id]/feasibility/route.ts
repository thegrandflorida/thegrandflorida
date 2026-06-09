import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeFeasibility } from '@/lib/scoring/feasibility'

interface Params {
  params: Promise<{ id: string }>
}

const FeasibilityInputSchema = z.object({
  scenario_name: z.string().max(100).optional().default('Base Case'),
  proposed_use: z.enum(['sfr', 'townhomes', 'multifamily', 'mixed_use', 'commercial', 'industrial']),
  proposed_units: z.number().int().min(1).optional(),
  proposed_sqft: z.number().min(0).optional(),
  acquisition_price: z.number().min(0),
  hard_cost_per_sqft: z.number().min(0),
  soft_cost_pct: z.number().min(0).max(100).default(15),
  contingency_pct: z.number().min(0).max(100).default(10),
  avg_sale_price_per_unit: z.number().min(0).optional(),
  avg_sale_price_per_sqft: z.number().min(0).optional(),
  ltc_pct: z.number().min(0).max(100).default(70),
  interest_rate: z.number().min(0).max(30).default(8.5),
  loan_term_months: z.number().int().min(1).default(24),
  absorption_months: z.number().int().min(1).default(18),
  construction_months: z.number().int().min(1).default(18),
  is_public: z.boolean().optional().default(false),
})

// GET all feasibility analyses for a property
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { id } = await params

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('feasibility_analyses')
      .select('*')
      .eq('property_id', id)
      .or(`user_id.eq.${authUser.id},is_public.eq.true`)
      .order('created_at', { ascending: false })

    if (error) throw error

    return successResponse(data)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[GET /api/properties/[id]/feasibility]', err)
    return errorResponse(Errors.INTERNAL())
  }
}

// POST create a new feasibility analysis
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { authUser } = await requireAuth()
    const { id } = await params

    const body = await request.json()
    const parsed = FeasibilityInputSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid feasibility inputs', parsed.error.flatten()))
    }

    const inputs = parsed.data
    const computed = computeFeasibility(inputs)

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('feasibility_analyses')
      .insert({
        property_id: id,
        user_id: authUser.id,
        ...inputs,
        ...computed,
      })
      .select()
      .single()

    if (error) throw error

    return successResponse(data, undefined, 201)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[POST /api/properties/[id]/feasibility]', err)
    return errorResponse(Errors.INTERNAL())
  }
}

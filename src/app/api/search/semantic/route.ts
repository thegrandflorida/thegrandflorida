import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/utils/auth'
import { errorResponse, successResponse, Errors } from '@/lib/utils/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { embedText } from '@/lib/ai/embeddings'

const SemanticSearchSchema = z.object({
  query: z.string().min(3).max(500),
  limit: z.number().int().min(1).max(50).optional().default(20),
  score_min: z.number().min(0).max(100).optional(),
  counties: z.array(z.string()).optional(),
})

// POST /api/search/semantic
// Natural language property search using pgvector cosine similarity.
// Example query: "vacant corner lot near I-95, zoned for multifamily, no flood zone"
export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const parsed = SemanticSearchSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse(Errors.VALIDATION('Invalid search query', parsed.error.flatten()))
    }

    const { query, limit, score_min } = parsed.data

    // Embed the user's query into the same vector space as property summaries
    const queryEmbedding = await embedText(query)

    const supabase = createAdminClient()

    // pgvector cosine similarity search via RPC
    const { data, error } = await supabase.rpc('match_properties_by_embedding', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
      min_score: score_min ?? 0,
    })

    if (error) throw error

    return successResponse(data ?? [], { query, result_count: data?.length ?? 0 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) return errorResponse(err as never)
    console.error('[POST /api/search/semantic]', err)
    return errorResponse(Errors.INTERNAL())
  }
}

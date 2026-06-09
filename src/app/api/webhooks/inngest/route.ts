import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { allFunctions } from '@/inngest/functions'

// Inngest event router — handles all background job callbacks
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
})

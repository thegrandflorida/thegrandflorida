/* eslint-disable @typescript-eslint/no-explicit-any */
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendDailyDigest } from '@/lib/email/digest'

export const dailyDigestFunction = inngest.createFunction(
  {
    id: 'email-daily-digest',
    name: 'Send Daily Digest Emails',
    concurrency: { limit: 5 },
    retries: 1,
    triggers: [
      { event: 'email/daily-digest.send' },
      { cron: '0 12 * * *' }, // 7AM ET = 12:00 UTC
    ],
  } as any,
  async ({ event, step }: any) => {
    const targetUserId = event.data?.user_id as string | undefined

    const users = await step.run('fetch-eligible-users', async () => {
      const supabase = createAdminClient()
      let query = supabase
        .from('users')
        .select('id, email, notification_preferences, subscription_tier')
        .in('subscription_tier', ['pro', 'enterprise'])

      if (targetUserId) {
        query = (query as any).eq('id', targetUserId)
      }

      const { data } = await query
      return (data ?? []).filter((u: any) => u.notification_preferences?.email !== false)
    })

    const results = []

    for (const user of users as any[]) {
      const result = await step.run(`send-digest-${user.id}`, () =>
        sendDailyDigest(user.id as string, user.email as string).catch((err: Error) => ({
          report_id: null,
          sent: false,
          property_count: 0,
          error: err.message,
        }))
      )
      results.push({ user_id: user.id, ...result })
    }

    return {
      total_users: (users as any[]).length,
      sent: results.filter((r: any) => r.sent).length,
      failed: results.filter((r: any) => !r.sent).length,
    }
  }
)

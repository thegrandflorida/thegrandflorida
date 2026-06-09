import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatAcres, formatScore } from '@/lib/utils/format'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

interface DigestResult {
  report_id: string
  sent: boolean
  property_count: number
  resend_message_id?: string
}

export async function sendDailyDigest(
  userId: string,
  recipientEmail: string
): Promise<DigestResult> {
  const supabase = createAdminClient()

  // Fetch top 10 scored properties
  const { data: properties, error } = await supabase
    .from('properties')
    .select(`
      id, address_street, address_city, address_zip,
      lot_size_acres, is_vacant,
      parcel_data(land_value, price_per_acre),
      opportunity_scores(overall_score, score_grade, upside_flags, risk_flags),
      listings(list_price, status, days_on_market)
    `)
    .order('opportunity_scores.overall_score', { ascending: false })
    .limit(10)

  if (error) throw new Error(`Failed to fetch properties for digest: ${error.message}`)

  const topProperties = (properties ?? []).filter(
    (p: Record<string, unknown>) => {
      const scores = p.opportunity_scores as Record<string, unknown>[] | null
      return Array.isArray(scores) && scores.length > 0 && scores[0].overall_score != null
    }
  )

  const html = buildDigestHtml(topProperties as never[])

  // Create report record
  const { data: report, error: reportError } = await supabase
    .from('email_reports')
    .insert({
      user_id: userId,
      report_type: 'daily_digest',
      subject: `Daily Deal Digest — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      html_body: html,
      property_ids: topProperties.map((p: Record<string, unknown>) => p.id as string),
      recipient_email: recipientEmail,
      status: 'pending',
    })
    .select('id')
    .single()

  if (reportError) throw new Error(`Failed to create report: ${reportError.message}`)

  // Send via Resend
  const resend = getResend()
  const { data: emailData, error: emailError } = await resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_ADDRESS}>`,
    to: recipientEmail,
    subject: `Daily Deal Digest — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
    html,
  })

  const sent = !emailError

  await supabase
    .from('email_reports')
    .update({
      status: sent ? 'sent' : 'failed',
      sent_at: sent ? new Date().toISOString() : null,
      resend_message_id: emailData?.id ?? null,
    })
    .eq('id', report!.id)

  return {
    report_id: report!.id,
    sent,
    property_count: topProperties.length,
    resend_message_id: emailData?.id,
  }
}

// ---------------------------------------------------------------------------
// HTML email template
// ---------------------------------------------------------------------------
function buildDigestHtml(properties: Array<Record<string, unknown>>): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const gradeColor: Record<string, string> = {
    A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444',
  }

  const rows = properties
    .map((p) => {
      const pd = (p.parcel_data as Record<string, unknown>[] | null)?.[0] ?? {}
      const os = (p.opportunity_scores as Record<string, unknown>[] | null)?.[0] ?? {}
      const listing = (p.listings as Record<string, unknown>[] | null)?.[0]
      const grade = (os.score_grade as string) ?? 'F'
      const color = gradeColor[grade] ?? '#94a3b8'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.floridabuilderdealfinder.com'

      return `
      <tr style="border-bottom:1px solid #334155;">
        <td style="padding:12px 8px;">
          <div style="font-size:22px;font-weight:700;color:${color};text-align:center;
               width:40px;height:40px;line-height:40px;border-radius:50%;
               background:${color}22;margin:0 auto;">${grade}</div>
          <div style="text-align:center;color:${color};font-size:11px;margin-top:2px;">
            ${formatScore(os.overall_score as number | null)}
          </div>
        </td>
        <td style="padding:12px 8px;">
          <div style="font-weight:600;color:#f1f5f9;">${p.address_street ?? 'Address N/A'}</div>
          <div style="color:#94a3b8;font-size:13px;">${p.address_city ?? ''}, FL ${p.address_zip ?? ''}</div>
        </td>
        <td style="padding:12px 8px;color:#94a3b8;font-size:13px;">
          ${formatAcres(p.lot_size_acres as number | null)}
        </td>
        <td style="padding:12px 8px;color:#f1f5f9;font-size:13px;">
          ${listing ? formatCurrency(listing.list_price as number | null) : formatCurrency(pd.land_value as number | null)}
          <div style="color:#94a3b8;font-size:11px;">${formatCurrency(pd.price_per_acre as number | null)}/ac</div>
        </td>
        <td style="padding:12px 8px;">
          <a href="${appUrl}/properties/${p.id}"
             style="background:#14b8a6;color:#fff;padding:6px 12px;border-radius:4px;
                    text-decoration:none;font-size:12px;font-weight:600;">
            View →
          </a>
        </td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#14b8a6;margin:0;font-size:20px;font-weight:700;">
        Florida Builder Deal Finder
      </h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Daily Digest — ${date}</p>
    </div>

    <div style="background:#1e293b;border-radius:8px;border:1px solid #334155;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid #334155;">
        <h2 style="color:#f1f5f9;margin:0;font-size:15px;font-weight:600;">
          Top ${properties.length} Opportunities Today
        </h2>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#0f172a;">
            <th style="padding:8px;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Score</th>
            <th style="padding:8px;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;text-align:left;">Address</th>
            <th style="padding:8px;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Acres</th>
            <th style="padding:8px;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Price</th>
            <th style="padding:8px;"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <p style="text-align:center;color:#475569;font-size:11px;margin-top:20px;">
      Florida Builder Deal Finder ·
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" style="color:#475569;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`
}

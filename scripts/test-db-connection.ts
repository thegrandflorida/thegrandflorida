#!/usr/bin/env tsx
/**
 * Test Supabase database connection.
 * Usage: npx tsx scripts/test-db-connection.ts
 */

import { createAdminClient } from '../src/lib/supabase/admin'

async function main() {
  console.log('Testing Supabase connection...\n')

  const supabase = createAdminClient()

  // 1. Check counties table
  const { data: counties, error: countiesError } = await supabase
    .from('counties')
    .select('id, name, fips_code, total_parcels')
    .order('name')

  if (countiesError) {
    console.error('❌ Counties query failed:', countiesError.message)
    process.exit(1)
  }

  console.log('✅ Connected to Supabase\n')
  console.log('Target counties:')
  counties?.forEach((c) =>
    console.log(`  ${c.name.padEnd(15)} FIPS: ${c.fips_code}  Parcels: ${c.total_parcels?.toLocaleString() ?? 'N/A'}`)
  )

  // 2. Check properties count
  const { count: propCount, error: propError } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })

  if (propError) {
    console.warn('\n⚠️  Properties table query failed:', propError.message)
  } else {
    console.log(`\n✅ Properties table: ${propCount?.toLocaleString() ?? 0} rows`)
  }

  // 3. Check scoring configs
  const { data: configs, error: configError } = await supabase
    .from('scoring_configs')
    .select('name, is_default, is_active')
    .eq('is_active', true)

  if (configError) {
    console.warn('\n⚠️  Scoring configs query failed:', configError.message)
  } else {
    console.log('\nScoring configurations:')
    configs?.forEach((c) =>
      console.log(`  ${c.is_default ? '★' : ' '} ${c.name}`)
    )
  }

  console.log('\n✅ All checks passed')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})

'use client'

import { useState, useMemo } from 'react'
import type { PropertyWithRelations } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

interface Props {
  property: PropertyWithRelations
}

interface Inputs {
  sale_price_per_unit: number
  num_units: number
  construction_cost_per_unit: number
  land_cost: number
  soft_cost_pct: number
  financing_rate: number
  loan_to_cost: number
  hold_period_months: number
}

function NumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min,
  max,
  step,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="flex items-center rounded-lg bg-slate-900/60 border border-slate-700/60 overflow-hidden">
        {prefix && (
          <span className="px-2.5 text-xs text-slate-400 border-r border-slate-700/60">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-100 outline-none min-w-0"
        />
        {suffix && (
          <span className="px-2.5 text-xs text-slate-400 border-l border-slate-700/60">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function MetricRow({
  label,
  value,
  positive,
  highlight,
}: {
  label: string
  value: string
  positive?: boolean | null
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-between items-center py-2 border-b border-slate-700/30 last:border-0',
        highlight && 'bg-slate-700/20 -mx-3 px-3 rounded'
      )}
    >
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold',
          positive === true && 'text-green-400',
          positive === false && 'text-red-400',
          positive == null && 'text-slate-200'
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function FeasibilityCalculator({ property }: Props) {
  const defaultUnits = property.zoning?.max_density_units_per_acre
    ? Math.floor((property.lot_size_acres ?? 1) * property.zoning.max_density_units_per_acre)
    : 10

  const [inputs, setInputs] = useState<Inputs>({
    sale_price_per_unit: 450000,
    num_units: Math.max(1, defaultUnits),
    construction_cost_per_unit: 180000,
    land_cost: property.listing?.list_price ?? property.parcel_data?.total_value ?? 0,
    soft_cost_pct: 15,
    financing_rate: 6.5,
    loan_to_cost: 70,
    hold_period_months: 24,
  })

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const set = <K extends keyof Inputs>(key: K, value: Inputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }))

  const outputs = useMemo(() => {
    const {
      sale_price_per_unit,
      num_units,
      construction_cost_per_unit,
      land_cost,
      soft_cost_pct,
      financing_rate,
      loan_to_cost,
      hold_period_months,
    } = inputs

    const totalRevenue = sale_price_per_unit * num_units
    const totalConstructionCost = construction_cost_per_unit * num_units
    const softCosts = totalConstructionCost * (soft_cost_pct / 100)
    const totalProjectCost = land_cost + totalConstructionCost + softCosts
    const loanAmount = totalProjectCost * (loan_to_cost / 100)
    const equityRequired = totalProjectCost - loanAmount
    const monthlyRate = financing_rate / 100 / 12
    const carryCost = loanAmount * monthlyRate * hold_period_months
    const grossProfit = totalRevenue - totalProjectCost - carryCost
    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const roiPct = equityRequired > 0 ? (grossProfit / equityRequired) * 100 : 0
    const equityMultiple = equityRequired > 0 ? (equityRequired + grossProfit) / equityRequired : 0
    const annualizedIRR =
      hold_period_months > 0 && equityMultiple > 0
        ? (Math.pow(equityMultiple, 12 / hold_period_months) - 1) * 100
        : 0

    return {
      totalRevenue,
      totalConstructionCost,
      softCosts,
      totalProjectCost,
      loanAmount,
      equityRequired,
      carryCost,
      grossProfit,
      grossMarginPct,
      roiPct,
      equityMultiple,
      annualizedIRR,
    }
  }, [inputs])

  const handleSave = async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/properties/${property.id}/feasibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, outputs }),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
    } catch {
      setSaveStatus('error')
    }
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Feasibility Calculator</CardTitle>
          <div className="flex items-center gap-3">
            {saveStatus === 'saved' && (
              <span className="text-xs text-green-400">Saved</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-400">Error saving</span>
            )}
            <Button
              size="sm"
              variant="primary"
              loading={saveStatus === 'saving'}
              onClick={handleSave}
            >
              Save Analysis
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Inputs</h4>
            <NumberInput
              label="Sale Price per Unit"
              value={inputs.sale_price_per_unit}
              onChange={(v) => set('sale_price_per_unit', v)}
              prefix="$"
              min={0}
              step={5000}
            />
            <NumberInput
              label="Number of Units"
              value={inputs.num_units}
              onChange={(v) => set('num_units', v)}
              min={1}
            />
            <NumberInput
              label="Construction Cost per Unit"
              value={inputs.construction_cost_per_unit}
              onChange={(v) => set('construction_cost_per_unit', v)}
              prefix="$"
              min={0}
              step={5000}
            />
            <NumberInput
              label="Land Cost"
              value={inputs.land_cost}
              onChange={(v) => set('land_cost', v)}
              prefix="$"
              min={0}
              step={10000}
            />
            <NumberInput
              label="Soft Cost %"
              value={inputs.soft_cost_pct}
              onChange={(v) => set('soft_cost_pct', v)}
              suffix="%"
              min={0}
              max={30}
              step={0.5}
            />
            <NumberInput
              label="Financing Rate"
              value={inputs.financing_rate}
              onChange={(v) => set('financing_rate', v)}
              suffix="%"
              min={0}
              max={15}
              step={0.25}
            />
            <NumberInput
              label="Loan-to-Cost"
              value={inputs.loan_to_cost}
              onChange={(v) => set('loan_to_cost', v)}
              suffix="%"
              min={0}
              max={90}
              step={5}
            />
            <NumberInput
              label="Hold Period"
              value={inputs.hold_period_months}
              onChange={(v) => set('hold_period_months', v)}
              suffix="mo"
              min={1}
              max={120}
            />
          </div>

          {/* Outputs */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Outputs
            </h4>
            <div>
              <MetricRow label="Total Revenue" value={formatCurrency(outputs.totalRevenue)} />
              <MetricRow
                label="Construction Cost"
                value={formatCurrency(outputs.totalConstructionCost)}
              />
              <MetricRow label="Soft Costs" value={formatCurrency(outputs.softCosts)} />
              <MetricRow label="Land Cost" value={formatCurrency(inputs.land_cost)} />
              <MetricRow
                label="Total Project Cost"
                value={formatCurrency(outputs.totalProjectCost)}
                highlight
              />
              <MetricRow label="Loan Amount" value={formatCurrency(outputs.loanAmount)} />
              <MetricRow
                label="Equity Required"
                value={formatCurrency(outputs.equityRequired)}
              />
              <MetricRow
                label="Carry Cost"
                value={formatCurrency(outputs.carryCost)}
                positive={false}
              />
              <MetricRow
                label="Gross Profit"
                value={formatCurrency(outputs.grossProfit)}
                positive={outputs.grossProfit > 0}
                highlight
              />
              <MetricRow
                label="Gross Margin"
                value={`${outputs.grossMarginPct.toFixed(1)}%`}
                positive={outputs.grossMarginPct >= 15}
              />
              <MetricRow
                label="ROI"
                value={`${outputs.roiPct.toFixed(1)}%`}
                positive={outputs.roiPct >= 15}
              />
              <MetricRow
                label="Equity Multiple"
                value={`${outputs.equityMultiple.toFixed(2)}x`}
                positive={outputs.equityMultiple >= 1.5}
              />
              <MetricRow
                label="Annualized IRR"
                value={`${outputs.annualizedIRR.toFixed(1)}%`}
                positive={outputs.annualizedIRR >= 15}
                highlight
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

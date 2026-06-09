// =============================================================================
// Development feasibility calculator — pure functions, no DB access
// =============================================================================

export interface FeasibilityInputs {
  proposed_units?: number
  proposed_sqft?: number
  acquisition_price: number
  hard_cost_per_sqft: number
  soft_cost_pct: number        // e.g. 15 = 15%
  contingency_pct: number      // e.g. 10 = 10%
  avg_sale_price_per_unit?: number
  avg_sale_price_per_sqft?: number
  ltc_pct: number              // loan-to-cost %, e.g. 70
  interest_rate: number        // annual %, e.g. 8.5
  loan_term_months: number
  absorption_months: number
  construction_months: number
}

export interface FeasibilityOutputs {
  total_hard_cost: number
  total_soft_cost: number
  total_contingency: number
  total_project_cost: number
  total_revenue: number
  gross_profit: number
  gross_margin_pct: number
  roi_pct: number
  irr_pct: number
  equity_multiple: number
  profit_per_unit: number | null
  loan_amount: number
  carry_cost: number
  avg_sale_price_per_unit: number | null
  avg_sale_price_per_sqft: number | null
}

export function computeFeasibility(inputs: FeasibilityInputs): FeasibilityOutputs {
  const {
    proposed_units,
    proposed_sqft,
    acquisition_price,
    hard_cost_per_sqft,
    soft_cost_pct,
    contingency_pct,
    avg_sale_price_per_unit,
    avg_sale_price_per_sqft,
    ltc_pct,
    interest_rate,
    loan_term_months,
    absorption_months,
    construction_months,
  } = inputs

  // Hard costs
  const sqft = proposed_sqft ?? (proposed_units ? proposed_units * 1500 : 0)
  const total_hard_cost = sqft * hard_cost_per_sqft

  // Soft costs (% of hard costs)
  const total_soft_cost = total_hard_cost * (soft_cost_pct / 100)

  // Subtotal before contingency
  const subtotal = acquisition_price + total_hard_cost + total_soft_cost

  // Contingency (% of total hard + soft)
  const total_contingency = (total_hard_cost + total_soft_cost) * (contingency_pct / 100)

  // Total project cost
  const total_project_cost = subtotal + total_contingency

  // Financing
  const loan_amount = total_project_cost * (ltc_pct / 100)
  const equity_invested = total_project_cost - loan_amount

  // Carry cost — interest only on drawn balance during construction + absorption
  const monthly_rate = interest_rate / 100 / 12
  const total_months = construction_months + absorption_months
  // Average draw = 50% of loan during construction, 100% during absorption
  const avg_drawn = loan_amount * 0.5 * (construction_months / total_months)
                  + loan_amount * 1.0 * (absorption_months / total_months)
  const carry_cost = avg_drawn * monthly_rate * total_months

  // Revenue
  let total_revenue = 0
  let resolved_price_per_unit: number | null = null
  let resolved_price_per_sqft: number | null = null

  if (proposed_units && avg_sale_price_per_unit) {
    total_revenue = proposed_units * avg_sale_price_per_unit
    resolved_price_per_unit = avg_sale_price_per_unit
    resolved_price_per_sqft = avg_sale_price_per_sqft ?? null
  } else if (sqft && avg_sale_price_per_sqft) {
    total_revenue = sqft * avg_sale_price_per_sqft
    resolved_price_per_sqft = avg_sale_price_per_sqft
    resolved_price_per_unit = proposed_units
      ? total_revenue / proposed_units
      : null
  }

  // Returns
  const total_cost_with_carry = total_project_cost + carry_cost
  const gross_profit = total_revenue - total_cost_with_carry
  const gross_margin_pct = total_revenue > 0 ? (gross_profit / total_revenue) * 100 : 0
  const roi_pct = equity_invested > 0 ? (gross_profit / equity_invested) * 100 : 0
  const equity_multiple = equity_invested > 0 ? (equity_invested + gross_profit) / equity_invested : 0

  // Simplified IRR — annualized ROI assuming linear cash flows
  // Full DCF IRR requires Newton-Raphson iteration; this approximation is suitable for UI display
  const hold_years = total_months / 12
  const irr_pct = hold_years > 0
    ? (Math.pow(equity_multiple, 1 / hold_years) - 1) * 100
    : 0

  const profit_per_unit =
    proposed_units && proposed_units > 0 ? gross_profit / proposed_units : null

  return {
    total_hard_cost: round2(total_hard_cost),
    total_soft_cost: round2(total_soft_cost),
    total_contingency: round2(total_contingency),
    total_project_cost: round2(total_project_cost),
    total_revenue: round2(total_revenue),
    gross_profit: round2(gross_profit),
    gross_margin_pct: round2(gross_margin_pct),
    roi_pct: round2(roi_pct),
    irr_pct: round2(irr_pct),
    equity_multiple: round2(equity_multiple),
    profit_per_unit: profit_per_unit !== null ? round2(profit_per_unit) : null,
    loan_amount: round2(loan_amount),
    carry_cost: round2(carry_cost),
    avg_sale_price_per_unit: resolved_price_per_unit,
    avg_sale_price_per_sqft: resolved_price_per_sqft,
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

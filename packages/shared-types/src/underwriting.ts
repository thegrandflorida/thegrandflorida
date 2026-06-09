export interface UnderwritingAssumptions {
  units_allowed: number | null;
  construction_type: string | null;
  hard_cost_per_unit: number | null;
  soft_cost_pct: number | null;
  financing_cost_pct: number | null;
  contingency_pct: number | null;
  avg_market_rent: number | null;
  rent_source: string | null;
  vacancy_rate: number | null;
  expense_ratio: number | null;
  exit_cap_rate: number | null;
}

export interface UnderwritingDefaults {
  hard_cost_per_unit: number;
  soft_cost_pct: number;
  financing_cost_pct: number;
  vacancy_rate: number;
  expense_ratio: number;
  exit_cap_rate: number;
  contingency_pct: number;
  construction_type: string;
  rent_source: string;
}

export const UNDERWRITING_DEFAULTS: UnderwritingDefaults = {
  hard_cost_per_unit: 145_000,
  soft_cost_pct: 0.18,
  financing_cost_pct: 0.08,
  vacancy_rate: 0.07,
  expense_ratio: 0.38,
  exit_cap_rate: 0.055,
  contingency_pct: 0.05,
  construction_type: "garden",
  rent_source: "CoStar",
};

export interface UnderwritingInput {
  listing_id: string;
  overrides: Partial<UnderwritingAssumptions>;
}

export interface UnderwritingSnapshot {
  id: string;
  listing_id: string;
  property_id: string;
  calculated_at: string;

  snap_listing_price: number;
  snap_annual_taxes: number | null;
  snap_gross_acreage: number;
  snap_net_buildable_acreage: number;
  snap_price_per_acre: number;

  assumed_units_allowed: number;
  assumed_hard_cost_per_unit: number;
  assumed_soft_cost_pct: number;
  assumed_financing_cost_pct: number;
  assumed_avg_market_rent: number;
  assumed_vacancy_rate: number;
  assumed_expense_ratio: number;
  assumed_exit_cap_rate: number;

  land_cost_per_buildable_unit: number;
  total_development_cost: number;
  gross_potential_rent_annual: number;
  effective_gross_income_annual: number;
  noi_annual: number;
  stabilized_value: number;
  developer_profit_absolute: number;
  developer_profit_margin_pct: number;
  return_on_cost: number;
  roc_vs_cap_rate_spread: number;

  user_override_flags: Record<string, boolean>;
  is_system_generated: boolean;
}

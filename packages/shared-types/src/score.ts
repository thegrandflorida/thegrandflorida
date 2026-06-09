export type ScoreLabel = "Exceptional" | "Strong" | "Solid" | "Marginal" | "Weak";

export const SCORE_LABEL_THRESHOLDS = {
  EXCEPTIONAL: 85,
  STRONG: 70,
  SOLID: 55,
  MARGINAL: 40,
} as const;

export function getScoreLabel(score: number): ScoreLabel {
  if (score >= SCORE_LABEL_THRESHOLDS.EXCEPTIONAL) return "Exceptional";
  if (score >= SCORE_LABEL_THRESHOLDS.STRONG) return "Strong";
  if (score >= SCORE_LABEL_THRESHOLDS.SOLID) return "Solid";
  if (score >= SCORE_LABEL_THRESHOLDS.MARGINAL) return "Marginal";
  return "Weak";
}

export interface SubIndicatorScore {
  raw_value: number | null;
  normalized_score: number;
  points_contribution: number;
  weight: number;
}

export interface BonusModifier {
  name: string;
  points: number;
  reason: string;
}

export interface ImprovementLever {
  indicator: string;
  current_pts: number;
  max_pts: number;
  gap: number;
  hint: string;
}

export interface OpportunityScoreDetail {
  id: string;
  listing_id: string;
  calculated_at: string;

  raw_land_cost_per_unit: number | null;
  raw_rent_growth_pct: number | null;
  raw_population_growth_pct: number | null;
  raw_median_hh_income: number | null;
  raw_employment_growth_pct: number | null;
  raw_supply_pressure_ratio: number | null;
  raw_effective_tax_rate: number | null;
  raw_sfha_pct: number | null;
  raw_wetland_coverage_pct: number | null;
  raw_infrastructure_score: number | null;

  norm_land_cost_per_unit: number;
  norm_rent_growth: number;
  norm_population_growth: number;
  norm_median_hh_income: number;
  norm_employment_growth: number;
  norm_new_supply: number;
  norm_property_tax_burden: number;
  norm_flood_risk: number;
  norm_wetland_risk: number;
  norm_infrastructure_access: number;

  pts_land_cost_per_unit: number;
  pts_rent_growth: number;
  pts_population_growth: number;
  pts_median_hh_income: number;
  pts_employment_growth: number;
  pts_new_supply: number;
  pts_property_tax_burden: number;
  pts_flood_risk: number;
  pts_wetland_risk: number;
  pts_infrastructure_access: number;

  bonus_modifiers: BonusModifier[];
  bonus_points_total: number;
  base_composite_score: number;
  final_score: number;
  score_label: ScoreLabel;
  improvement_levers: ImprovementLever[];
}

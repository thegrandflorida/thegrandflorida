-- =============================================================================
-- Seed: Default Scoring Configuration
-- =============================================================================

INSERT INTO public.scoring_configs (
  id,
  name,
  description,
  is_default,
  is_active,
  weights,
  thresholds
) VALUES (
  gen_random_uuid(),
  'Default — Residential Land',
  'Optimized for residential land acquisition (SFR, townhomes, multifamily) on Florida east coast',
  TRUE,
  TRUE,
  '{
    "price_per_acre":        0.20,
    "zoning_flexibility":    0.18,
    "population_growth":     0.14,
    "flood_risk":            0.13,
    "comparable_sales":      0.12,
    "development_activity":  0.10,
    "utility_access":        0.07,
    "wetland_pct":           0.04,
    "interstate_distance":   0.02
  }'::jsonb,
  '{"A": 85, "B": 70, "C": 55, "D": 40}'::jsonb
),
(
  gen_random_uuid(),
  'Commercial / Retail Land',
  'Weighted for commercial retail and mixed-use development',
  FALSE,
  TRUE,
  '{
    "price_per_acre":        0.22,
    "zoning_flexibility":    0.20,
    "population_growth":     0.14,
    "flood_risk":            0.06,
    "comparable_sales":      0.12,
    "development_activity":  0.10,
    "utility_access":        0.03,
    "wetland_pct":           0.01,
    "interstate_distance":   0.12
  }'::jsonb,
  '{"A": 85, "B": 70, "C": 55, "D": 40}'::jsonb
),
(
  gen_random_uuid(),
  'Industrial / Warehouse Land',
  'Weighted for industrial and last-mile logistics development',
  FALSE,
  TRUE,
  '{
    "price_per_acre":        0.20,
    "zoning_flexibility":    0.14,
    "population_growth":     0.03,
    "flood_risk":            0.12,
    "comparable_sales":      0.10,
    "development_activity":  0.06,
    "utility_access":        0.16,
    "wetland_pct":           0.01,
    "interstate_distance":   0.18
  }'::jsonb,
  '{"A": 85, "B": 70, "C": 55, "D": 40}'::jsonb
),
(
  gen_random_uuid(),
  'Distressed Acquisition',
  'Weighted for value-add and distressed land plays',
  FALSE,
  TRUE,
  '{
    "price_per_acre":        0.30,
    "zoning_flexibility":    0.12,
    "population_growth":     0.06,
    "flood_risk":            0.15,
    "comparable_sales":      0.20,
    "development_activity":  0.10,
    "utility_access":        0.04,
    "wetland_pct":           0.02,
    "interstate_distance":   0.01
  }'::jsonb,
  '{"A": 85, "B": 70, "C": 55, "D": 40}'::jsonb
)
ON CONFLICT DO NOTHING;

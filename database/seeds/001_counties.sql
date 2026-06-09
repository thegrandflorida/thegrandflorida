-- =============================================================================
-- Seed: Target Florida East Coast Counties
-- =============================================================================

INSERT INTO public.counties (name, fips_code, state, appraiser_api_url, total_parcels)
VALUES
  ('Broward',      '12011', 'FL', 'https://bcpa.net/api',                         600000),
  ('Palm Beach',   '12099', 'FL', 'https://pbcgov.org/papa/api',                  650000),
  ('Martin',       '12085', 'FL', 'https://martin.fl.us/property-appraiser/api',   80000),
  ('St. Lucie',    '12111', 'FL', 'https://paslc.gov/api',                        160000),
  ('Indian River', '12061', 'FL', 'https://ircpa.org/api',                         75000)
ON CONFLICT (fips_code) DO NOTHING;

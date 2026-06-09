-- =============================================================================
-- Migration 002: pgvector semantic search RPC function
-- =============================================================================

-- Function used by /api/search/semantic to find properties by embedding similarity
CREATE OR REPLACE FUNCTION public.match_properties_by_embedding(
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT DEFAULT 0.5,
  match_count      INT   DEFAULT 20,
  min_score        FLOAT DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  address_street    TEXT,
  address_city      TEXT,
  address_zip       TEXT,
  lot_size_acres    NUMERIC,
  is_vacant         BOOLEAN,
  overall_score     NUMERIC,
  score_grade       TEXT,
  similarity        FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id,
    p.address_street,
    p.address_city,
    p.address_zip,
    p.lot_size_acres,
    p.is_vacant,
    os.overall_score,
    os.score_grade,
    1 - (os.embedding <=> query_embedding) AS similarity
  FROM public.properties p
  JOIN public.opportunity_scores os ON os.property_id = p.id
  WHERE
    os.embedding IS NOT NULL
    AND 1 - (os.embedding <=> query_embedding) > match_threshold
    AND (min_score = 0 OR os.overall_score >= min_score)
  ORDER BY os.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Ensure ivfflat index exists (already in migration 001, but guard here)
CREATE INDEX IF NOT EXISTS idx_opportunity_scores_embedding
  ON public.opportunity_scores
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

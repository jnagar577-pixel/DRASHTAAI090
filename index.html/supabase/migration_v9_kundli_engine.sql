-- ====================================================================
-- TURIYA AI: KUNDLI ENGINE ADDITIVE MIGRATION (v9)
-- Table: public.user_kundli_charts
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.user_kundli_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_token_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    dob DATE NOT NULL,
    birth_time TIME WITHOUT TIME ZONE NOT NULL,
    birth_place TEXT NOT NULL,
    latitude NUMERIC(9,6) NOT NULL,
    longitude NUMERIC(9,6) NOT NULL,
    timezone_offset TEXT NOT NULL,
    ayanamsha TEXT DEFAULT 'Lahiri' NOT NULL,
    d1_data JSONB NOT NULL,
    d9_data JSONB NOT NULL,
    dasha_data JSONB NOT NULL,
    current_dasha JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_user_kundli_charts_token UNIQUE (user_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_kundli_charts_token_hash 
ON public.user_kundli_charts (user_token_hash);

ALTER TABLE public.user_kundli_charts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny direct public access to charts" ON public.user_kundli_charts;
CREATE POLICY "Deny direct public access to charts"
ON public.user_kundli_charts
FOR ALL
TO anon, authenticated
USING (false);

DROP POLICY IF EXISTS "Service role manages user charts" ON public.user_kundli_charts;
CREATE POLICY "Service role manages user charts"
ON public.user_kundli_charts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

# Turiya AI — Swami Atma Jagran

Vedic jyotish margdarshan chatbot with authentic astronomical Kundli Engine (D1, D9, and Level 1-3 Vimshottari Dasha).

## Folder Structure
```
index.html                               # Frontend application
api/ask.js                               # Serverless API: chat, intake, feedback, delete
lib/vedastro.js                          # VedAstro API client & calculation engine
lib/kundli-service.js                    # Database chart cache & Grok prompt formatter
lib/numerology.js                        # Mulank and Bhagyank calculator
supabase/schema.sql                      # Base application schema
supabase/migration_v9_kundli_engine.sql  # Additive Kundli chart schema (RLS enabled)
tests/kundli.test.mjs                    # Kundli calculation test suite
FINAL_AUDIT_REPORT.md                    # Project verification & audit certificate
```

## Setup Environment Variables in Vercel
- `DRASHTA_API`: Groq API Key (`gsk_...`)
- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Secret Key
- `GROQ_MODEL`: Optional (defaults to `openai/gpt-oss-120b`)

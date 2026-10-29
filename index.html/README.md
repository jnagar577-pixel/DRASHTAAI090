# Turiya AI

Existing Turiya AI frontend and serverless backend. The UI is preserved from the supplied project HTML; the intake flow and backend error handling have been tightened.

## Project files

- `index.html`: complete frontend application.
- `api/ask.js`: serverless chat/intake API. Privileged Supabase access remains server-side.
- `lib/vedastro.js`: VedAstro client and chart calculations, including birth-location timezone offset handling.
- `lib/kundli-service.js`: chart validation, Supabase persistence/cache, and chart context formatting.
- `lib/numerology.js`: existing numerology helper.
- `supabase/schema.sql`: core conversation and message tables used by the backend.
- `supabase/migration_v9_kundli_engine.sql`: adds the saved kundli chart table.
- `tests/kundli.test.mjs`: existing calculation tests.
- `.env.example`: names of required server environment variables, with no secrets.

## Environment variables

Configure these in the serverless deployment environment, not in frontend HTML:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DRASHTA_API` (Groq API key used by the existing backend)
- `GROQ_MODEL` (optional; defaults to `openai/gpt-oss-120b`)

## Local checks

Run `npm install`, then `npm test`. Run the app in the project's supported serverless environment so `/api/ask` is available.

## Supabase warning

The connected Supabase project inspection available during this fix returned no tables and no migration records. This does not prove that no tables exist in another project or deployment, but the app cannot retrieve or delete server-side data unless the configured project contains the expected schema. Review `supabase/schema.sql` and `supabase/migration_v9_kundli_engine.sql` against the intended project before running either. Neither file was run against the live database as part of this fix.

## Current implementation limits

- The API now requires chart calculation plus a successful `user_kundli_charts` save before reporting a successful intake. Conversation reads/writes now use the schema’s `token_hash` and `chart_summary` columns, and deletion explicitly removes linked `messages` before deleting the conversation.
- The frontend sends recent local chat history to the AI request, but server-side message persistence/retrieval through the existing `messages` table is not implemented in this package because its actual column schema was not provided. Browser localStorage alone is not equivalent to durable server-side chat history.
- Feedback controls exist in the frontend, but the backend's `feedback` action still needs to be matched to the actual `feedback` table schema.
- Live VedAstro, geocoding, Groq, Supabase read/write, deployed browser flow, and cross-user isolation have not been tested from this workspace. Do not treat local unit tests as live integration proof.
- The current anonymous browser-token approach is a session identifier, not account authentication. Do not treat it as proof of a verified real-world user identity.

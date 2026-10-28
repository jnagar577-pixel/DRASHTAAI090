# Drashta AI — Swami Atma Jagran

Vedic jyotish margdarshan chatbot. Frontend static hai, backend Vercel serverless function (`api/ask.js`) hai, aur memory Supabase mein store hoti hai.

## Folder structure
```
index.html            Frontend (chat, intake form, feature buttons)
api/ask.js            Backend: chat, intake, feedback, delete (Groq + Supabase)
supabase/schema.sql   Database tables aur functions
tests/ask.test.mjs    Backend tests (mock Supabase + Groq, internet ki zaroorat nahi)
package.json
```

## Setup (ek baar)

### 1. Supabase
1. Supabase project banayiye.
2. SQL Editor mein `supabase/schema.sql` ka poora content chalayiye.
3. Project Settings → API se do cheezein lijiye:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (ye secret hai, kabhi frontend ya GitHub mein nahi)

### 2. Groq
- console.groq.com par key banayiye. Ye `DRASHTA_API` naam se Vercel mein jayegi.

### 3. Vercel → Settings → Environment Variables
| Naam | Value | Type |
|---|---|---|
| `DRASHTA_API` | Groq key (`gsk_...`) | Secret |
| `SUPABASE_URL` | Supabase Project URL | Plain |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | Secret |
| `GROQ_MODEL` | `openai/gpt-oss-120b` (optional, default yahi hai) | Plain |
| `ALLOWED_ORIGINS` | Extra domains, comma se (optional) | Plain |
| `DEBUG_ERRORS` | `1` sirf debugging ke liye, production mein nahi | Plain |

Har variable ke liye **Production** environment tick kijiye. Phir **Redeploy** kijiye.

Purane variables `GEMINI_MODEL` aur `GEMINI_API_KEY` ko delete kar dijiye.

## Kaise kaam karta hai
- Browser ek random token banata hai aur localStorage mein rakhta hai. Server us token ka SHA-256 hash Supabase mein store karta hai. Raw token server par kabhi save nahi hota.
- Intake form ka data `conversations` table mein jaata hai. Summary sirf user ke diye fields se banti hai, model se nahi, taaki galat andaaze na lagen.
- Har chat message ke saath server pichle 10 messages aur kundli data model ko bhejta hai. Isliye bot pichli baatein yaad rakhta hai.
- Daily limit (100 messages) server par `bump_usage` function se track hoti hai.
- "Nayi shuruaat" dabane par server se sara data (conversation, messages, feedback) delete ho jaata hai.

## Testing
```bash
node --test tests/ask.test.mjs
```
Ye 13 tests check karte hain: token validation, consent, memory isolation, model fallback, daily limit, feedback ownership, delete, aur error handling.

## Privacy
- Chart ka data personal hai. Intake form mein consent lena zaroori hai.
- Browser Supabase ko directly call nahi karta. Sab kuch `/api/ask` ke through hota hai.
- Supabase tables par RLS on hai, aur anon key se koi access nahi hai.
- Privacy policy ka legal text alag se banwayiye, ise Digital Personal Data Protection Act 2023 ke hisaab se review karwayiye.

## Limitations
- Token browser ke localStorage mein hai. Agar user browser data clear kare to memory chali jaayegi. Login system baad mein add kar sakte hain.
- Daily limit token par hai, user par nahi.

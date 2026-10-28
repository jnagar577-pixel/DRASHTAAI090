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

## Troubleshooting: "Server setup adhoora hai"

Ye error tab aata hai jab server par zaroori variable set nahi hota ya Supabase se connect nahi ho pata.

**Step 1: Health check kholiye.** Browser mein ye URL kholiye (apni site ka naam daalkar):
```
https://YOUR-SITE.vercel.app/api/ask
```
Ye JSON dikhayega, jaise:
```json
{ "ok": false, "env": { "SUPABASE_URL": true, "SUPABASE_SERVICE_ROLE_KEY": false, "DRASHTA_API": true }, "database": "skipped (Supabase env missing)" }
```
- `false` wala variable Vercel mein galat naam se ya Production environment mein nahi hai.
- `database: "error (HTTP 401)"` ka matlab key galat hai. `HTTP 404` ka matlab schema nahi chala ya URL galat hai.
- Value kabhi nahi dikhayi jaati, sirf true/false.

**Step 2: Vercel variables.** Naam bilkul ye hone chahiye (capital letters, underscore):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Secret)
- `DRASHTA_API`

Har ek ke liye **Production** tick hona chahiye. Variable badalne ke baad **Redeploy** (cache off) zaroor karein.

**Step 3: Supabase.** `supabase/schema.sql` SQL Editor mein chal chuka hona chahiye. Health check mein `database: ok` aana chahiye.

## Health check ka matlab (v5)
`/api/ask` (GET) ab 3 cheezein check karta hai: env variables, Supabase database (`conversations` table), aur Groq key (`groq: ok`). `rpc: ok` ka matlab `bump_usage` function kaam kar raha hai. Koi bhi `ok` nahi hai to `ok: false` aayega aur wajah field mein dikhegi.

## Debug mode
Vercel mein `DEBUG_ERRORS` = `1` set karke redeploy karein. Tab chat mein error ke saath asli wajah `[debug: ...]` mein dikhegi. Problem solve hone par `DEBUG_ERRORS` hata dein.

## Brand knowledge (v6)
Swami ji, website, reports aur consultation ki jaankari ab Supabase ki `knowledge_base` table mein hai. Setup ke liye `supabase/migration_v6_knowledge.sql` SQL Editor mein chalayein. Baad mein Table Editor se `content` edit karke koi bhi jaankari badal sakte hain, redeploy ki zaroorat nahi. Upay sirf tab aate hain jab user khud poochhe.

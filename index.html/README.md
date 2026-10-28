# Drashta AI — Deploy karne ke steps

Is folder mein 3 cheezein hain:
- `index.html` — frontend chatbot (jo browser mein dikhta hai)
- `api/ask.js` — backend function jo secretly Gemini ko call karta hai
- `package.json` — zaroori settings file

## Deploy kaise karein (Vercel — free)

1. Is poore folder ko GitHub par ek naye repository mein upload kar dijiye.
2. **vercel.com** par jaake apne GitHub account se login kijiye.
3. "Add New Project" → apna repo select kijiye → "Deploy" dabaiye (koi setting badalne ki zaroorat nahi).
4. Deploy hone ke baad: Project ke **Settings → Environment Variables** mein jaake naya variable banaiye:
   - Name: `DRASHTA_API`
   - Value: apni Gemini API key (jo aapne is naam se Google AI Studio/Gemini mein banayi hai)
5. Phir **Deployments** tab mein jaake "Redeploy" dabaiye, taaki naya variable load ho jaye.
6. Bas — Vercel aapko ek link dega (jaise `drashta-ai.vercel.app`), jahan poora chatbot live hoga.

## Apni website (swamiatmajagran.in) se jodna

Do tareeke hain:
- **Simple:** Apni website par ek button/link lagaiye jo seedha `drashta-ai.vercel.app` par le jaye.
- **Embedded:** Apni website ke kisi page mein ek `<iframe src="https://drashta-ai.vercel.app"></iframe>` daal dijiye, taaki chatbot seedha aapki site ke andar dikhe.

## Zaroori baatein

- Apni Gemini API key kabhi bhi kisi file mein (ya mujhe chat mein) mat bhejiye — sirf Vercel ke "Environment Variables" wale section mein `DRASHTA_API` naam se daaliye, wahi sabse surakshit jagah hai.
- Model ka naam badalna ho to `GEMINI_MODEL` naam ka ek aur environment variable bana sakte hain (default `gemini-2.5-flash` hai).
- Abhi daily-100-message limit sirf browser mein track hoti hai (localStorage) — koi genuine user isse kabhi nahi todega, lekin ek tech-savvy insaan isse bypass kar sakta hai. Agar future mein iski real/strict enforcement chahiye, to usko bhi server-side (database ke saath) banana hoga.

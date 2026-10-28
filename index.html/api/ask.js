// api/ask.js
// Yeh Vercel serverless function hai — Gemini API key yahan kabhi likhi nahi jaati.
// Key Vercel dashboard me "Environment Variable" (DRASHTA_API) ki tarah set hoti hai.

const SYSTEM_PROMPT = `Tum "Drashta AI" ho — Swami Atma Jagran (swamiatmajagran.in) ke AI Vedic astrology aur spiritual guidance assistant. Tumhare banane wale Jatin Nagar hain, ek Osho "Zorba the Buddha" sanyasi aur 3+ saal se practicing Vedic astrologer.

CORE TASK: User jo Lagan Maya Sutra / Shukra Maya Sutra / D10 Destiny Sutra / Bhagya Sutra ka text paste karega, usi diye gaye data par Brihat Parashara Hora Shastra (BPHS) ke classical rules apply karke jawab do — house lordship, karakas, nakshatra-swami, drishti, dasha-antardasha, yoga-formation (Raja yoga, Dhana yoga, Gajakesari, Budhaditya, etc.). KHUD SE KOI NAYA PLANETARY CALCULATION MAT KARO — sirf jo data diya gaya hai usi par sutra apply karo.

TOPIC-BASED HONESTY: Agar user ke paas sirf Lagan Maya Sutra hai aur woh marriage (D9/Shukra chahiye) ya career (D10 chahiye) jaisa deep sawal poochhe jiske liye extra chart data zaroori hai, to transparently batao ki iske liye kaunsa report chahiye hoga — sales-pitch ki tarah nahi, ek sachi, madadgar baat ki tarah.

TONE: Vinamra, shaant, bina judgement, jaise ek samajhdar bada bhai/guide. Hindi-Hinglish mix. Kabhi debate ya argue mat karo — agar user asehmat ho, usse soft se accept karo. Kabhi "yeh zaroor hoga" jaisi 100% certainty wali bhasha mat bolo — "chart yeh sanket deta hai" jaisi bhasha use karo. Balance rakho — Shani/Rahu/Ketu jahan patience/struggle dikhayein wo bhi honestly batao, sirf positive mat bolo.

FORMAT: Chhota warm acknowledgment → connected analysis (classical rule + practical matlab) → honest balanced summary. 150-220 shabdon mein poora jawab do jab tak user khud na kahe ki aur vistar se batao.

GUARDRAILS: Health/legal/bade financial sawalon par astrology ke saath practical advice bhi do. Sensitive emotional topics par emotional support bhi do. User ka chart data store/share mat karo bina permission ke.

---
GYAAN-AADHAR (swamiatmajagran.in se liya gaya — pricing/details yahan update karte rahiyega jaise-jaise website badle):

SWAMI ATMA JAGRAN KE BAARE MEIN: "Main ek Zorba the Buddha sanyasi hoon, jisne Osho ki upasthiti mein sannyas liya hai. Main ek modern-age youth monk hoon, jo orthodox fundamentalism, andhvishwas aur dharm ke naam par shoshan karne walon ke khilaf khada hai. Satya ki khoj mein, main dhyan, samadhi aur jyotish ke gehre rahasyon mein utarta hoon, taaki saccha jigyasu apni antarik sawbhoumikta aur jagran ki taraf badh sake." — yahi unka apna parichay hai.

REPORTS / SECRET AI PROMPTS (sabhi mein 'Lifetime AI Access' milta hai, matlab wahi prompt baar-baar kisi bhi AI mein use kiya ja sakta hai):
- **Swarnima Janm Patrika** — Free. Charts: D1. Isme milta hai: D1 Chart Analysis, Grah Gochar (planetary transits), Love & Marriage guidance ki jhalak.
- **Lagan Maya Sutra ("Who Am I?")** — ₹299. Charts: D1 Lagan & Arudha Lagan. 3-page PDF Report + Lifetime AI Access. Insaan ke asli swaroop aur "public mask" (Maya) ka nirpaksh vishleshan karta hai.
- **Shukra Maya Sutra ("Love & Shackles")** — ₹399. Charts: D1, D9, Chandra Chart & Venus (Shukra) Analysis. 3-page PDF + Lifetime AI Access. Rishton, romantic life, emotional patterns aur vivah ka gehra, nishpaksh vishleshan.
- **D10 Destiny Sutra ("The Trap of Kingdom")** — ₹799. Charts: D1, D9, D10, Nakshatra degrees & aspects. 5-page Master PDF + Master Prompt Suite. Career aur wealth ke raaste ke avarodh aur safalta ka vishleshan.
- **Divya Bhagya Sutra** — ₹999 (premium master bundle). Charts: D1, D9 & Chandra. Isme Lagan + Shukra dono Sutra ka gyaan + Nakshatra predictions + Dasha periods + poora life overview + soul purpose guidance ek saath milta hai.
- **Guna Milan (Ashta Koot)** — Free online tool, var-vadhu ki janm-kundli se 36 guno ka milan nikalta hai.
- **Daily Rashifal** — sabhi 12 rashiyon ka roz ka rashifal aur mantra, website par free available hai.

CONSULTATIONS (live sessions, astrologer/Swami Ji ke saath, audio ya video):
- **Individual Clarity Session** — ₹999 (30 min/1 hr/2 hr options). Personal alignment aur life-direction ke liye.
- **Partnership & Harmony Session** — ₹1,299. Couples ke liye — compatibility, relationship bottlenecks, joint spiritual growth.
- **VIP Ashram Master Panel** — ₹1,999 se shuru (GST included), 1-3 hours. Swami Atmajagran Ji se seedha, face-to-face, Ashram mein milna — kundli samne baithkar explain hoti hai, turant remedies milte hain. Yeh sabse exclusive option hai.

DELIVERY & PROCESS: Reports payment ke baad 24 ghante ke andar customer ke WhatsApp par deliver hoti hain. Sabhi details aur payment 100% confidential rakhe jaate hain.

AGAR USER IN CHEEZON KE BAARE MEIN POOCHHE (Swami Atma Jagran kaun hain, koi product/report kya hai, pricing kya hai, consultation kaise book karein): seedha, warmly, isi gyaan-aadhar se poora jawab do — chart ki zaroorat nahi hai is tarah ke sawal ke liye, "pehle chart dijiye" mat kahna. Agar koi bahut specific/badal sakne wali cheez poochhe (jaise exact offer ya naya launch), to bhi upar di gayi jaankari confidently do, aur sirf itna jod do ki latest updates swamiatmajagran.in par bhi dekh sakte hain.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Sirf POST allowed hai' });

  const { name, reportType, chartData, query } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query zaroori hai' });

  const apiKey = (process.env.DRASHTA_API || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'Server par DRASHTA_API set nahi hai' });

  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let contextBlock;
  if (query === '__CHART_CONFIRM__') {
    contextBlock = `User ka naam: ${name || 'batayi nahi'}\nReport type: ${reportType || 'batayi nahi'}\nChart/Maya Sutra data:\n${chartData}\n\nNIRDESH: Sirf 1-2 line mein, ${name || 'user'} ji ko unke chart ka ek chhota, warm confirmation dijiye — jaise unki Lagan rashi kya hai aur ek khaas cheez jo turant dikhti hai. ZYADA VISTAR, analysis, ya salah MAT DO — sirf confirmation ki data sahi mil gaya hai.`;
  } else {
    contextBlock = `User ka naam: ${name || 'batayi nahi'}\nReport type: ${reportType || 'batayi nahi'}\nChart/Maya Sutra data:\n${chartData || '(abhi nahi diya gaya)'}\n\nUser ka sawal: ${query}`;
  }

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: contextBlock }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
      })
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error('Gemini HTTP error:', r.status, JSON.stringify(data));
      return res.status(502).json({
        error: `Gemini error ${r.status}: ${data?.error?.message || 'unknown'}`
      });
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('')
      .trim();

    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'unknown';
      console.error('Gemini empty response:', JSON.stringify(data));
      return res.status(502).json({ error: `Model ne khaali jawab diya (reason: ${reason})` });
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Fetch failed:', err);
    return res.status(500).json({ error: 'Server error: ' + String(err) });
  }
}

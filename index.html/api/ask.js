// api/ask.js
// Yeh Vercel serverless function hai. Groq API key yahan likhi nahi jaati,
// Vercel Environment Variable (DRASHTA_API) se aati hai.

const SYSTEM_PROMPT = `Tum "Drashta AI" ho, Swami Atma Jagran (swamiatmajagran.in) ki ek shaant, sneh-bhari Vedic jyotish sathi. Tum ek anubhavi, nek aur samajhdar jyotish guide ki tarah baat karte ho: dheere, aatmiyata se, bina daraye, bina dikhawe ke.

MUKHYA KAAM
- User ki di gayi kundli ya chart ke aadhar par hi margdarshan do. Classical BPHS ki samajh use karo, lekin bhasha saral aur jeevan se judi rakho.
- Naye grah-sthiti ya degree khud se calculate mat karo. Jo data diya gaya hai wahi istemaal karo.
- Agar diya gaya data adhoora ya aapas mein ulajha hua lage (jaise lagan ya degree do jagah alag dikhe), to narmi se kaho: "Aapke diye gaye vivran mein kuch baatein ek-doosre se mel nahi khati, isliye main unhi baaton par dhyan dunga jo saaf hain." Phir ek chhota, spasht sawal poochho. Andaaze se lagan ya degree kabhi mat batao.

TONE
- Warm, soft, shaant. "ji" ka istemaal karo. Aatmiyata wali bhasha, jaise koi bhrosemand guide baat kar raha ho.
- Kabhi harsh, rigid ya robotic mat ho. "Yeh zaroor hoga" ya "aapko yeh karna hi padega" mat kaho. "Kundli ka sanket hai", "ho sakta hai", "ek sambhavna dikhti hai" jaisi bhasha use karo.
- Dar paida karne wali baat mat karo. Shani, Rahu, Ketu jaise grahon ki chunautiyan bhi naram aur santulit tareeke se batao, saath mein unki shakti aur sudhar ki sambhavna bhi.
- Kabhi debate mat karo. Agar user asehmat ho, to samajhdari se sunkar apna drishtikon dhire se rakho.

REPORTS AUR PRODUCTS KE BAARE MEIN (sabse zaroori niyam)
- D10 Destiny Sutra, Shukra Maya Sutra, Bhagya Sutra ya kisi bhi paid report ka naam tab tak mat lo jab tak user khud na poochhe (jaise "aur report kaise milegi", "price kya hai"), ya woh career ya vivah jaise bahut gehre sawal na pooche jinke liye sach mein extra chart data chahiye.
- Aisi sthiti mein bhi sirf ek baar, bahut soft tareeke se, ek vaakya mein bataao ki aur gehraai ke liye vistrit chart dekhna madadgar hoga. Bar-bar, sales-pitch ki tarah ya dabav dekar mat kaho.
- Pehle hamesha user ki kundli ke aadhar par jitna ho sake utna margdarshan do.

FORMAT
- Chhota aur saaf jawab: aam taur par 120 se 200 shabd. Gehre sawal par thoda lamba ho sakta hai.
- Saaf paragraphs mein likho. Table mat banao. Bullet points sirf tab, jab sach mein zaroori hon, aur har bullet ek poori baat ho.
- Bold ka istemaal kam karo, sirf ek-do mukhya shabdon ke liye.
- Har jawab ka ant ek narm sawal ya aamantran se karo, jaise "Kya aap is par aur vistar se janna chahenge?" Ek baar mein ek hi sawal.
- Pehle se diye gaye jawab ko dobara mat dohraao. Baat-cheet ko aage badhao.

UPAY
- Upay hamesha saral, sahaj aur bina kharche wale rakho: achhi roz ki aadat, dhyan, seva, shaant soch, aur agar user ko achha lage to mantra japna.
- Kabhi mehenge upay, ratna pehnne ki zid, ya paise dene ki salah mat do. Koi upay "zaroori" ya "bina iske kuch nahi hoga" ki tarah mat batao.

SENSITIVE VISHAY
- Sehat, kanooni ya bade arthik faisalon par astrology ke saath saadharan, vivekpoorn salah bhi do, aur zaroorat ho to narmi se kisi doctor, vakil ya financial salahkar se milne ka sujhav do.
- Agar user dukhi, akela ya kisi gehri pareshani mein lage, to pehle bhavnaon ko samjho aur sahara do. Kisi bhi haal mein nirasha ko badhava mat do. Zaroorat lage to kisi bharosemand vyakti ya professional se baat karne ko kaho.
- Chart ka data kabhi share mat karo aur user ki privacy ka dhyan rakho.

GYAAN-AADHAR (sirf tab upyog karo jab user Swami Atma Jagran, products ya consultation ke baare mein seedha pooche)
Swami Atma Jagran ek Osho-prerit sanyasi hain jo dhyan, samadhi aur jyotish ke gehre rahasyon mein utarte hain, aur chahte hain ki saccha jigyasu apni antarik sawbhoumikta ki taraf badhe.
Reports: Swarnima Janm Patrika (free, D1), Lagan Maya Sutra (₹299), Shukra Maya Sutra (₹399), D10 Destiny Sutra (₹799), Divya Bhagya Sutra (₹999), Guna Milan (free tool), Daily Rashifal (free). Sabhi paid reports ke saath Lifetime AI Access milta hai.
Consultations: Individual Clarity Session (₹999), Partnership & Harmony Session (₹1,299), VIP Ashram Master Panel (₹1,999 se shuru, GST included).
Reports payment ke baad 24 ghante mein WhatsApp par milti hain. Jaankari confidential rehti hai. Latest jaankari ke liye swamiatmajagran.in dekhne ka sujhav do.

CHART KI PEHLI PUSHTI (jab user pehli baar chart paste kare)
- Sirf 2 se 3 line mein garmjoshi se swagat karo, aur user ke naam ka upyog karo. Lagan ya kisi grah ka naam tabhi lo jab woh data mein saaf likha ho. Poori analysis abhi mat do.

Ye sab niyam Drashta AI ke har jawab par lagu hote hain.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Sirf POST allowed hai' });

  const { name, reportType, chartData, query } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query zaroori hai' });

  // Groq key: DRASHTA_API ya GROQ_API_KEY, jo bhi Vercel mein set ho
  const apiKey = (process.env.DRASHTA_API || process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) return res.status(500).json({ error: 'Server par Groq API key (DRASHTA_API) set nahi hai' });

  // Primary model (env se) + fallback chain. Sirf wahi models jo Groq par abhi active hain.
  const primaryModel = (process.env.GROQ_MODEL || 'openai/gpt-oss-20b').trim();
  const models = [...new Set([primaryModel, 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'])];

  let contextBlock;
  if (query === '__CHART_CONFIRM__') {
    contextBlock = `User ka naam: ${name || 'batayi nahi'}\nReport type: ${reportType || 'batayi nahi'}\nChart/Maya Sutra data:\n${chartData}\n\nNIRDESH: Sirf 1-2 line mein, ${name || 'user'} ji ko unke chart ka ek chhota, warm confirmation dijiye — jaise unki Lagan rashi kya hai aur ek khaas cheez jo turant dikhti hai. ZYADA VISTAR, analysis, ya salah MAT DO — sirf confirmation ki data sahi mil gaya hai.`;
  } else {
    contextBlock = `User ka naam: ${name || 'batayi nahi'}\nReport type: ${reportType || 'batayi nahi'}\nChart/Maya Sutra data:\n${chartData || '(abhi nahi diya gaya)'}\n\nUser ka sawal: ${query}`;
  }

  let lastError = 'Model se jawab nahi mila';

  for (const model of models) {
    const body = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contextBlock }
      ],
      temperature: 0.7,
      max_completion_tokens: 4096
    };
    // gpt-oss models reasoning karte hain; low se jawab tez aata hai aur tokens bachte hain
    if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';

    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        const msg = data?.error?.message || 'unknown';
        console.error(`Groq error (${model}):`, r.status, msg);
        lastError = `Groq error ${r.status} (${model}): ${msg}`;
        // Model band/galat ho to agla model try karein; key ya request ki galti par ruk jayein
        if (r.status === 404 || (r.status === 400 && /model/i.test(msg))) continue;
        if (r.status === 401 || r.status === 403) break;
        return res.status(502).json({ error: lastError });
      }

      const text = (data?.choices?.[0]?.message?.content || '').trim();
      if (!text) {
        lastError = `Model (${model}) ne khaali jawab diya`;
        console.error(lastError, JSON.stringify(data));
        continue;
      }

      return res.status(200).json({ text });
    } catch (err) {
      console.error('Fetch failed:', err);
      lastError = 'Server error: ' + String(err);
    }
  }

  return res.status(502).json({ error: lastError });
}

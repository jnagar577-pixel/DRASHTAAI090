// api/ask.js — Drashta AI backend (Vercel serverless function)
// Browser sirf /api/ask ko call karta hai. Groq key aur Supabase service key sirf server par rehti hain.
import { createHash } from 'node:crypto';

const SYSTEM_PROMPT = `Tum "Drashta AI" ho, Swami Atma Jagran (swamiatmajagran.in) ki ek shaant, sneh-bhari Vedic jyotish sathi. Tum ek anubhavi, nek aur samajhdar jyotish guide ki tarah baat karte ho: dheere, aatmiyata se, bina daraye, bina dikhawe ke.

MEMORY AUR SANDARBH
- Tumhe is baatcheet ke pichle messages diye jayenge. Unhe dhyan mein rakho aur unhe aage badhao.
- Jo baat pehle ho chuki hai (naam, janm tithi, lagan, pichle jawab) use dobara mat poochho aur dobara mat dohraao, jab tak user khud kuch naya na bataye.
- "KUNDLI DATA" mein jo likha hai wahi sach maano. Jo data nahi hai, uska andaaza mat lagao. Zaroorat ho to ek chhota, narm sawal poochho.

MUKHYA KAAM
- Kundli data ke aadhar par margdarshan do. Classical BPHS ki samajh use karo, lekin bhasha saral aur jeevan se judi rakho.
- Naye grah-sthiti ya degree khud se calculate mat karo.
- Agar data adhoora ya ulajha hua lage, to narmi se kaho ki kuch baatein saaf nahi hain, aur un par dhyan dene ke liye ek saaf sawal poochho. Andaaze se lagan ya degree kabhi mat batao.

TONE
- Warm, soft, shaant. "ji" ka istemaal karo. Aatmiyata wali bhasha, jaise koi bhrosemand guide baat kar raha ho.
- Kabhi harsh, rigid ya robotic mat ho. "Yeh zaroor hoga" ya "aapko yeh karna hi padega" mat kaho. "Kundli ka sanket hai", "ho sakta hai", "ek sambhavna dikhti hai" jaisi bhasha use karo.
- Dar paida karne wali baat mat karo. Shani, Rahu, Ketu jaise grahon ki chunautiyan bhi naram aur santulit tareeke se batao, saath mein unki shakti aur sudhar ki sambhavna bhi.
- Kabhi debate mat karo. Agar user asehmat ho, to samajhdari se sunkar apna drishtikon dhire se rakho.

REPORTS AUR PRODUCTS (sabse zaroori niyam)
- D10 Destiny Sutra, Shukra Maya Sutra, Bhagya Sutra ya kisi bhi paid report ka naam tab hi lo jab user khud poochhe (jaise price ya report kaise milegi), ya career ya vivah jaise bahut gehre sawal ke liye sach mein extra chart data chahiye ho.
- Aisi sthiti mein bhi sirf ek baar, bahut soft tareeke se, ek vaakya mein bataao ki aur gehraai ke liye vistrit chart dekhna madadgar hoga. Bar-bar ya dabav dekar mat kaho.
- Pehle hamesha kundli ke aadhar par jitna ho sake utna margdarshan do.

FORMAT
- Chhota aur saaf jawab: aam taur par 120 se 200 shabd. Gehre sawal par thoda lamba ho sakta hai.
- Saaf paragraphs mein likho. Table mat banao. Bullet points sirf tab jab zaroori hon, aur har bullet ek poori baat ho.
- Bold kam use karo, sirf ek-do mukhya shabdon ke liye.
- Har jawab ka ant ek narm sawal ya aamantran se karo. Ek baar mein ek hi sawal.

UPAY
- Upay hamesha saral, sahaj aur bina kharche wale rakho: achhi roz ki aadat, dhyan, seva, shaant soch, aur agar user ko achha lage to mantra japna.
- Kabhi mehenge upay, ratna pehnne ki zid, ya paise dene ki salah mat do. Koi upay "zaroori" ya "bina iske kuch nahi hoga" ki tarah mat batao.

SENSITIVE VISHAY
- Sehat, kanooni ya bade arthik faisalon par astrology ke saath saadharan, vivekpoorn salah bhi do, aur zaroorat ho to narmi se kisi doctor, vakil ya financial salahkar se milne ka sujhav do. Ye medical ya kanooni salah ka vikalp nahi hai.
- Agar user dukhi, akela ya gehri pareshani mein lage, to pehle bhavnaon ko samjho aur sahara do. Kisi bhi haal mein nirasha ko badhava mat do. Zaroorat ho to kisi bharosemand vyakti ya professional se baat karne ko kaho.
- Chart ka data kabhi share mat karo aur user ki privacy ka dhyan rakho.

GYAAN-AADHAR (sirf tab upyog karo jab user Swami Atma Jagran, products ya consultation ke baare mein seedha pooche)
Swami Atma Jagran ek Osho-prerit sanyasi hain jo dhyan, samadhi aur jyotish ke gehre rahasyon mein utarte hain, aur chahte hain ki saccha jigyasu apni antarik sawbhoumikta ki taraf badhe.
Reports: Swarnima Janm Patrika (free, D1), Lagan Maya Sutra (₹299), Shukra Maya Sutra (₹399), D10 Destiny Sutra (₹799), Divya Bhagya Sutra (₹999), Guna Milan (free tool), Daily Rashifal (free). Paid reports ke saath Lifetime AI Access milta hai.
Consultations: Individual Clarity Session (₹999), Partnership & Harmony Session (₹1,299), VIP Ashram Master Panel (₹1,999 se shuru, GST included).
Reports payment ke baad 24 ghante mein WhatsApp par milti hain. Jaankari confidential rehti hai. Latest jaankari ke liye swamiatmajagran.in dekhne ka sujhav do.`;

const RASHIS = ['मेष','वृषभ','मिथुन','कर्क','सिंह','कन्या','तुला','वृश्चिक','धनु','मकर','कुंभ','मीन'];
const LIMITS = { name: 100, dob: 10, birth_time: 5, birth_place: 150, notes: 8000, query: 1000, rashi: 20 };
const DAILY_LIMIT = 100;
const HISTORY_TURNS = 10;
const DEFAULT_MODEL = 'llama-3.1-8b-instant';
const FALLBACK_MODELS = ['llama-3.1-8b-instant', 'llama3-70b-8192'];
const BUSY_MSG = 'Abhi jawab taiyar karne mein thodi der lag rahi hai. Kripya kuch der baad phir koshish karein.';

class HttpError extends Error {
  constructor(status, message, code = 'UNKNOWN', detail = '') { super(message); this.status = status; this.code = code; this.detail = detail; }
}
function redacted(value) { return String(value || '').replace(/(gsk_|sk-|sb_secret_|eyJ)[A-Za-z0-9._-]+/g, '$1[REDACTED]'); }
function typed(status, code, message, detail = '') { return new HttpError(status, message, code, redacted(detail)); }

function cfg() {
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    supaUrl: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    supaKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    groqKey: (process.env.DRASHTA_API || process.env.GROQ_API_KEY || '').trim(),
    primaryModel: (process.env.GROQ_MODEL || DEFAULT_MODEL).trim(),
    debug: process.env.DEBUG_ERRORS === '1',
    allowedOrigins: ['https://swamiatmajagran.in', 'https://www.swamiatmajagran.in', ...extra],
  };
}

function setCors(req, res, c) {
  const origin = req.headers?.origin;
  if (origin && c.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function send(res, status, error, code = '', detail = '') {
  const suffix = code ? ` (code: ${code})` : '';
  const body = { error: `${error}${suffix}` };
  if (detail) body.detail = redacted(detail);
  return res.status(status).json(body);
}

function cleanStr(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function validToken(t) {
  return typeof t === 'string' && /^[A-Za-z0-9-]{32,128}$/.test(t);
}
function hashToken(t) {
  return createHash('sha256').update(t).digest('hex');
}
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------- Supabase (REST, service key ke saath) ---------- */
async function sb(c, path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: c.supaKey };
  if (c.supaKey.startsWith('eyJ')) headers.Authorization = `Bearer ${c.supaKey}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${c.supaUrl}/rest/v1/${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await r.text();
  let data = null;
  if (raw) { try { data = JSON.parse(raw); } catch { data = raw; } }
  if (!r.ok) {
    const rawMessage = typeof data === 'string' ? data : JSON.stringify(data);
    const code = path.startsWith('rpc/') ? (r.status === 404 ? 'SUPABASE_FUNCTION_MISSING' : 'SUPABASE_UNAVAILABLE') : (r.status === 401 || r.status === 403 ? 'SUPABASE_AUTH' : r.status === 404 ? 'SUPABASE_TABLE_MISSING' : 'SUPABASE_UNAVAILABLE');
    throw typed(502, code, code === 'SUPABASE_AUTH' ? 'Database authentication fail hui.' : 'Database service abhi available nahi hai.', rawMessage);
  }
  return data;
}

async function getConversation(c, hash) {
  const rows = await sb(c, `conversations?token_hash=eq.${hash}&select=*`);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function ensureConversation(c, hash) {
  const rows = await sb(c, 'conversations?on_conflict=token_hash', {
    method: 'POST',
    body: { token_hash: hash },
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return rows[0];
}

/* ---------- Intake ---------- */
function validateIntake(b) {
  if (b.consent !== true) return { error: 'Kundli bhejne se pehle sahmati (consent) dena zaroori hai.' };
  const d = {
    name: cleanStr(b.name, LIMITS.name),
    dob: cleanStr(b.dob, LIMITS.dob),
    birth_time: cleanStr(b.birth_time, LIMITS.birth_time),
    birth_place: cleanStr(b.birth_place, LIMITS.birth_place),
    lagan_rashi: cleanStr(b.lagan, LIMITS.rashi),
    moon_rashi: cleanStr(b.moon_rashi, LIMITS.rashi),
    notes: cleanStr(b.notes, LIMITS.notes),
  };
  if (!d.name) return { error: 'Kripya naam likhiye.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dob) || Number.isNaN(Date.parse(d.dob))) return { error: 'Janm tithi sahi format mein dijiye.' };
  if (d.birth_time && !/^\d{2}:\d{2}$/.test(d.birth_time)) return { error: 'Janm samay HH:MM format mein dijiye.' };
  if (!RASHIS.includes(d.lagan_rashi)) return { error: 'Lagan rashi chunein.' };
  if (d.moon_rashi && !RASHIS.includes(d.moon_rashi)) return { error: 'Chandra rashi sahi nahi hai.' };
  return { data: d };
}

// Summary sirf user ke diye gaye fields se banta hai, model se nahi (isse galat andaaze nahi lagte)
function buildSummary(d) {
  return [
    `नाम: ${d.name}`,
    `जन्म तिथि: ${d.dob}`,
    `जन्म समय: ${d.birth_time || 'पता नहीं'}`,
    d.birth_place ? `जन्म स्थान: ${d.birth_place}` : null,
    `लग्न राशि (user ke anusaar): ${d.lagan_rashi}`,
    d.moon_rashi ? `चंद्र राशि (user ke anusaar): ${d.moon_rashi}` : null,
    d.notes ? `User dwara diya gaya kundli/report ka text:\n${d.notes}` : null,
  ].filter(Boolean).join('\n');
}

/* ---------- Model (Groq) ---------- */
async function callModel(c, messages) {
  const models = [...new Set([c.primaryModel, ...FALLBACK_MODELS])];
  let lastErr = new Error('Koi model available nahi');
  for (const model of models) {
    const body = { model, messages, temperature: 0.6, max_completion_tokens: 4096 };
    if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'medium';

    let r;
    try {
      r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.groqKey}` },
        body: JSON.stringify(body),
      });
    } catch (e) { lastErr = e; continue; }

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || 'unknown';
      console.error(`Groq error code=${r.status === 401 || r.status === 403 ? 'GROQ_AUTH' : r.status === 429 ? 'GROQ_RATE_LIMIT' : r.status >= 500 ? 'GROQ_UNAVAILABLE' : 'GROQ_MODEL_MISSING'} status=${r.status}`);
      if (r.status === 401 || r.status === 403) throw typed(502, 'GROQ_AUTH', 'Drashta AI ki authentication key accept nahi hui.', msg);
      if (r.status === 429) throw typed(429, 'GROQ_RATE_LIMIT', 'Drashta AI par abhi bahut requests hain.', msg);
      if (r.status === 404 || (r.status === 400 && /model/i.test(msg))) { lastErr = typed(502, 'GROQ_MODEL_MISSING', 'Drashta AI ka model abhi available nahi hai.', msg); continue; }
      throw typed(502, 'GROQ_UNAVAILABLE', 'Drashta AI service abhi available nahi hai.', msg);
    }
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    if (text) return text;
    lastErr = new Error(`Model (${model}) ne khaali jawab diya`);
  }
  throw lastErr;
}

/* ---------- Actions ---------- */
async function handleChat(c, hash, b) {
  const query = cleanStr(b.query, LIMITS.query);
  if (!query) throw new HttpError(400, 'Apna sawal likhiye.');

  const conv = await ensureConversation(c, hash);

  const usageRaw = await sb(c, 'rpc/bump_usage', { method: 'POST', body: { p_hash: hash, p_day: todayUTC() } });
  const used = Number(Array.isArray(usageRaw) ? usageRaw[0] : usageRaw?.count ?? usageRaw);
  if (used > DAILY_LIMIT) {
    throw new HttpError(429, `Aaj ki ${DAILY_LIMIT} messages ki limit poori ho gayi hai 🙏 Kal phir baat kar sakte hain.`);
  }

  const past = await sb(c, `messages?conversation_id=eq.${conv.id}&select=role,content&order=id.desc&limit=${HISTORY_TURNS}`);
  const history = (Array.isArray(past) ? past : []).reverse().map(m => ({ role: m.role, content: m.content }));

  const context = conv.chart_summary
    || 'Abhi tak user ne apni kundli ki jaankari nahi bhari hai. Zaroorat ho to narmi se bharne ko kahein.';

  const text = await callModel(c, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `KUNDLI DATA (sirf yahi data sach mana jaye):\n${context}` },
    ...history,
    { role: 'user', content: query },
  ]);

  const rows = await sb(c, 'messages', {
    method: 'POST',
    body: [
      { conversation_id: conv.id, role: 'user', content: query },
      { conversation_id: conv.id, role: 'assistant', content: text },
    ],
    prefer: 'return=representation',
  });
  const bot = rows.find(r => r.role === 'assistant');
  return { text, messageId: bot.id, remaining: Math.max(0, DAILY_LIMIT - used) };
}

async function handleIntake(c, hash, b) {
  const v = validateIntake(b);
  if (v.error) throw new HttpError(400, v.error);
  const d = v.data;
  const conv = await ensureConversation(c, hash);
  const now = new Date().toISOString();
  await sb(c, `conversations?id=eq.${conv.id}`, {
    method: 'PATCH',
    body: {
      name: d.name, dob: d.dob,
      birth_time: d.birth_time || null,
      birth_place: d.birth_place || null,
      lagan_rashi: d.lagan_rashi,
      moon_rashi: d.moon_rashi || null,
      notes: d.notes || null,
      chart_summary: buildSummary(d),
      consent_at: now,
      updated_at: now,
    },
    prefer: 'return=minimal',
  });
  return { summary: buildSummary(d) };
}

async function handleFeedback(c, hash, b) {
  const messageId = Number(b.messageId);
  if (!Number.isInteger(messageId) || messageId <= 0) throw new HttpError(400, 'Message ID galat hai.');
  if (typeof b.helpful !== 'boolean') throw new HttpError(400, 'Feedback galat hai.');
  const conv = await getConversation(c, hash);
  if (!conv) throw new HttpError(404, 'Conversation nahi mili.');
  const owned = await sb(c, `messages?id=eq.${messageId}&conversation_id=eq.${conv.id}&role=eq.assistant&select=id`);
  if (!Array.isArray(owned) || !owned.length) throw new HttpError(404, 'Message nahi mila.');
  await sb(c, 'feedback?on_conflict=message_id', {
    method: 'POST',
    body: { message_id: messageId, helpful: b.helpful },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  return { ok: true };
}

async function handleDelete(c, hash) {
  // messages aur feedback cascade se apne-aap delete ho jaate hain
  await sb(c, `conversations?token_hash=eq.${hash}`, { method: 'DELETE', prefer: 'return=minimal' });
  return { ok: true };
}

/* ---------- Entry point ---------- */
export default async function handler(req, res) {
  const c = cfg();
  setCors(req, res, c);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') {
    const checks = { env: { supabaseUrl: Boolean(c.supaUrl), supabaseKey: Boolean(c.supaKey), groqKey: Boolean(c.groqKey) }, supabase: { conversations: false, rpc: false }, groq: { models: false } };
    const hints = [];
    if (!c.supaUrl || !c.supaKey) hints.push('Supabase environment variables are missing.');
    if (!c.groqKey) hints.push('Groq environment variable is missing.');
    if (c.supaUrl && c.supaKey) {
      try { await sb(c, 'conversations?select=id&limit=1'); checks.supabase.conversations = true; } catch { hints.push('Supabase conversations check failed.'); }
      try { await sb(c, 'rpc/bump_usage', { method: 'POST', body: { p_hash: 'health-check', p_day: todayUTC() } }); checks.supabase.rpc = true; } catch { hints.push('Supabase rpc/bump_usage check failed.'); }
    }
    if (c.groqKey) { try { const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${c.groqKey}` } }); checks.groq.models = r.ok; if (!r.ok) hints.push(`Groq models check returned HTTP ${r.status}.`); } catch { hints.push('Groq models check could not connect.'); } }
    return res.status(200).json({ status: hints.length ? 'degraded' : 'ok', checks, hint: hints.length ? hints.join(' ') : 'All configured services responded successfully.' });
  }
  if (req.method !== 'POST') return send(res, 405, 'Sirf POST allowed hai');

  if (!c.supaUrl || !c.supaKey) {
    console.error('SUPABASE_URL ya SUPABASE_SERVICE_ROLE_KEY set nahi hai');
    return send(res, 500, 'Server setup adhoora hai. Kripya thodi der baad koshish karein.', 'CONFIG_MISSING');
  }
  if (!c.groqKey) {
    console.error('DRASHTA_API (Groq key) set nahi hai');
    return send(res, 500, 'Server setup adhoora hai. Kripya thodi der baad koshish karein.', 'CONFIG_MISSING');
  }

  const b = req.body || {};
  if (!validToken(b.token)) {
    return send(res, 400, 'Session token galat hai. Page refresh karke dobara koshish karein.');
  }
  const hash = hashToken(b.token);

  try {
    let out;
    switch (b.action || 'chat') {
      case 'chat': out = await handleChat(c, hash, b); break;
      case 'intake': out = await handleIntake(c, hash, b); break;
      case 'feedback': out = await handleFeedback(c, hash, b); break;
      case 'delete': out = await handleDelete(c, hash); break;
      default: throw new HttpError(400, 'Action samajh nahi aaya.');
    }
    return res.status(200).json(out);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, err.message, err.code, c.debug ? `HTTP ${err.status}: ${err.detail || err.message}` : '');
    console.error('ask error code=UNKNOWN status=502');
    return send(res, 502, BUSY_MSG, 'UNKNOWN', c.debug ? String(err?.message || err) : '');
  }
}

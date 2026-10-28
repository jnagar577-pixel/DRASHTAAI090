// api/ask.js — Drashta AI backend (Vercel serverless function)
// Browser sirf /api/ask ko call karta hai. Groq key aur Supabase service key sirf server par rehti hain.
import { createHash } from 'node:crypto';

const SYSTEM_PROMPT = `Tum "Drashta AI" ho, Swami Atma Jagran ki website ka saathi. Tumhara swabhav unki vichardhara jaisa hai: Zorba the Buddha. Matlab jeevan ko poori tarah jeena, par saath mein bhitar shanti aur jagran rakhna. Tum modern, samajhdar aur saaf-dil ho. Andhvishwas, darr aur dhong ke khilaf ho, lekin kisi ka mazaak nahi udaate.

TONE (sabse zaroori)
- Hamesha soft, warm aur aatmiyata wali bhasha. "ji" ka istemaal karo.
- Kabhi harsh, rigid, dramatic ya darane wali baat mat karo.
- Bhasha saaf aur saral Hindi/Hinglish mein ho. Ek hi shabd ki do-do spellings ya Hindi-English ki ajeeb mix mat karo.
- Ek jawab mein 100 se 180 shabd kaafi hain. Gehre sawal par thoda lamba chalega.
- Ek baar mein sirf ek narm sawal poochho, aur sawal zaroori ho tabhi.

UPAY (bahut zaroori niyam)
- Upay, mantra, pani, daan, ratna ya koi bhi "karm" tabhi batao jab user saaf poochhe (jaise "upay batao", "kya karun"). Bina poochhe kabhi nahi.
- Jab poochhe, to ek ya do simple, free aur roz ki zindagi se judi cheezein batao. Har jawab mein wahi upay dobara mat likho.
- Mehenge upay, ratna pehnne ki zid, paise dene ki salah, ya "zaroor karna hi hoga" jaisi baat kabhi nahi.

REPETITION
- Pichle jawabon ki line ya upay dobara mat likho. Har jawab mein naya angle lao.
- Jo baat pehle ho chuki hai (naam, janm tithi, lagan) use dobara mat poochho.

PREDICTION AUR THEME KA DHANG
- "Hoga" ki jagah "sanket dikhta hai", "sambhavna hai", "ho sakta hai" kaho.
- Kisi bhi faisle ko user par chhodo. Use apni samajh aur chunav ki taqat ka ehsaas do (atma-nirbharta).
- Chunautiyan (Shani, Rahu, Ketu ke sanket) bhi naram aur santulit tareeke se batao, saath mein unki shakti aur sudhar ki sambhavna bhi.
- Kisi theme ko is tarah samjhao: pehle sthiti, phir sanket, phir user ke liye ek soch ya sawal.

SWAMI JI, WEBSITE AUR PRODUCTS
- Swami Atma Jagran, unki website, reports ya consultation ke baare mein jawab sirf neeche diye gaye "BRAND KNOWLEDGE" se do.
- Agar jaankari BRAND KNOWLEDGE mein na ho, to kaho ki ye jaankari abhi uplabdh nahi hai, aur swamiatmajagran.in par dekhne ka sujhav do. Andaaza mat lagao.
- Reports ke price ya kharidari ki baat tabhi karo jab user poochhe. Bina poochhe sales-pitch mat karo.
- Gehre career ya vivah ke sawal par ek baar, bahut soft tareeke se, bata sakte ho ki vistrit chart dekhna madadgar hoga. Bar-bar mat kaho.

CHART KA ISTEMAAL
- Kundli ke facts sirf "KUNDLI DATA" se lo. Lagan, Chandra rashi, grah ka bhav aur nakshatra wahi likho jo data mein saaf hain.
- Agar koi jaankari data mein nahi hai, to kaho ki wo chart mein spasht nahi hai. Kabhi andaaza mat lagao.
- Grah ka naam, rashi aur nakshatra alag-alag mat milao.

SENSITIVE VISHAY
- Sehat, kanooni ya bade arthik faisle par saadharan, vivekpoorn salah bhi do, aur zaroorat ho to narmi se kisi doctor, vakil ya financial salahkar se milne ka sujhav do.
- Agar user dukhi, akela ya gehri pareshani mein lage, to pehle bhavnaon ko samjho aur sahara do. Kisi bhi haal mein nirasha ko badhava mat do. Zaroorat ho to kisi bharosemand vyakti ya professional se baat karne ko kaho.
- Chart ya user ki personal jaankari kabhi share mat karo.`;

const RASHIS = ['मेष','वृषभ','मिथुन','कर्क','सिंह','कन्या','तुला','वृश्चिक','धनु','मकर','कुंभ','मीन'];
const LIMITS = { name: 100, dob: 10, birth_time: 5, birth_place: 150, notes: 8000, query: 1000, rashi: 20 };
const DAILY_LIMIT = 100;
const HISTORY_TURNS = 10;
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const BUSY_MSG = 'Abhi jawab taiyar karne mein thodi der lag rahi hai 🙏 Kripya kuch der baad phir koshish karein.';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function send(res, status, error, detail) {
  return res.status(status).json(detail ? { error, detail } : { error });
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
  // Legacy JWT service key (eyJ...) Bearer mein bhi jaati hai. Naya sb_secret_ key sirf apikey header mein.
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
    const err = new Error(`Supabase ${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    err.status = r.status;
    throw err;
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
      console.error(`Groq error (${model}):`, r.status, msg);
      lastErr = new Error(`Groq ${r.status} (${model}): ${msg}`);
      if (r.status === 404 || (r.status === 400 && /model/i.test(msg))) continue; // model band: agla try karo
      if (r.status === 401 || r.status === 403) break;                              // key galat: aage mat jao
      throw lastErr;
    }
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    if (text) return text;
    lastErr = new Error(`Model (${model}) ne khaali jawab diya`);
  }
  throw lastErr;
}

/* ---------- Brand knowledge (Supabase knowledge_base) ---------- */
async function loadKnowledge(c) {
  try {
    const rows = await sb(c, 'knowledge_base?select=topic,content&active=eq.true&order=id.asc&limit=20');
    return (Array.isArray(rows) ? rows : [])
      .map(r => `### ${r.topic}\n${String(r.content).slice(0, 4000)}`)
      .join('\n\n');
  } catch (e) {
    console.error('knowledge_base load failed:', e.status || e.message);
    return '';
  }
}

/* ---------- Actions ---------- */
async function handleChat(c, hash, b) {
  const query = cleanStr(b.query, LIMITS.query);
  if (!query) throw new HttpError(400, 'Apna sawal likhiye.');

  const conv = await ensureConversation(c, hash);

  const used = Number(await sb(c, 'rpc/bump_usage', { method: 'POST', body: { p_hash: hash, p_day: todayUTC() } }));
  if (used > DAILY_LIMIT) {
    throw new HttpError(429, `Aaj ki ${DAILY_LIMIT} messages ki limit poori ho gayi hai 🙏 Kal phir baat kar sakte hain.`);
  }

  const past = await sb(c, `messages?conversation_id=eq.${conv.id}&select=role,content&order=id.desc&limit=${HISTORY_TURNS}`);
  const history = (Array.isArray(past) ? past : []).reverse().map(m => ({ role: m.role, content: m.content }));

  const context = conv.chart_summary
    || 'Abhi tak user ne apni kundli ki jaankari nahi bhari hai. Zaroorat ho to narmi se bharne ko kahein.';

  const knowledge = await loadKnowledge(c);
  const text = await callModel(c, [
    { role: 'system', content: `BRAND KNOWLEDGE (Swami ji, website, reports aur consultation ke baare mein sirf inhi se jawab do):\n${knowledge || '(abhi uplabdh nahi)'}` },
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

/* ---------- Health check (GET /api/ask) ---------- */
// Sirf true/false aur status dikhata hai. Koi key ya URL value kabhi response mein nahi jaati.
async function healthCheck(c) {
  const env = {
    SUPABASE_URL: Boolean(c.supaUrl),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(c.supaKey),
    DRASHTA_API: Boolean(c.groqKey),
  };
  let database = 'skipped (Supabase env missing)';
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await sb(c, 'conversations?select=id&limit=1');
      database = 'ok';
    } catch (e) {
      database = `error (HTTP ${e.status || 'unknown'})`;
    }
  }
  // Groq key check: sirf status, koi response body nahi
  let groq = 'skipped (DRASHTA_API missing)';
  if (env.DRASHTA_API) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${c.groqKey}` },
      });
      groq = r.ok ? 'ok' : `error (HTTP ${r.status})`;
    } catch {
      groq = 'error (network)';
    }
  }
  // Daily counter function check (test row, sirf health ke liye)
  let rpc = 'skipped';
  if (database === 'ok') {
    try {
      await sb(c, 'rpc/bump_usage', { method: 'POST', body: { p_hash: 'health_check', p_day: todayUTC() } });
      rpc = 'ok';
    } catch (e) {
      rpc = `error (HTTP ${e.status || 'unknown'})`;
    }
  }
  const allEnv = Object.values(env).every(Boolean);
  return { ok: allEnv && database === 'ok' && groq === 'ok' && rpc === 'ok', env, database, groq, rpc };
}

/* ---------- Entry point ---------- */
export default async function handler(req, res) {
  const c = cfg();
  setCors(req, res, c);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json(await healthCheck(c));
  if (req.method !== 'POST') return send(res, 405, 'Sirf POST allowed hai');

  if (!c.supaUrl || !c.supaKey) {
    console.error('SUPABASE_URL ya SUPABASE_SERVICE_ROLE_KEY set nahi hai');
    return send(res, 500, 'Server setup adhoora hai. Kripya thodi der baad koshish karein.');
  }
  if (!c.groqKey) {
    console.error('DRASHTA_API (Groq key) set nahi hai');
    return send(res, 500, 'Server setup adhoora hai. Kripya thodi der baad koshish karein.');
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
    if (err instanceof HttpError) return send(res, err.status, err.message);
    console.error('ask error:', err);
    return send(res, 502, BUSY_MSG, c.debug ? String(err.message) : undefined);
  }
}

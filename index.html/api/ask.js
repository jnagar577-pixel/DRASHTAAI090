/** Serverless API for Turiya AI. Privileged Supabase operations stay server-side. */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { computeNumerology } from '../lib/numerology.js';
import { getOrComputeChart, formatChartForGrok } from '../lib/kundli-service.js';

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateIntake(body) {
  const { name, dob, birth_time, birth_place } = body;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) return 'Please enter a valid name.';
  if (!validDate(dob)) return 'Please enter a valid date of birth.';
  if (typeof birth_time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(birth_time)) return 'Please enter a valid exact birth time.';
  if (typeof birth_place !== 'string' || birth_place.trim().length < 2 || birth_place.trim().length > 150) return 'Please enter a clear birthplace (city and state/region).';
  return null;
}

function safeHistory(history, query) {
  const items = Array.isArray(history) ? history.slice(-12) : [];
  const sanitized = items
    .filter(item => item && ['user', 'assistant', 'bot'].includes(item.role) && typeof item.text === 'string')
    .map(item => ({
      role: item.role === 'bot' ? 'assistant' : item.role,
      content: item.text.slice(0, 4000)
    }))
    .filter(item => item.content.trim());
  if (!sanitized.length || sanitized[sanitized.length - 1].role !== 'user' || sanitized[sanitized.length - 1].content !== query) {
    sanitized.push({ role: 'user', content: query });
  }
  return sanitized;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const groqKey = process.env.DRASHTA_API;

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: Boolean(supabaseUrl && supabaseKey && groqKey),
      env: { SUPABASE_URL: Boolean(supabaseUrl), SUPABASE_SERVICE_ROLE_KEY: Boolean(supabaseKey), DRASHTA_API: Boolean(groqKey) },
      engine: 'VedAstro Lahiri integration configured; live calculation is not implied by this health check.'
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseUrl || !supabaseKey || !groqKey) return res.status(500).json({ error: 'Server configuration incomplete. Check server environment variables.' });

  const { token, action } = req.body || {};
  if (typeof token !== 'string' || token.length < 24 || token.length > 256) return res.status(400).json({ error: 'Invalid or missing session token.' });
  const tokenHash = hashToken(token);
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    if (action === 'intake') {
      const validationError = validateIntake(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });
      if (req.body.consent !== true) return res.status(400).json({ error: 'Consent is required.' });

      let chartResult;
      try {
        chartResult = await getOrComputeChart(supabase, tokenHash, {
          name: req.body.name.trim(), dob: req.body.dob, birth_time: req.body.birth_time, birth_place: req.body.birth_place.trim()
        });
      } catch (error) {
        console.error('[Kundli intake failed]', error?.message || 'Unknown calculation or persistence error');
        return res.status(502).json({ error: 'Kundli calculate ya save nahi ho saki. Birth details check karke dobara koshish karein.' });
      }

      if (!chartResult?.persisted || !chartResult?.chart?.d1_data?.Ascendant?.sign || !chartResult?.chart?.d9_data?.Ascendant?.sign || !Array.isArray(chartResult.chart.dasha_data) || chartResult.chart.dasha_data.length === 0) {
        return res.status(502).json({ error: 'Kundli ka complete data aur database save verify nahi ho saka. Kripya dobara koshish karein.' });
      }

      const chart = chartResult.chart;
      const asc = chart.d1_data.Ascendant;
      const summary = `Naam: ${chart.name}\nJanm: ${chart.dob} ${chart.birth_time}\nSthan: ${chart.birth_place}\nLagna: ${asc.sign} (${asc.degree}°), Nakshatra: ${asc.nakshatra} (Pada ${asc.pada})`;
      const { error: conversationError } = await supabase.from('conversations').upsert({
        user_token_hash: tokenHash,
        intake_summary: summary,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_token_hash' });
      if (conversationError) {
        console.error('[Conversation persistence failed]', conversationError.message);
        return res.status(502).json({ error: 'Kundli save ho gayi, lekin conversation context save nahi ho saka. Dobara koshish karein.' });
      }

      let numerology = null;
      try { numerology = computeNumerology(req.body.dob); } catch { /* Numerology is optional; kundli success does not depend on it. */ }
      return res.status(200).json({
        summary,
        numerology,
        chart: { lagan: asc.sign, d1: chart.d1_data, d9: chart.d9_data, dasha: chart.dasha_data, currentDasha: chart.current_dasha || {}, persisted: true },
        cached: Boolean(chartResult.cached),
        remaining: 100
      });
    }

    if (action === 'chat') {
      const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
      if (!query || query.length > 4000) return res.status(400).json({ error: 'Please enter a question up to 4,000 characters.' });

      const [{ data: conv, error: convError }, { data: savedChart, error: chartError }] = await Promise.all([
        supabase.from('conversations').select('*').eq('user_token_hash', tokenHash).maybeSingle(),
        supabase.from('user_kundli_charts').select('*').eq('user_token_hash', tokenHash).maybeSingle()
      ]);
      if (convError || chartError) return res.status(502).json({ error: 'Saved kundli context could not be retrieved. Please try again.' });
      if (!savedChart?.d1_data?.Ascendant?.sign || !savedChart?.d9_data?.Ascendant?.sign) {
        return res.status(409).json({ error: 'Pehle apni janm-details bharkar kundli taiyar kar lijiye. Uske baad main kundli ke aadhar par jawab de sakta hoon.' });
      }

      let systemPrompt = 'Aap Turiya AI hain, ek shaant, sahaj aur spasht Vedic jyotish margdarshak. User se aadar-yukt Hindi ya Hinglish mein baat karein. Saved chart facts aur interpretation ko alag rakhein. Missing chart facts invent na karein; uncertainty saaf batayein. Guaranteed predictions ka daava na karein.';
      if (conv?.intake_summary) systemPrompt += `\n\nJatak Summary:\n${conv.intake_summary}`;
      systemPrompt += formatChartForGrok(savedChart);

      const messages = [
        { role: 'system', content: systemPrompt },
        ...safeHistory(req.body.history, query)
      ];
      const groqRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.5, max_tokens: 1024 })
      });
      const groqJson = await groqRes.json().catch(() => ({}));
      if (!groqRes.ok) {
        console.error('[AI provider error]', groqRes.status, groqJson?.error?.message || 'Provider request failed');
        return res.status(502).json({ error: 'AI se jawab lene mein abhi dikkat aa rahi hai. Kripya thodi der baad dobara koshish karein.' });
      }
      const answer = groqJson.choices?.[0]?.message?.content;
      if (typeof answer !== 'string' || !answer.trim()) return res.status(502).json({ error: 'AI se khaali jawab mila. Kripya dobara koshish karein.' });
      return res.status(200).json({ text: answer, remaining: 99, messageId: crypto.randomUUID() });
    }

    if (action === 'delete') {
      const { error: chartDeleteError } = await supabase.from('user_kundli_charts').delete().eq('user_token_hash', tokenHash);
      if (chartDeleteError) return res.status(502).json({ error: 'Kundli data could not be deleted. Please try again.' });
      const { error: convDeleteError } = await supabase.from('conversations').delete().eq('user_token_hash', tokenHash);
      if (convDeleteError) return res.status(502).json({ error: 'Kundli was deleted but conversation data could not be deleted. Please try again.' });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action.' });
  } catch (err) {
    console.error('[Turiya API error]', err?.message || 'Unknown error');
    return res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  }
}

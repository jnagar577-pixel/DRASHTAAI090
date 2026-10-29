/**
 * api/ask.js - Serverless function for Turiya AI
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { computeNumerology } from '../lib/numerology.js';
import { getOrComputeChart, formatChartForGrok } from '../lib/kundli-service.js';

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
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
      env: {
        SUPABASE_URL: Boolean(supabaseUrl),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(supabaseKey),
        DRASHTA_API: Boolean(groqKey)
      },
      engine: 'VedAstro Lahiri v9 (Active)'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseUrl || !supabaseKey || !groqKey) {
    return res.status(500).json({ error: 'Server configuration incomplete.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { token, action } = req.body || {};
  if (!token || typeof token !== 'string' || token.length < 24) {
    return res.status(400).json({ error: 'Invalid or missing user token.' });
  }
  const tokenHash = hashToken(token);

  try {
    if (action === 'intake') {
      const { name, dob, birth_time, birth_place, lagan, consent } = req.body;
      if (!consent) return res.status(400).json({ error: 'Consent is required.' });

      const numerology = computeNumerology(dob);
      let chartResult = null;
      let chartNote = '';

      if (dob && birth_time && birth_place) {
        try {
          chartResult = await getOrComputeChart(supabase, tokenHash, { name, dob, birth_time, birth_place });
          if (chartResult?.chart?.d1_data) {
            const asc = chartResult.chart.d1_data.Ascendant;
            chartNote = `\\n• Astronomical Lagna: ${asc.sign} (${asc.degree}°), Nakshatra: ${asc.nakshatra} (Pada ${asc.pada})`;
          }
        } catch (e) {
          console.warn('[Kundli Notice]:', e.message);
        }
      }

      const summary = `• Naam: ${name}\\n• Janm: ${dob} ${birth_time || ''}\\n• Sthan: ${birth_place || 'N/A'}\\n• Lagan: ${lagan || chartResult?.chart?.d1_data?.Ascendant?.sign || 'N/A'}${chartNote}`;

      await supabase.from('conversations').upsert({
        user_token_hash: tokenHash,
        intake_summary: summary,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_token_hash' });

      return res.status(200).json({
        summary,
        numerology,
        chart: chartResult?.chart ? {
          lagan: chartResult.chart.d1_data.Ascendant.sign,
          d1: chartResult.chart.d1_data,
          d9: chartResult.chart.d9_data,
          currentDasha: chartResult.chart.current_dasha,
          persisted: chartResult.persisted,
          persistenceError: chartResult.persistenceError || null
        } : null,
        remaining: 100
      });
    }

    if (action === 'chat') {
      const { query } = req.body;
      const { data: conv } = await supabase.from('conversations').select('*').eq('user_token_hash', tokenHash).maybeSingle();
      const { data: savedChart } = await supabase.from('user_kundli_charts').select('*').eq('user_token_hash', tokenHash).maybeSingle();

      let systemPrompt = 'Aap Swami Atma Jagran ke Turiya AI hain — ek shant, sahaj aur spasht Vedic jyotish margdarshak. Hamesha aadar-yukt bhasha mein jawab dein.';
      if (conv?.intake_summary) systemPrompt += `\\n\\nJatak Summary:\\n${conv.intake_summary}`;
      if (savedChart?.d1_data) systemPrompt += formatChartForGrok(savedChart);

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          temperature: 0.5,
          max_tokens: 1024
        })
      });

      const groqJson = await groqRes.json();
      return res.status(200).json({
        text: groqJson.choices?.[0]?.message?.content || 'Kripya apna sawal dobara likhiye.',
        remaining: 99,
        messageId: crypto.randomUUID()
      });
    }

    if (action === 'delete') {
      await supabase.from('conversations').delete().eq('user_token_hash', tokenHash);
      await supabase.from('user_kundli_charts').delete().eq('user_token_hash', tokenHash);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

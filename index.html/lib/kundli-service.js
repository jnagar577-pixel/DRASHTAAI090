/**
 * lib/kundli-service.js - Kundli Database Cache & Grok Prompt Assembler
 */
import { resolveLocation, calculateVedicChart, RASHIS_HI } from './vedastro.js';

export async function getOrComputeChart(supabase, tokenHash, intakeData) {
  if (!supabase || !tokenHash) return { chart: null, persisted: false, persistenceError: 'No Supabase client' };
  const { name, dob, birth_time, birth_place } = intakeData;

  const { data: existing } = await supabase
    .from('user_kundli_charts')
    .select('*')
    .eq('user_token_hash', tokenHash)
    .maybeSingle();

  if (
    existing &&
    existing.dob === dob &&
    existing.birth_time === birth_time &&
    existing.birth_place.toLowerCase().includes(birth_place.trim().toLowerCase()) &&
    existing.d1_data?.Ascendant
  ) {
    return { chart: existing, cached: true, persisted: true };
  }

  const location = await resolveLocation(birth_place);
  const calcResult = await calculateVedicChart(dob, birth_time, location);

  const recordPayload = {
    user_token_hash: tokenHash,
    name: name || 'Jatak',
    dob,
    birth_time,
    birth_place: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone_offset: location.timezoneOffset,
    ayanamsha: 'Lahiri',
    d1_data: calcResult.d1,
    d9_data: calcResult.d9,
    dasha_data: calcResult.dasha,
    current_dasha: calcResult.currentDasha || {},
    updated_at: new Date().toISOString()
  };

  const { data: savedRecord, error: upsertErr } = await supabase
    .from('user_kundli_charts')
    .upsert(recordPayload, { onConflict: 'user_token_hash' })
    .select('*')
    .single();

  if (upsertErr) {
    return { chart: recordPayload, cached: false, persisted: false, persistenceError: upsertErr.message };
  }
  return { chart: savedRecord, cached: false, persisted: true };
}

export function formatChartForGrok(chartRecord) {
  if (!chartRecord?.d1_data?.Ascendant) return '';
  const d1 = chartRecord.d1_data;
  const d9 = chartRecord.d9_data;
  const cur = chartRecord.current_dasha;
  const ascIdx = d1.Ascendant.signIndex - 1;

  let out = '\\n\\n=== VERIFIED ASTRONOMICAL KUNDLI (CHITRA PAKSHA / LAHIRI) ===\\n';
  out += `Jatak: ${chartRecord.name} | DOB: ${chartRecord.dob} ${chartRecord.birth_time} | Place: ${chartRecord.birth_place}\\n`;
  out += `Lagna (D1): ${d1.Ascendant.sign} (${RASHIS_HI[ascIdx]}) ${d1.Ascendant.degree}°, Nakshatra: ${d1.Ascendant.nakshatra} (Pada ${d1.Ascendant.pada})\\n\\n`;

  out += '--- D1 (RASHI) PLACEMENTS ---\\n';
  const pList = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  for (const p of pList) {
    if (d1[p]) {
      const pIdx = d1[p].signIndex - 1;
      const hNum = ((pIdx - ascIdx + 12) % 12) + 1;
      out += `• ${p}: ${d1[p].sign} (${RASHIS_HI[pIdx]}) ${d1[p].degree}° in House ${hNum} | ${d1[p].nakshatra} (Pada ${d1[p].pada})\\n`;
    }
  }

  out += '\\n--- D9 (NAVAMSHA) PLACEMENTS ---\\n';
  out += `• Lagna (D9): ${d9.Ascendant?.sign}\\n`;
  for (const p of pList) {
    if (d9[p]) out += `• ${p} (D9): ${d9[p].sign}\\n`;
  }

  if (cur?.mahadasha) {
    out += '\\n--- ACTIVE VIMSHOTTARI DASHA (LEVEL 1-3) ---\\n';
    out += `• Mahadasha: ${cur.mahadasha} (Ends: ${cur.mahadashaEndDate || cur.endDate})\\n`;
    out += `• Antardasha: ${cur.antardasha} (Ends: ${cur.antardashaEndDate || cur.endDate})\\n`;
    out += `• Pratyantardasha: ${cur.pratyantardasha} (Window: ${cur.startDate} to ${cur.endDate})\\n`;
  }

  out += '\\nCRITICAL INSTRUCTION: Use ONLY these verified planetary longitudes, house placements, and Dasha periods. Do NOT recalculate or invent different planetary degrees or periods.\\n=== END VERIFIED KUNDLI ===\\n\\n';
  return out;
}

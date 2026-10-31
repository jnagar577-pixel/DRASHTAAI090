/**
 * Kundli calculation, persistence, and verified chart-context formatting.
 */
import { resolveLocation, calculateVedicChart, RASHIS_HI } from './vedastro.js';

function isCompleteChart(result) {
  return Boolean(
    result?.d1?.Ascendant?.sign &&
    result?.d9?.Ascendant?.sign &&
    Array.isArray(result?.dasha) && result.dasha.length > 0 &&
    result?.d1?.Moon?.totalLongitude !== undefined
  );
}

export async function getOrComputeChart(supabase, tokenHash, intakeData) {
  if (!supabase || !tokenHash) throw new Error('Database client or session identifier is missing.');
  const { name, dob, birth_time, birth_place } = intakeData;

  const { data: existing, error: readError } = await supabase
    .from('user_kundli_charts')
    .select('*')
    .eq('user_token_hash', tokenHash)
    .maybeSingle();

  if (readError) throw new Error(`Saved kundli could not be checked: ${readError.message}`);

  const normalizedInputPlace = String(birth_place || '').trim().toLowerCase();
  const normalizedSavedPlace = String(existing?.birth_place || '').trim().toLowerCase();
  if (
    existing &&
    existing.dob === dob &&
    String(existing.birth_time || '').slice(0, 5) === String(birth_time || '').slice(0, 5) &&
    (normalizedSavedPlace === normalizedInputPlace || normalizedSavedPlace.includes(normalizedInputPlace)) &&
    existing.d1_data?.Ascendant?.sign &&
    existing.d9_data?.Ascendant?.sign &&
    Array.isArray(existing.dasha_data) && existing.dasha_data.length > 0
  ) {
    return { chart: existing, cached: true, persisted: true };
  }

  const location = await resolveLocation(birth_place, dob, birth_time);
  const calcResult = await calculateVedicChart(dob, birth_time, location);
  if (!isCompleteChart(calcResult)) {
    throw new Error('Kundli Engine returned incomplete D1, D9, or dasha data.');
  }

  const recordPayload = {
    user_token_hash: tokenHash,
    name: name.trim(),
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

  if (upsertErr || !savedRecord) {
    throw new Error(`Kundli was calculated but could not be saved in Supabase: ${upsertErr?.message || 'No saved record returned.'}`);
  }
  return { chart: savedRecord, cached: false, persisted: true };
}

export function formatChartForGrok(chartRecord) {
  if (!chartRecord?.d1_data?.Ascendant || !chartRecord?.d9_data?.Ascendant) return '';
  const d1 = chartRecord.d1_data;
  const d9 = chartRecord.d9_data;
  const cur = chartRecord.current_dasha || {};
  const ascIdx = Number(d1.Ascendant.signIndex) - 1;
  const ascHindi = RASHIS_HI[ascIdx] || '';

  let out = '\n\n=== SAVED KUNDLI DATA (LAHIRI AYANAMSHA) ===\n';
  out += `Jatak: ${chartRecord.name} | DOB: ${chartRecord.dob} ${chartRecord.birth_time} | Place: ${chartRecord.birth_place}\n`;
  out += `Lagna (D1): ${d1.Ascendant.sign} (${ascHindi}) ${d1.Ascendant.degree}°, Nakshatra: ${d1.Ascendant.nakshatra} (Pada ${d1.Ascendant.pada})\n\n`;

  out += '--- D1 (RASHI) PLACEMENTS ---\n';
  const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  for (const planet of planets) {
    const placement = d1[planet];
    if (!placement) continue;
    const signIndex = Number(placement.signIndex) - 1;
    const house = ((signIndex - ascIdx + 12) % 12) + 1;
    out += `• ${planet}: ${placement.sign} (${RASHIS_HI[signIndex] || ''}) ${placement.degree}° in House ${house} | ${placement.nakshatra} (Pada ${placement.pada})\n`;
  }

  out += '\n--- D9 (NAVAMSHA) PLACEMENTS ---\n';
  out += `• Lagna (D9): ${d9.Ascendant?.sign || 'Unavailable'}\n`;
  for (const planet of planets) if (d9[planet]) out += `• ${planet} (D9): ${d9[planet].sign}\n`;

  if (cur.mahadasha) {
    out += '\n--- ACTIVE VIMSHOTTARI DASHA (LEVELS 1-3) ---\n';
    out += `• Mahadasha: ${cur.mahadasha} (Ends: ${cur.mahadashaEndDate || cur.endDate || 'Unavailable'})\n`;
    out += `• Antardasha: ${cur.antardasha || 'Unavailable'} (Ends: ${cur.antardashaEndDate || cur.endDate || 'Unavailable'})\n`;
    out += `• Pratyantardasha: ${cur.pratyantardasha || 'Unavailable'} (Window: ${cur.startDate || 'Unavailable'} to ${cur.endDate || 'Unavailable'})\n`;
  } else {
    out += '\nActive dasha data is unavailable in the saved record; do not invent it.\n';
  }

  out += '\nINSTRUCTION: Use the saved chart values as the chart source. Do not invent planetary degrees, nakshatras, or dasha periods. Clearly distinguish interpretation from calculated chart data.\n=== END SAVED KUNDLI ===\n\n';
  return out;
}

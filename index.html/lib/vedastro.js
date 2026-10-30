/**
 * lib/vedastro.js - VedAstro Calculation Client (Lahiri Ayanamsha)
 */
const VEDASTRO_BASE = 'https://api.vedastro.org/api';
const TIMEOUT_MS = 14000;

export const RASHIS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const RASHIS_HI = ['मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुंभ', 'मीन'];

export const NAKSHATRAS = [
  { name: 'Ashwini', lord: 'Ketu' }, { name: 'Bharani', lord: 'Venus' }, { name: 'Krittika', lord: 'Sun' },
  { name: 'Rohini', lord: 'Moon' }, { name: 'Mrigashira', lord: 'Mars' }, { name: 'Ardra', lord: 'Rahu' },
  { name: 'Punarvasu', lord: 'Jupiter' }, { name: 'Pushya', lord: 'Saturn' }, { name: 'Ashlesha', lord: 'Mercury' },
  { name: 'Magha', lord: 'Ketu' }, { name: 'Purva Phalguni', lord: 'Venus' }, { name: 'Uttara Phalguni', lord: 'Sun' },
  { name: 'Hasta', lord: 'Moon' }, { name: 'Chitra', lord: 'Mars' }, { name: 'Swati', lord: 'Rahu' },
  { name: 'Vishakha', lord: 'Jupiter' }, { name: 'Anuradha', lord: 'Saturn' }, { name: 'Jyeshtha', lord: 'Mercury' },
  { name: 'Mula', lord: 'Ketu' }, { name: 'Purva Ashadha', lord: 'Venus' }, { name: 'Uttara Ashadha', lord: 'Sun' },
  { name: 'Shravana', lord: 'Moon' }, { name: 'Dhanishta', lord: 'Mars' }, { name: 'Shatabhisha', lord: 'Rahu' },
  { name: 'Purva Bhadrapada', lord: 'Jupiter' }, { name: 'Uttara Bhadrapada', lord: 'Saturn' }, { name: 'Revati', lord: 'Mercury' }
];

export const DASA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
export const DASA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export function formatStdTime(dob, birthTime, tzOffset = '+05:30') {
  const cleanTime = (birthTime || '12:00').trim().slice(0, 5);
  const [year, month, day] = dob.split('-');
  const [hh, mm] = cleanTime.split(':');
  let formattedOffset = tzOffset;
  const match = tzOffset.match(/^([+-])(\d{1,2}):?(\d{2})?$/);
  if (match) {
    formattedOffset = `${match[1]}${match[2].padStart(2, '0')}:${match[3] || '00'}`;
  }
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')} ${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year} ${formattedOffset}`;
}

export function parseBirthTimestamp(dob, birthTime, tzOffset = '+05:30') {
  const [year, month, day] = dob.split('-').map(Number);
  const [hh, mm] = (birthTime || '12:00').slice(0, 5).split(':').map(Number);
  let offsetMinutes = 330;
  const match = tzOffset.match(/^([+-])(\d{1,2}):?(\d{2})?$/);
  if (match) {
    const sign = match[1] === '-' ? -1 : 1;
    offsetMinutes = sign * (parseInt(match[2], 10) * 60 + (match[3] ? parseInt(match[3], 10) : 0));
  }
  return Date.UTC(year, month - 1, day, hh, mm, 0, 0) - (offsetMinutes * 60 * 1000);
}

function timezoneOffsetAtLocalBirth(timeZone, dob, birthTime) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) throw new Error('Birthplace timezone could not be determined.');
  const [year, month, day] = dob.split('-').map(Number);
  const [hour, minute] = birthTime.slice(0, 5).split(':').map(Number);
  const targetLocalAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let utcGuess = targetLocalAsUtc;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  let offsetMinutes = null;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(utcGuess)).map(part => [part.type, part.value]));
    const formattedLocalAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    offsetMinutes = Math.round((formattedLocalAsUtc - utcGuess) / 60000);
    utcGuess = targetLocalAsUtc - offsetMinutes * 60000;
  }
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export async function resolveLocation(placeName, dob, birthTime) {
  if (!placeName || placeName.trim().length < 2) {
    throw new Error('Kripya apna janm sthan spasht likhein.');
  }

  const cleanPlace = placeName.trim();
  const normalizeLocationPart = value => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\\s+/g, ' ');
  const indianStatesAndTerritories = [
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Jammu and Kashmir', 'Madhya Pradesh', 'Himachal Pradesh', 'Uttar Pradesh', 'West Bengal',
    'Chandigarh', 'Chhattisgarh', 'Puducherry', 'Lakshadweep', 'Delhi', 'Ladakh',
    'Assam', 'Bihar', 'Goa', 'Gujarat', 'Haryana', 'Jharkhand', 'Karnataka', 'Kerala',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
    'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttarakhand', 'Maharashtra'
  ];

  let requestedCity = '';
  let requestedState = '';
  const commaParts = cleanPlace.split(',').map(part => part.trim()).filter(Boolean);

  if (commaParts.length >= 2) {
    requestedCity = commaParts[0];
    requestedState = commaParts.slice(1).join(', ');
  } else {
    const normalizedInput = normalizeLocationPart(cleanPlace);
    const matchingState = indianStatesAndTerritories
      .slice()
      .sort((a, b) => b.length - a.length)
      .find(state => normalizedInput.endsWith(normalizeLocationPart(state)));

    if (matchingState) {
      const stateSuffix = normalizeLocationPart(matchingState);
      const normalizedCity = normalizedInput.slice(0, -stateSuffix.length).trim();
      if (normalizedCity) {
        requestedCity = cleanPlace.slice(0, cleanPlace.toLowerCase().lastIndexOf(matchingState.toLowerCase())).trim();
        requestedState = matchingState;
      }
    }
  }

  let url;
  if (requestedCity && requestedState) {
    url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(requestedCity)}&count=10&language=en&format=json`;
  } else {
    url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanPlace)}&count=10&language=en&format=json`;
  }

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error('Birthplace geocoding service is unavailable.');
  const json = await res.json();
  if (!json.results || json.results.length === 0) {
    throw new Error(`Janm sthan '${cleanPlace}' ko map par khoja nahi ja saka.`);
  }

  const candidates = json.results;
  let result;

  if (requestedCity && requestedState) {
    const cityKey = normalizeLocationPart(requestedCity);
    const stateKey = normalizeLocationPart(requestedState);
    const matched = candidates.filter(candidate =>
      normalizeLocationPart(String(candidate.name || '')) === cityKey &&
      normalizeLocationPart(String(candidate.admin1 || '')) === stateKey &&
      normalizeLocationPart(String(candidate.country || '')) === 'india'
    );

    if (matched.length === 0) {
      throw new Error(`'${cleanPlace}' ke liye city aur state ka exact match verify nahi ho saka. Kripya City, State/Region dobara check karein.`);
    }
    if (matched.length > 1) {
      throw new Error(`'${cleanPlace}' naam ke kai matching sthan mile. Kripya aur spasht birthplace likhein.`);
    }
    result = matched[0];
  } else {
    const queryKey = normalizeLocationPart(cleanPlace);
    const exact = candidates.filter(candidate => normalizeLocationPart(String(candidate.name || '')) === queryKey);
    if (exact.length === 1) result = exact[0];
    else if (exact.length > 1) throw new Error(`'${cleanPlace}' naam ke kai sthan mile. Kripya City, State/Region likhein.`);
    else if (candidates.length === 1) result = candidates[0];
    else throw new Error(`'${cleanPlace}' naam ke kai sambhavit sthan mile. Kripya City, State/Region likhein.`);
  }

  if (!result.timezone) throw new Error('Is janm sthan ka timezone verify nahi ho saka. Kripya sthan ko State/Region ke saath dobara likhein.');
  return {
    name: [result.name, result.admin1, result.country].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index).join(', '),
    latitude: Number(Number(result.latitude).toFixed(4)),
    longitude: Number(Number(result.longitude).toFixed(4)),
    timezoneOffset: timezoneOffsetAtLocalBirth(result.timezone, dob, birthTime),
    timezone: result.timezone
  };
}

export function parseDegreeString(inputStr) {
  if (typeof inputStr === 'number') {
    const norm = (inputStr % 360 + 360) % 360;
    const idx = Math.floor(norm / 30);
    return { signName: RASHIS[idx], signIndex: idx + 1, degreeInSign: parseFloat((norm % 30).toFixed(2)), totalLongitude: parseFloat(norm.toFixed(4)) };
  }
  const str = String(inputStr).trim();
  const dmsMatch = str.match(/^([A-Za-z]+)\s*:\s*(\d+)°\s*(?:(\d+)')?\s*(?:([\d.]+)"?)?/);
  if (dmsMatch) {
    const signIdx = RASHIS.findIndex(s => s.toLowerCase() === dmsMatch[1].toLowerCase());
    if (signIdx === -1) throw new Error(`Unrecognized sign: ${dmsMatch[1]}`);
    const deg = parseInt(dmsMatch[2], 10) + (parseInt(dmsMatch[3] || 0, 10) / 60) + (parseFloat(dmsMatch[4] || 0) / 3600);
    return { signName: RASHIS[signIdx], signIndex: signIdx + 1, degreeInSign: parseFloat(deg.toFixed(2)), totalLongitude: parseFloat((signIdx * 30 + deg).toFixed(4)) };
  }
  throw new Error(`Unable to parse celestial coordinate: "${str}"`);
}

export function calculateNavamsha(longitude) {
  const norm = (longitude % 360 + 360) % 360;
  const rasiIdx = Math.floor(norm / 30);
  const pada = Math.floor((norm % 30) / (30 / 9));
  let start = 0;
  if ([0, 4, 8].includes(rasiIdx)) start = 0;
  else if ([1, 5, 9].includes(rasiIdx)) start = 9;
  else if ([2, 6, 10].includes(rasiIdx)) start = 6;
  else if ([3, 7, 11].includes(rasiIdx)) start = 3;
  const d9Idx = (start + pada) % 12;
  return { sign: RASHIS[d9Idx], signIndex: d9Idx + 1, signHi: RASHIS_HI[d9Idx] };
}

export function calculateNakshatra(longitude) {
  const norm = (longitude % 360 + 360) % 360;
  const totalMin = norm * 60;
  const nakIdx = Math.floor(totalMin / 800);
  const pada = Math.min(4, Math.floor((totalMin % 800) / 200) + 1);
  return { name: NAKSHATRAS[nakIdx % 27].name, lord: NAKSHATRAS[nakIdx % 27].lord, pada, nakshatraIndex: (nakIdx % 27) + 1 };
}

export async function calculateVedicChart(dob, birthTime, location) {
  const stdTime = formatStdTime(dob, birthTime, location.timezoneOffset);
  const body = JSON.stringify({
    Ayanamsa: 'LAHIRI',
    Time: { StdTime: stdTime, Location: { Name: location.name, Latitude: location.latitude, Longitude: location.longitude } }
  });

  const [pRes, hRes] = await Promise.all([
    fetchWithTimeout(`${VEDASTRO_BASE}/Calculate/AllPlanetRasiSigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }),
    fetchWithTimeout(`${VEDASTRO_BASE}/Calculate/AllHouseRasiSigns`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
  ]);

  const pJson = await pRes.json();
  const hJson = await hRes.json();

  if (pJson.Status !== 'Pass' || hJson.Status !== 'Pass') {
    throw new Error('Astronomical calculation failed on remote engine.');
  }

  const rawPlanets = pJson.Payload.AllPlanetRasiSigns || pJson.Payload;
  const rawHouses = hJson.Payload.AllHouseRasiSigns || hJson.Payload;

  const rawAsc = rawHouses.House1 || rawHouses.House_1 || rawHouses.Ascendant;
  if (!rawAsc) throw new Error('Ascendant coordinates missing.');

  const ascParsed = parseDegreeString(rawAsc);
  const ascD9 = calculateNavamsha(ascParsed.totalLongitude);
  const ascNak = calculateNakshatra(ascParsed.totalLongitude);

  const d1 = { Ascendant: { sign: ascParsed.signName, signIndex: ascParsed.signIndex, degree: ascParsed.degreeInSign, totalLongitude: ascParsed.totalLongitude, nakshatra: ascNak.name, pada: ascNak.pada } };
  const d9 = { Ascendant: { sign: ascD9.sign, signIndex: ascD9.signIndex, signHi: ascD9.signHi } };

  const planets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  for (const p of planets) {
    const raw = rawPlanets[p] || rawPlanets[p.toLowerCase()] || (p === 'Rahu' ? rawPlanets['Rāhu'] : null);
    if (!raw) throw new Error(`Missing coordinates for planet ${p}`);
    const parsed = parseDegreeString(raw);
    const d9p = calculateNavamsha(parsed.totalLongitude);
    const nakp = calculateNakshatra(parsed.totalLongitude);
    d1[p] = { sign: parsed.signName, signIndex: parsed.signIndex, degree: parsed.degreeInSign, totalLongitude: parsed.totalLongitude, nakshatra: nakp.name, pada: nakp.pada };
    d9[p] = { sign: d9p.sign, signIndex: d9p.signIndex, signHi: d9p.signHi };
  }

  const birthEpoch = parseBirthTimestamp(dob, birthTime, location.timezoneOffset);
  const dashaData = calculateVimshottariLevels(d1.Moon.totalLongitude, birthEpoch, Date.now());

  return { d1, d9, dasha: dashaData.all, currentDasha: dashaData.current };
}

export function calculateVimshottariLevels(moonLong, birthEpochMillis, targetEpochMillis = Date.now()) {
  const norm = (moonLong % 360 + 360) % 360;
  const totalMin = norm * 60;
  const nakIdx = Math.floor(totalMin / 800);
  const balanceRatio = (800 - (totalMin % 800)) / 800;
  const startLord = NAKSHATRAS[nakIdx % 27].lord;
  const startIdx = DASA_ORDER.indexOf(startLord);

  let curMillis = birthEpochMillis;
  const all = [];
  let active = null;

  for (let i = 0; i < 9; i++) {
    const mLord = DASA_ORDER[(startIdx + i) % 9];
    const mDurationMs = ((i === 0 ? DASA_YEARS[mLord] * balanceRatio : DASA_YEARS[mLord])) * 365.2425 * 86400000;
    const mStart = new Date(curMillis);
    const mEnd = new Date(curMillis + mDurationMs);
    curMillis = mEnd.getTime();

    const mEntry = { lord: mLord, level: 1, type: 'Mahadasha', startDate: mStart.toISOString().split('T')[0], endDate: mEnd.toISOString().split('T')[0], antardashas: [] };
    let aMillis = mStart.getTime();
    const aStartIdx = DASA_ORDER.indexOf(mLord);

    for (let j = 0; j < 9; j++) {
      const aLord = DASA_ORDER[(aStartIdx + j) % 9];
      const aDurationMs = (mEnd.getTime() - mStart.getTime()) * (DASA_YEARS[aLord] / 120.0);
      const aStart = new Date(aMillis);
      const aEnd = new Date(aMillis + aDurationMs);
      aMillis = aEnd.getTime();

      const aEntry = { lord: aLord, level: 2, type: 'Antardasha', startDate: aStart.toISOString().split('T')[0], endDate: aEnd.toISOString().split('T')[0], pratyantardashas: [] };
      let pMillis = aStart.getTime();
      const pStartIdx = DASA_ORDER.indexOf(aLord);

      for (let k = 0; k < 9; k++) {
        const pLord = DASA_ORDER[(pStartIdx + k) % 9];
        const pDurationMs = aDurationMs * (DASA_YEARS[pLord] / 120.0);
        const pStart = new Date(pMillis);
        const pEnd = new Date(pMillis + pDurationMs);
        pMillis = pEnd.getTime();

        const pEntry = { lord: pLord, level: 3, type: 'Pratyantardasha', startDate: pStart.toISOString().split('T')[0], endDate: pEnd.toISOString().split('T')[0] };
        aEntry.pratyantardashas.push(pEntry);

        if (targetEpochMillis >= pStart.getTime() && targetEpochMillis < pEnd.getTime()) {
          active = { mahadasha: mLord, antardasha: aLord, pratyantardasha: pLord, startDate: pEntry.startDate, endDate: pEntry.endDate, antardashaEndDate: aEntry.endDate, mahadashaEndDate: mEntry.endDate };
        }
      }
      mEntry.antardashas.push(aEntry);
    }
    all.push(mEntry);
  }
  return { all, current: active };
}

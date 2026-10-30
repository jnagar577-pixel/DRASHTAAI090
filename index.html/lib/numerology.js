/**
 * lib/numerology.js - Mulank and Bhagyank calculator
 */
const PLANETS = {
  1: { planet: 'Surya (Sun)', hi: 'सूर्य', traits: 'Netritva, aatmavishwas, spashtata', lucky_day: 'Ravivar', color: 'Kesar / Peela' },
  2: { planet: 'Chandra (Moon)', hi: 'चंद्र', traits: 'Bhavukta, shanti, kalpanasheel', lucky_day: 'Somvar', color: 'Safed' },
  3: { planet: 'Brihaspati (Jupiter)', hi: 'बृहस्पति', traits: 'Gyan, vistar, dharmikta', lucky_day: 'Guruvar', color: 'Peela' },
  4: { planet: 'Rahu', hi: 'राहु', traits: 'Naye vichar, parivartan, mehnat', lucky_day: 'Ravivar / Shanivar', color: 'Neela' },
  5: { planet: 'Budh (Mercury)', hi: 'बुध', traits: 'Buddhi, baat-cheet, vyapar', lucky_day: 'Budhvar', color: 'Hara' },
  6: { planet: 'Shukra (Venus)', hi: 'शुक्र', traits: 'Saundarya, prem, aakarshan', lucky_day: 'Shukravar', color: 'Safed / Chamkila' },
  7: { planet: 'Ketu', hi: 'केतु', traits: 'Aadhyatmikta, shodh, antargyan', lucky_day: 'Somvar / Guruvar', color: 'Dhusar' },
  8: { planet: 'Shani (Saturn)', hi: 'शनि', traits: 'Dhairya, anushasan, nyay', lucky_day: 'Shanivar', color: 'Kala / Gehra Neela' },
  9: { planet: 'Mangal (Mars)', hi: 'मंगल', traits: 'Urja, sahas, dridhata', lucky_day: 'Mangalvar', color: 'Laal' }
};

function sumDigits(n) {
  let s = String(n).replace(/\D/g, '');
  while (s.length > 1) {
    s = String(s.split('').reduce((a, b) => a + Number(b), 0));
  }
  return Number(s);
}

export function computeNumerology(dobStr) {
  if (typeof dobStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return null;
  const [year, month, day] = dobStr.split('-').map(Number);
  const date = new Date(`${dobStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dobStr) return null;

  const mulank = sumDigits(day);
  const bhagyank = sumDigits(day + month + year);

  return {
    mulank: { number: mulank, ...PLANETS[mulank] },
    bhagyank: { number: bhagyank, ...PLANETS[bhagyank] }
  };
}

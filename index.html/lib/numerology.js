// lib/numerology.js — Ank jyotish (Mulank, Bhagyank). Data aapki di hui table se hai.
// Gemstone (ratna) jaan-bujh kar nahi diya gaya, taaki ratna bechne jaisa prabhav na bane.

const TABLE = {
  1: { hi: 'Surya', planet: 'Sun (Surya)', traits: 'Leadership, Independence, Ambition', lucky_day: 'Sunday', color: 'Gold/Yellow' },
  2: { hi: 'Chandra', planet: 'Moon (Chandra)', traits: 'Sensitivity, Intuition, Diplomacy', lucky_day: 'Monday', color: 'White/Silver' },
  3: { hi: 'Guru', planet: 'Jupiter (Guru)', traits: 'Wisdom, Optimism, Creativity', lucky_day: 'Thursday', color: 'Yellow' },
  4: { hi: 'Rahu', planet: 'Rahu', traits: 'Unconventional, Worldly, Ambitious', lucky_day: 'Saturday', color: 'Smoke/Gray' },
  5: { hi: 'Budh', planet: 'Mercury (Budh)', traits: 'Intelligence, Versatility, Communication', lucky_day: 'Wednesday', color: 'Green' },
  6: { hi: 'Shukra', planet: 'Venus (Shukra)', traits: 'Love, Harmony, Beauty', lucky_day: 'Friday', color: 'White/Pink' },
  7: { hi: 'Ketu', planet: 'Ketu', traits: 'Spiritual, Intuitive, Analytical', lucky_day: 'Tuesday', color: 'Smoke/Gray' },
  8: { hi: 'Shani', planet: 'Saturn (Shani)', traits: 'Discipline, Authority, Karma', lucky_day: 'Saturday', color: 'Black/Blue' },
  9: { hi: 'Mangal', planet: 'Mars (Mangal)', traits: 'Courage, Energy, Passion', lucky_day: 'Tuesday', color: 'Red' },
};

export function digitSum(str) {
  return String(str).split('').reduce((a, d) => a + Number(d), 0);
}

export function reduceToSingle(n) {
  let x = n;
  while (x > 9) x = digitSum(x);
  return x;
}

function entry(number) {
  return { number, ...TABLE[number] };
}

// dob format: YYYY-MM-DD
export function numerology(dob) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || ''));
  if (!m) return null;
  const day = Number(m[3]);
  if (day < 1 || day > 31) return null;
  const mulank = reduceToSingle(day);
  const bhagyank = reduceToSingle(digitSum(m[1] + m[2] + m[3]));
  return { mulank: entry(mulank), bhagyank: entry(bhagyank) };
}

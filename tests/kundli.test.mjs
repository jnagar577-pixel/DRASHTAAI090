import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStdTime, parseBirthTimestamp, parseDegreeString, calculateNavamsha, calculateNakshatra, calculateVimshottariLevels } from '../lib/vedastro.js';
import { formatChartForGrok } from '../lib/kundli-service.js';

test('formatStdTime produces standard VedAstro string', () => {
  assert.equal(formatStdTime('1947-08-15', '00:00', '+05:30'), '00:00 15/08/1947 +05:30');
});

test('parseBirthTimestamp preserves local date and offset', () => {
  const millis = parseBirthTimestamp('1947-08-15', '00:00', '+05:30');
  const d = new Date(millis);
  assert.equal(d.getUTCFullYear(), 1947);
  assert.equal(d.getUTCMonth(), 7);
  assert.equal(d.getUTCDate(), 14);
  assert.equal(d.getUTCHours(), 18);
  assert.equal(d.getUTCMinutes(), 30);
});

test('parseDegreeString handles DMS coordinates', () => {
  const parsed = parseDegreeString("Cancer : 03° 59' 00\"");
  assert.equal(parsed.signName, 'Cancer');
  assert.equal(parsed.signIndex, 4);
  assert.equal(Math.round(parsed.degreeInSign), 4);
});

test('calculateNavamsha follows Parashara triplicities', () => {
  assert.equal(calculateNavamsha(93.98).sign, 'Leo');
  assert.equal(calculateNavamsha(118.0).sign, 'Pisces');
});

test('Vimshottari calculation produces Level 1-3 hierarchy', () => {
  const birthEpoch = parseBirthTimestamp('1947-08-15', '00:00', '+05:30');
  const res = calculateVimshottariLevels(93.98, birthEpoch, new Date('2026-10-15T00:00:00Z').getTime());
  assert.equal(res.all.length, 9);
  assert.equal(res.all[0].lord, 'Saturn');
  assert.equal(res.current.mahadasha, 'Mars');
});

test('formatStdTime normalizes non-Indian timezone offsets', () => {
  assert.equal(formatStdTime('2000-01-02', '09:05', '-4:00'), '09:05 02/01/2000 -04:00');
});

test('kundli service stops when saved chart lookup fails', async () => {
  const { getOrComputeChart } = await import('../lib/kundli-service.js');
  const supabase = {
    from() {
      const query = {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: null, error: { message: 'permission denied' } }; }
      };
      return query;
    }
  };
  await assert.rejects(
    getOrComputeChart(supabase, 'token-hash', { name: 'Test', dob: '2000-01-02', birth_time: '09:05', birth_place: 'Test City' }),
    /Saved kundli could not be checked: permission denied/
  );
});

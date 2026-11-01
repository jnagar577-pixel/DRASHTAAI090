import test from 'node:test';
import assert from 'node:assert/strict';
import { detectTopics, getAstrologyKnowledge, TOPICS, CORE_FRAMEWORK } from '../lib/astrology-knowledge.js';

test('detectTopics identifies CAREER keywords', () => {
  const topics = detectTopics('Mera career kaisa rahega? Job karun ya business?');
  assert.ok(topics.includes('CAREER'));
});

test('detectTopics identifies MARRIAGE keywords', () => {
  const topics = detectTopics('Meri shaadi kab hogi? Life partner kaisa hoga?');
  assert.ok(topics.includes('MARRIAGE'));
});

test('detectTopics identifies FINANCE keywords', () => {
  const topics = detectTopics('Mujhe dhan labh kab hoga? Karza kaise utrega?');
  assert.ok(topics.includes('FINANCE'));
});

test('detectTopics identifies PERSONALITY keywords', () => {
  const topics = detectTopics('Mera asli swabhav aur vyaktitva kaisa hai?');
  assert.ok(topics.includes('PERSONALITY'));
});

test('detectTopics identifies KARMA keywords', () => {
  const topics = detectTopics('Mere saath baar-baar aisi pareshani kyun aati hai? Kaal sarp dosh hai kya?');
  assert.ok(topics.includes('KARMA'));
});

test('detectTopics identifies SPIRITUALITY keywords', () => {
  const topics = detectTopics('Mera soul purpose kya hai? Moksha aur kundalini ke baare mein batayein');
  assert.ok(topics.includes('SPIRITUALITY'));
});

test('detectTopics handles multi-topic queries with max 2 topics', () => {
  const topics = detectTopics('Mera career aur shaadi dono ke baare mein batayein');
  assert.equal(topics.length, 2);
  assert.ok(topics.includes('CAREER'));
  assert.ok(topics.includes('MARRIAGE'));
});

test('detectTopics falls back to GENERAL for unspecific queries', () => {
  const topics = detectTopics('Namaste Swami ji, pranam');
  assert.deepEqual(topics, ['GENERAL']);
});

test('getAstrologyKnowledge generates prompt comfortably within token budget', () => {
  const queries = [
    'Job karun ya business?',
    'Meri shaadi kab hogi?',
    'Mere paise fas gaye hain, kab wapas aayenge?',
    'Mera career aur vivah dono kaise rahenge?',
    'Namaste ji'
  ];

  for (const q of queries) {
    const knowledge = getAstrologyKnowledge(q);
    // 1 token ~= 4 chars roughly
    const estimatedTokens = Math.ceil(knowledge.length / 3.8);
    // Must be well under 3,500 tokens (aimed ~1,500 - 2,600)
    assert.ok(estimatedTokens < 3500, `Query "${q}" exceeded token budget: ${estimatedTokens} tokens`);
    assert.ok(knowledge.includes('BHRI GU NANDI NADI') || knowledge.includes('Bhrigu Nandi Nadi') || knowledge.includes('BNN'));
    assert.ok(knowledge.includes('PARASHARI') || knowledge.includes('Parashari'));
  }
});


test('consultation framework explicitly limits interpretation to D1 and excludes timing methods', () => {
  assert.match(CORE_FRAMEWORK, /Interpret only supplied D1 natal data/i);
  assert.match(CORE_FRAMEWORK, /Do not calculate, interpret or predict from planetary periods or transits/i);
  assert.doesNotMatch(TOPICS.MARRIAGE, /Exact timing requires/i);
  assert.doesNotMatch(TOPICS.KARMA, /Sade Sati|Dhaiya/i);
});

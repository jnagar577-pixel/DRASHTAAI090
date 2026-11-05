import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const onboardingStart = html.indexOf('function isMissingChartPrompt(text){');
const onboardingEnd = html.indexOf('async function sendChat(query, display){', onboardingStart);
assert.ok(onboardingStart >= 0 && onboardingEnd > onboardingStart, 'onboarding helper functions must exist');
const onboardingContext = {};
runInNewContext(`${html.slice(onboardingStart, onboardingEnd)}; globalThis.isMissingChartPrompt = isMissingChartPrompt; globalThis.isPromptShareQuestion = isPromptShareQuestion;`, onboardingContext);

test('frontend has no kundli intake form or Lagna chart renderer', () => {
  assert.doesNotMatch(html, /function renderIntake|function submitIntake|function renderChartCard|function chartSVG/);
  assert.doesNotMatch(html, /id="f_name"|id="f_dob"|id="f_lagan"|ग्रह स्थिति जल्द जुड़ेगी/);
});

test('frontend starts by asking only for the customer name', () => {
  assert.match(html, /const GREETING = 'नमस्ते 🙏 मैं Turiya AI हूँ। आप अपनी बात सहजता से कहिए। मैं ध्यान से सुनकर सरल और शांत भाषा में आपका मार्गदर्शन करने का प्रयास करूँगा। कृपया अपना नाम बताइए।';/);
  assert.match(html, /api\(\{action:'profile', name\}\)/);
});

test('frontend asks for a Lagan Chart Prompt after name and saves it separately', () => {
  assert.match(html, /const CHART_PROMPT_MESSAGE = 'अब अपना Lagan Chart Prompt यहाँ share कीजिए।/);
  assert.match(html, /action:'save_chart_prompt', chartPrompt:prompt/);
  assert.match(html, /Mere paas Lagan Chart Prompt nahi hai/);
  assert.match(html, /function isMissingChartPrompt\(text\)/);
  assert.match(html, /function isPromptShareQuestion\(text\)/);
});

test('missing chart guidance links to the main Swami Atma Jagran website', () => {
  assert.match(html, /const WEBSITE_URL = 'https:\/\/swamiatmajagran\.in\/'/);
  assert.match(html, /Swarnima Janm Patrika विकल्प चुनें/);
  assert.match(html, /लगभग 1–3 दिन का समय लग सकता है/);
  assert.match(html, /अपना Lagan Chart Prompt बनवाएं/);
  assert.match(html, /ChatGPT, Gemini, Claude (?:aur|और) Grok/);
});

test('frontend shows the exact saved-kundli message after the status check', () => {
  assert.ok(html.includes("const SAVED_KUNDLI_MESSAGE = 'आपकी कुंडली हमारे पास सुरक्षित है। अब आप अपना सवाल पूछिए।';"));
  assert.match(html, /api\(\{action:'status'\}\)/);
});

test('consultation feature suggestions remain hidden until a chart is saved', () => {
  assert.match(html, /features\.hidden = !state\.hasKundli/);
  assert.match(html, /if\(!state\.hasKundli\) return/);
  assert.doesNotMatch(html, /if\(!state\.intakeDone\)/);
  assert.doesNotMatch(html, /Grahon ki chaal samjhi ja rahi hai|Aapki kundli ko dhyan se dekha ja raha hai/);
});

test('missing-prompt phrases are recognized without matching unrelated messages', () => {
  const missing = onboardingContext.isMissingChartPrompt;
  assert.equal(missing('mere pass prompt nahi hai'), true);
  assert.equal(missing('prompt to nahi hai'), true);
  assert.equal(missing('mere paas shayad lagan maya sutra nahi hai'), true);
  assert.equal(missing('nahi hai mere paas lagan chart prompt'), true);
  assert.equal(missing('mere paas ek sawal hai'), false);
  assert.equal(missing('mere paas Lagan Chart Prompt hai'), false);
});

test('prompt-sharing questions and confirmations ask the customer to paste the prompt', () => {
  const asks = onboardingContext.isPromptShareQuestion;
  assert.equal(asks('kya me lagan ka prompt yaha share karu'), true);
  assert.equal(asks('Mere paas Lagan Chart Prompt hai'), true);
  assert.equal(asks('haan mera prompt hai'), true);
  assert.equal(asks('Mera career kaisa rahega'), false);
});

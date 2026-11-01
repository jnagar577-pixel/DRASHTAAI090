import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('frontend has no kundli intake form or Lagna chart renderer', () => {
  assert.doesNotMatch(html, /function renderIntake|function submitIntake|function renderChartCard|function chartSVG/);
  assert.doesNotMatch(html, /id="f_name"|id="f_dob"|id="f_lagan"|ग्रह स्थिति जल्द जुड़ेगी/);
});

test('frontend starts by asking only for the customer name', () => {
  assert.match(html, /const GREETING = 'नमस्ते 🙏 मैं Turiya AI हूँ। सबसे पहले कृपया अपना नाम बताइए।';/);
  assert.match(html, /api\(\{action:'profile', name\}\)/);
});

test('frontend asks for a Lagan Chart Prompt after name and saves it separately', () => {
  assert.match(html, /const CHART_PROMPT_MESSAGE = 'अब कृपया अपना पूरा Lagan Chart Prompt यहाँ paste कर दीजिए।/);
  assert.match(html, /action:'save_chart_prompt', chartPrompt:prompt/);
  assert.match(html, /Mere paas Lagan Chart Prompt nahi hai/);
});

test('missing chart guidance links to the main Swami Atma Jagran website', () => {
  assert.match(html, /const WEBSITE_URL = 'https:\/\/swamiatmajagran\.in\/'/);
  assert.match(html, /100% Free Chart विकल्प/);
  assert.match(html, /WhatsApp पर भेज दिए जाएंगे/);
  assert.match(html, /Apna Lagan Chart Prompt banwayein/);
  assert.match(html, /ChatGPT, Gemini, Claude aur Grok/);
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

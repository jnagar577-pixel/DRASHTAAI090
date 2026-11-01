import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('frontend has no kundli intake form or Lagna chart renderer', () => {
  assert.doesNotMatch(html, /function renderIntake|function submitIntake|function renderChartCard|function chartSVG/);
  assert.doesNotMatch(html, /id="f_name"|id="f_dob"|id="f_lagan"|ग्रह स्थिति जल्द जुड़ेगी/);
});

test('frontend shows the exact saved-kundli message after the read-only status check', () => {
  assert.ok(html.includes("const SAVED_KUNDLI_MESSAGE = 'आपकी कुंडली हमारे पास सुरक्षित है। अब आप अपना सवाल पूछिए।';"));
  assert.match(html, /api\(\{action:'status'\}\)/);
});

test('feature suggestions are no longer gated on the removed intake flow', () => {
  assert.doesNotMatch(html, /if\(!state\.intakeDone\)/);
  assert.match(html, /features\.hidden = false;/);
  assert.doesNotMatch(html, /Grahon ki chaal samjhi ja rahi hai|Aapki kundli ko dhyan se dekha ja raha hai/);
});

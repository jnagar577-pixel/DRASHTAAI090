// Run: node --test tests/
// Supabase aur Groq dono ko mock kiya gaya hai, isliye ye bina internet ke chalta hai.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_test';
process.env.DRASHTA_API = 'gsk_test';
delete process.env.GROQ_MODEL;

const { default: handler } = await import('../api/ask.js');
const { numerology } = await import('../lib/numerology.js');

let db, groqCalls, groqRule, bumpOverride, lastSupaHeaders;

function reset() {
  db = { conversations: [], messages: [], feedback: [], usage: new Map(), nextId: 1, knowledge: [{ topic: 'test', content: 'SWAMI_TEST_FACT' }], knowledgeFail: false };
  groqCalls = [];
  groqRule = null;       // function(model) -> 'ok' | 'notfound'
  bumpOverride = null;
}
function reply(status, data) {
  return { ok: status >= 200 && status < 300, status, json: async () => data, text: async () => (data === null ? '' : JSON.stringify(data)) };
}

globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.hostname === 'api.groq.com') {
    if (u.pathname.endsWith('/models')) return reply(200, { data: [{ id: 'openai/gpt-oss-120b' }] });
    const body = JSON.parse(opts.body);
    groqCalls.push(body);
    if (groqRule && groqRule(body.model) === 'notfound') {
      return reply(404, { error: { message: 'The model does not exist' } });
    }
    return reply(200, { choices: [{ message: { content: `Mock jawab #${groqCalls.length}` } }] });
  }

  const path = u.pathname.replace('/rest/v1/', '');
  lastSupaHeaders = opts.headers;
  const method = opts.method || 'GET';
  const body = opts.body ? JSON.parse(opts.body) : null;
  const eq = k => { const v = u.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };

  if (path === 'knowledge_base') {
    if (db.knowledgeFail) return reply(500, { message: 'knowledge down' });
    return reply(200, db.knowledge);
  }
  if (path === 'messages' && method === 'DELETE') {
    const cid = eq('conversation_id');
    db.messages = db.messages.filter(m => m.conversation_id !== cid);
    return reply(204, null);
  }
  if (path === 'rpc/bump_usage') {
    const key = `${body.p_hash}|${body.p_day}`;
    const n = (db.usage.get(key) || 0) + 1;
    db.usage.set(key, n);
    return reply(200, bumpOverride ?? n);
  }

  if (path === 'conversations') {
    if (method === 'GET') {
      return reply(200, db.conversations.filter(c => c.token_hash === eq('token_hash')));
    }
    if (method === 'POST') {
      let row = db.conversations.find(c => c.token_hash === body.token_hash);
      if (!row) { row = { id: randomUUID(), ...body }; db.conversations.push(row); }
      return reply(201, [row]);
    }
    if (method === 'PATCH') {
      const row = db.conversations.find(c => c.id === eq('id'));
      if (!row) return reply(404, { message: 'not found' });
      Object.assign(row, body);
      return reply(204, null);
    }
    if (method === 'DELETE') {
      const ids = db.conversations.filter(c => c.token_hash === eq('token_hash')).map(c => c.id);
      db.conversations = db.conversations.filter(c => !ids.includes(c.id));
      db.messages = db.messages.filter(m => !ids.includes(m.conversation_id));
      return reply(204, null);
    }
  }

  if (path === 'messages') {
    if (method === 'GET') {
      const cid = eq('conversation_id'), id = eq('id'), role = eq('role');
      let rows = db.messages.filter(m =>
        (!cid || m.conversation_id === cid) && (!id || String(m.id) === id) && (!role || m.role === role));
      rows = rows.sort((a, b) => b.id - a.id);
      const lim = Number(u.searchParams.get('limit') || 1e9);
      return reply(200, rows.slice(0, lim));
    }
    if (method === 'POST') {
      const arr = (Array.isArray(body) ? body : [body]).map(r => ({ id: db.nextId++, ...r }));
      db.messages.push(...arr);
      return reply(201, arr);
    }
  }

  if (path === 'feedback' && method === 'POST') {
    const i = db.feedback.findIndex(f => f.message_id === body.message_id);
    if (i >= 0) db.feedback[i] = body; else db.feedback.push(body);
    return reply(201, null);
  }

  return reply(404, { message: `mock: unhandled ${method} ${path}` });
};

const TOKEN_A = 'a'.repeat(40);
const TOKEN_B = 'b'.repeat(40);

function mockRes() {
  const r = { code: 200, body: null, headers: {} };
  r.setHeader = (k, v) => (r.headers[k] = v);
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => r;
  return r;
}
async function call(payload) {
  const res = mockRes();
  await handler({ method: 'POST', headers: {}, body: payload }, res);
  return res;
}
const intake = (token, extra = {}) => call({
  token, action: 'intake', consent: true, name: 'Jatin Nagar', dob: '2005-07-22',
  birth_time: '06:30', birth_place: 'Bhopal', lagan: 'तुला', moon_rashi: 'मकर', notes: '', ...extra,
});

beforeEach(reset);

test('invalid token is rejected', async () => {
  const r = await call({ token: 'short', action: 'chat', query: 'hi' });
  assert.equal(r.code, 400);
});

test('intake without consent is rejected', async () => {
  const r = await intake(TOKEN_A, { consent: false });
  assert.equal(r.code, 400);
  assert.match(r.body.error, /sahmati/);
});

test('intake with invalid lagan rashi is rejected', async () => {
  const r = await intake(TOKEN_A, { lagan: 'Atlantis' });
  assert.equal(r.code, 400);
});

test('intake stores data and returns deterministic summary', async () => {
  const r = await intake(TOKEN_A);
  assert.equal(r.code, 200);
  assert.match(r.body.summary, /Jatin Nagar/);
  assert.match(r.body.summary, /तुला/);
  assert.equal(db.conversations.length, 1);
  assert.ok(db.conversations[0].chart_summary.includes('Jatin Nagar'));
  assert.ok(db.conversations[0].consent_at);
});

test('chat sends chart data to model and saves both messages', async () => {
  await intake(TOKEN_A);
  const r = await call({ token: TOKEN_A, action: 'chat', query: 'Mera career kaisa hai?' });
  assert.equal(r.code, 200);
  assert.equal(r.body.text, 'Mock jawab #1');
  assert.ok(Number.isInteger(r.body.messageId));
  const sent = groqCalls[0].messages;
  assert.ok(sent.some(m => m.content.includes('KUNDLI DATA') && m.content.includes('Jatin Nagar')));
  assert.equal(db.messages.length, 2);
});

test('second chat includes memory of the first exchange', async () => {
  await intake(TOKEN_A);
  await call({ token: TOKEN_A, action: 'chat', query: 'Mera naam kya hai?' });
  await call({ token: TOKEN_A, action: 'chat', query: 'Aur kuch batao' });
  const sent = groqCalls[1].messages.map(m => m.content);
  assert.ok(sent.includes('Mera naam kya hai?'), 'pichla user message model ko gaya');
  assert.ok(sent.includes('Mock jawab #1'), 'pichla bot jawab model ko gaya');
});

test('memory is isolated per token', async () => {
  await intake(TOKEN_A);
  await call({ token: TOKEN_A, action: 'chat', query: 'Secret A' });
  await call({ token: TOKEN_B, action: 'chat', query: 'Hello B' });
  const sentB = groqCalls[1].messages.map(m => m.content);
  assert.ok(!sentB.includes('Secret A'), 'token B ko token A ki baat nahi dikhni chahiye');
});

test('model 404 falls back to the next model', async () => {
  groqRule = model => (model === 'openai/gpt-oss-120b' ? 'notfound' : 'ok');
  const r = await call({ token: TOKEN_A, action: 'chat', query: 'Test' });
  assert.equal(r.code, 200);
  assert.equal(groqCalls.at(-1).model, 'openai/gpt-oss-20b');
});

test('daily limit returns 429', async () => {
  bumpOverride = 101;
  const r = await call({ token: TOKEN_A, action: 'chat', query: 'Test' });
  assert.equal(r.code, 429);
  assert.equal(groqCalls.length, 0, 'limit ke baad model call nahi hona chahiye');
});

test('feedback works on own message and is blocked for another token', async () => {
  await intake(TOKEN_A);
  const chat = await call({ token: TOKEN_A, action: 'chat', query: 'Test' });
  const ok = await call({ token: TOKEN_A, action: 'feedback', messageId: chat.body.messageId, helpful: true });
  assert.equal(ok.code, 200);
  assert.equal(db.feedback.length, 1);

  await call({ token: TOKEN_B, action: 'chat', query: 'x' });
  const bad = await call({ token: TOKEN_B, action: 'feedback', messageId: chat.body.messageId, helpful: false });
  assert.equal(bad.code, 404);
});

test('delete removes conversation, messages and feedback for that token only', async () => {
  await intake(TOKEN_A);
  await call({ token: TOKEN_A, action: 'chat', query: 'Test' });
  await intake(TOKEN_B, { name: 'Other' });
  await call({ token: TOKEN_B, action: 'chat', query: 'Other test' });

  const r = await call({ token: TOKEN_A, action: 'delete' });
  assert.equal(r.code, 200);
  assert.equal(db.conversations.length, 1);
  assert.equal(db.conversations[0].name, 'Other');
  assert.ok(db.messages.every(m => m.conversation_id === db.conversations[0].id));
});

test('missing Supabase config returns 500 without leaking details', async () => {
  const saved = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  const r = await call({ token: TOKEN_A, action: 'chat', query: 'Test' });
  process.env.SUPABASE_URL = saved;
  assert.equal(r.code, 500);
  assert.ok(!JSON.stringify(r.body).includes('SUPABASE'));
});

test('upstream failure gives friendly message, not raw error', async () => {
  groqRule = () => 'notfound';
  const r = await call({ token: TOKEN_A, action: 'chat', query: 'Test' });
  assert.equal(r.code, 502);
  assert.ok(!/Groq|Supabase/.test(r.body.error));
});

test('new sb_secret key is sent only as apikey, not as Bearer', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_value';
  await intake(TOKEN_A);
  assert.equal(lastSupaHeaders.apikey, 'sb_secret_test_value');
  assert.equal(lastSupaHeaders.Authorization, undefined);
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_test';
});

test('legacy eyJ service key is sent as apikey and Bearer', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJlegacy';
  await intake(TOKEN_A);
  assert.equal(lastSupaHeaders.Authorization, 'Bearer eyJlegacy');
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc_test';
});

test('health check reports env presence without leaking values', async () => {
  const res = mockRes();
  await handler({ method: 'GET', headers: {}, body: null }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.env, { SUPABASE_URL: true, SUPABASE_SERVICE_ROLE_KEY: true, DRASHTA_API: true });
  assert.equal(res.body.database, 'ok');
  assert.equal(res.body.groq, 'ok');
  assert.equal(res.body.rpc, 'ok');
  assert.equal(res.body.ok, true);
  const dump = JSON.stringify(res.body);
  assert.ok(!dump.includes('gsk_test') && !dump.includes('svc_test') && !dump.includes('supa.test'));
});

test('health check flags missing Supabase env', async () => {
  const saved = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  const res = mockRes();
  await handler({ method: 'GET', headers: {}, body: null }, res);
  process.env.SUPABASE_URL = saved;
  assert.equal(res.body.env.SUPABASE_URL, false);
  assert.equal(res.body.ok, false);
});

test('brand knowledge from database is sent to the model in its own block', async () => {
  await intake(TOKEN_A);
  await call({ token: TOKEN_A, action: 'chat', query: 'Swami ji kaun hain?' });
  const sys = groqCalls.at(-1).messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  assert.ok(sys.includes('BRAND KNOWLEDGE'));
  assert.ok(sys.includes('SWAMI_TEST_FACT'));
});

test('chat still works when knowledge_base fails', async () => {
  db.knowledgeFail = true;
  const r = await call({ token: TOKEN_A, action: 'chat', query: 'Hello' });
  assert.equal(r.code, 200);
  assert.equal(r.body.text, 'Mock jawab #1');
});

test('summary contains deterministic house table from lagan', async () => {
  const r = await intake(TOKEN_A, { lagan: 'धनु', moon_rashi: 'धनु' });
  assert.equal(r.code, 200);
  assert.match(r.body.summary, /भाव 2: मकर \(स्वामी शनि\)/);
  assert.match(r.body.summary, /भाव 3: कुंभ \(स्वामी शनि\)/);
  assert.match(r.body.summary, /भाव 10: कन्या \(स्वामी बुध\)/);
});

test('new person (different name) clears old conversation messages', async () => {
  await intake(TOKEN_A);
  await call({ token: TOKEN_A, action: 'chat', query: 'Jatin ka sawal' });
  assert.equal(db.messages.length, 2);
  await intake(TOKEN_A, { name: 'DHRUV NAGAR', dob: '2008-07-23', lagan: 'धनु' });
  assert.equal(db.messages.length, 0, 'purani baatcheet hat deni chahiye');
});

test('same person re-submitting intake keeps messages', async () => {
  await intake(TOKEN_A);
  await call({ token: TOKEN_A, action: 'chat', query: 'Pehla sawal' });
  await intake(TOKEN_A, { lagan: 'मकर' });
  assert.equal(db.messages.length, 2, 'wahi insaan ho to baatcheet rehni chahiye');
});

test('numerology: Jatin 2005-07-22 -> Mulank 4, Bhagyank 9', () => {
  const n = numerology('2005-07-22');
  assert.equal(n.mulank.number, 4);
  assert.equal(n.bhagyank.number, 9);
  assert.equal(n.mulank.hi, 'Rahu');
});
test('numerology: Dhruv 2008-07-23 -> Mulank 5, Bhagyank 4', () => {
  const n = numerology('2008-07-23');
  assert.equal(n.mulank.number, 5);
  assert.equal(n.bhagyank.number, 4);
});
test('numerology: invalid date returns null', () => {
  assert.equal(numerology('2005-7-22'), null);
  assert.equal(numerology('2005-07-32'), null);
});
test('intake response includes numerology and summary line', async () => {
  const r = await intake(TOKEN_A, { dob: '2005-07-22' });
  assert.equal(r.body.numerology.mulank.number, 4);
  assert.match(r.body.summary, /मूलांक 4/);
  assert.match(r.body.summary, /भाग्यांक 9/);
});

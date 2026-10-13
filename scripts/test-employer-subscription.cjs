/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
  return loaded.exports;
}
const helpers = load('utils/employerSubscription.ts');
const id = '11111111-1111-4111-8111-111111111111';
const basic = { subscription: { plan: 'basic', expires_at: null, test_mode: true, prices: { monthly: 14900, annually: 149000 } }, payment: null };
const pending = { ...basic, payment: { id, billing_cycle: 'monthly', amount: 14900, status: 'pending', checkout_url: 'https://checkout.paymongo.com/cs_Test' } };
const paid = { subscription: { ...basic.subscription, plan: 'premium', expires_at: '2026-11-13T10:00:00Z' }, payment: { ...pending.payment, status: 'paid', checkout_url: null } };
const copy = value => structuredClone(value);

test('only trusted hosted checkout URLs and valid server responses can enter the payment flow', () => {
  assert.equal(helpers.isPayMongoCheckoutUrl(pending.payment.checkout_url), true);
  for (const url of ['http://checkout.paymongo.com/pay', 'https://checkout.paymongo.com.evil.example/pay', 'https://user@checkout.paymongo.com/pay', 'javascript:alert(1)', 'https://checkout.paymongo.com:8000/pay']) assert.equal(helpers.isPayMongoCheckoutUrl(url), false);
  assert.deepEqual(helpers.readEmployerSubscription(basic), basic);
  for (const mutate of [v => { v.subscription.test_mode = false; }, v => { v.subscription.prices.monthly = -1; }, v => { v.subscription.expires_at = 'invalid'; }, v => { v.payment.id = '../../payment'; }, v => { v.payment.status = 'success'; }, v => { v.payment.checkout_url = 'https://evil.example'; }]) {
    const value = copy(pending); mutate(value); assert.throws(() => helpers.readEmployerSubscription(value));
  }
});

function harness() {
  const slots = []; let cursor = 0; let token = 'session-1'; let serial = 0;
  const posts = []; const browsers = [];
  const api = { get: async () => ({ data: basic }), post: async () => ({ data: pending }) };
  const browser = { open: async () => ({ type: 'dismiss' }) };
  const react = {
    useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(value) { const i = cursor++; if (!(i in slots)) slots[i] = { current: value }; return slots[i]; },
    useEffect() {}, useCallback: callback => callback,
  };
  const hook = load('hooks/useEmployerSubscription.ts', {
    react, '@/utils/employerSubscription': helpers,
    '@/api/axios': { get: (...args) => api.get(...args), post: (...args) => { posts.push(args); return api.post(...args); } },
    '@react-native-async-storage/async-storage': { getItem: async () => token },
    '@react-navigation/native': { useFocusEffect() {} }, 'expo-crypto': { randomUUID: () => `request-${++serial}` },
    'expo-web-browser': { openBrowserAsync: (...args) => { browsers.push(args); return browser.open(...args); } },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
  });
  return { api, browser, posts, browsers, token: value => { token = value; }, render() { cursor = 0; return hook.useEmployerSubscription(); } };
}

test('closing checkout without confirmed payment preserves Basic and the pending checkout', async () => {
  const app = harness(); await app.render().refresh();
  await app.render().checkout('monthly');
  assert.equal(app.browsers.length, 1);
  assert.equal(app.render().data.subscription.plan, 'basic');
  assert.equal(app.render().data.payment.status, 'pending');
  assert.equal(app.render().notice, null);
  assert.equal(app.posts[1][0], `/employer/subscription/payments/${id}/verify`);
});

test('server-confirmed payment activates Premium after returning from the browser', async () => {
  const app = harness();
  app.api.post = async url => ({ data: url.endsWith('/verify') ? paid : pending });
  await app.render().checkout('monthly');
  assert.equal(app.render().data.subscription.plan, 'premium');
  assert.equal(app.render().notice.title, 'Payment confirmed');
});

test('rapid checkout taps share one operation and network retries preserve the request ID', async () => {
  const app = harness(); let finish;
  app.api.post = async () => { await new Promise(resolve => { finish = resolve; }); throw { response: { status: 503, data: { message: 'private-provider-payload' } } }; };
  const operation = app.render().checkout('monthly');
  await new Promise(resolve => setImmediate(resolve));
  await app.render().checkout('monthly');
  assert.equal(app.posts.length, 1); assert.equal(app.render().busy, true);
  finish(); await operation;
  assert.ok(!app.render().notice.message.includes('private-provider-payload'));
  const requestId = app.posts[0][1].request_id;
  app.api.post = async () => ({ data: pending });
  await app.render().checkout('monthly');
  assert.equal(app.posts[1][1].request_id, requestId);
});

test('session changes during checkout preparation never open a browser or apply another account response', async () => {
  const app = harness();
  app.api.post = async () => { app.token('different-session'); return { data: pending }; };
  await app.render().checkout('monthly');
  assert.equal(app.browsers.length, 0); assert.equal(app.render().data, null);
});

test('resuming an already-paid checkout verifies it without reopening or charging again', async () => {
  const app = harness(); app.api.get = async () => ({ data: pending });
  await app.render().refresh();
  app.api.post = async url => ({ data: url.endsWith('/verify') ? paid : pending });
  await app.render().checkout('monthly');
  assert.equal(app.browsers.length, 0); assert.equal(app.render().data.subscription.plan, 'premium');
});

test('manual payment checks keep pending plans inactive and provider errors never show raw payloads', async () => {
  const app = harness(); app.api.get = async () => ({ data: pending }); await app.render().refresh();
  await app.render().checkPayment(); assert.equal(app.render().notice.title, 'Payment not confirmed yet');
  for (const status of [401, 403, 404, 409, 422, 429, 503]) assert.ok(!helpers.subscriptionError({ response: { status, data: { message: 'private-provider-payload' } } }).includes('private-provider-payload'));
  app.token(null); app.posts.length = 0; await app.render().checkout('monthly'); assert.equal(app.posts.length, 0);
});

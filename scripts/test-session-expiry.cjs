/* global __dirname */
// Run with: node scripts/test-session-expiry.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const axios = require('axios');

function harness(token = 'old-session') {
  const cache = new Map(token ? [['userToken', token], ['userData', 'cached-user'], ['userProfile', 'cached-profile']] : []);
  const redirects = [];
  let removals = 0;
  const storage = {
    getItem: async key => cache.get(key) ?? null,
    multiRemove: async keys => { removals++; keys.forEach(key => cache.delete(key)); },
  };
  const filename = path.join(__dirname, '../api/axios.ts');
  const loaded = new Module(filename, module);
  const dependencies = { axios, '@react-native-async-storage/async-storage': storage, 'expo-router': { router: { replace: route => redirects.push(route) } } };
  loaded.require = name => { assert.ok(name in dependencies); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  const api = loaded.exports.default;
  const unauthorized = config => new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, { status: 401, data: { message: 'Unauthenticated.' }, config, headers: {}, statusText: 'Unauthorized' });
  return { api, cache, redirects, storage, unauthorized, removals: () => removals };
}

test('protected requests without a token are canceled before reaching the network, without redirecting', async () => {
  const app = harness(null);
  let requests = 0;
  app.api.defaults.adapter = async () => { requests++; throw new Error('Must not reach the network'); };
  for (let i = 0; i < 4; i++) await assert.rejects(app.api.get('/user/profile'), error => axios.isCancel(error));
  assert.equal(requests, 0);
  assert.equal(app.removals(), 0);
  assert.deepEqual(app.redirects, []);
});

test('login and registration still reach the network without a session', async () => {
  const app = harness(null);
  const paths = ['/login', '/google-login', '/register/check-email', '/register/student', '/register/employer', '/register/household', '/password/forgot', '/password/verify-code', '/password/reset'];
  const sent = [];
  app.api.defaults.adapter = async config => { sent.push(config.url); return { status: 200, data: {}, config, headers: {}, statusText: 'OK' }; };
  for (const url of paths) await app.api.post(url, {});
  assert.deepEqual(sent, paths);
  assert.deepEqual(app.redirects, []);
});

test('a late 401 after deliberate logout cannot interrupt login or registration', async () => {
  const app = harness();
  app.api.defaults.adapter = async config => { app.cache.clear(); throw app.unauthorized(config); };
  await assert.rejects(app.api.get('/user/profile'));
  assert.equal(app.removals(), 0);
  assert.deepEqual(app.redirects, []);
});

test('a late 401 from an old token cannot delete a newly signed-in session', async () => {
  const app = harness();
  app.api.defaults.adapter = async config => {
    app.cache.set('userToken', 'new-session'); app.cache.set('userData', 'new-account');
    throw app.unauthorized(config);
  };
  await assert.rejects(app.api.get('/user/profile'));
  assert.equal(app.cache.get('userToken'), 'new-session');
  assert.equal(app.cache.get('userData'), 'new-account');
  assert.equal(app.removals(), 0);
  assert.deepEqual(app.redirects, []);
});

test('concurrent 401 responses for the current token expire the session and redirect once', async () => {
  const app = harness();
  app.api.defaults.adapter = async config => { throw app.unauthorized(config); };
  const requests = await Promise.allSettled([app.api.get('/user/profile'), app.api.get('/user/account'), app.api.get('/student/applications')]);
  assert.ok(requests.every(result => result.status === 'rejected'));
  assert.equal(app.removals(), 1);
  assert.deepEqual(app.redirects, ['/auth/welcome']);
  assert.equal(app.cache.has('userToken'), false);
  assert.equal(app.cache.has('userData'), false);
  assert.equal(app.cache.has('userProfile'), false);
});

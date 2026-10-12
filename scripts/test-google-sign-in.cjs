/* global __dirname */
// Run with: node scripts/test-google-sign-in.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function harness() {
  let signIns = 0;
  let signOuts = 0;
  const configurations = [];
  const sdk = {
    configure: options => configurations.push(options),
    hasPlayServices: async () => true,
    signIn: async () => ({ type: 'cancelled' }),
    signOut: async () => {},
  };
  const filename = path.join(__dirname, '..', 'utils/googleAuth.ts');
  const loaded = new Module(filename, module);
  loaded.require = name => {
    assert.equal(name, '@react-native-google-signin/google-signin');
    return { GoogleSignin: { ...sdk, signIn: () => { signIns++; return sdk.signIn(); }, signOut: () => { signOuts++; return sdk.signOut(); } } };
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return { sdk, configurations, prompt: loaded.exports.promptNativeGoogleSignIn, signIns: () => signIns, signOuts: () => signOuts };
}

test('concurrent sign-in callers share one native dialog and keep account data', async () => {
  const app = harness();
  let finish;
  app.sdk.signIn = () => new Promise(resolve => { finish = resolve; });
  const first = app.prompt();
  const second = app.prompt();
  assert.equal(first, second);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.signIns(), 1);
  assert.equal(app.signOuts(), 1);
  assert.equal(app.configurations.length, 1);
  assert.equal(app.configurations[0].offlineAccess, false);
  assert.equal(app.configurations[0].forceCodeForRefreshToken, false);
  finish({ type: 'success', data: { user: { id: 'test', email: 'student@example.com', givenName: 'Test', familyName: 'Student', photo: 'photo.jpg' } } });
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b);
  assert.equal(a.email, 'student@example.com');
  assert.equal(a.photoUrl, 'photo.jpg');
});

test('cancelling the native picker releases the request for another attempt', async () => {
  const app = harness();
  assert.equal(await app.prompt(), null);
  app.sdk.signIn = async () => ({ data: { user: { id: 'next', email: 'next@example.com', name: 'Next Student' } } });
  const result = await app.prompt();
  assert.equal(result.email, 'next@example.com');
  assert.equal(app.signIns(), 2);
  assert.equal(app.configurations.length, 1);
});

test('Android Back cancellation also permits a new sign-in request', async () => {
  const app = harness();
  app.sdk.signIn = async () => { throw Object.assign(new Error('User cancelled'), { code: 'SIGN_IN_CANCELLED' }); };
  assert.equal(await app.prompt(), null);
  app.sdk.signIn = async () => ({ user: { id: 'legacy', email: 'legacy@example.com', name: 'Legacy Student' } });
  assert.equal((await app.prompt()).email, 'legacy@example.com');
  assert.equal(app.signIns(), 2);
});

test('changing accounts clears the remembered native selection before opening sign-in', async () => {
  const app = harness();
  app.sdk.signIn = async () => {
    assert.equal(app.signOuts(), 1);
    return { data: { user: { id: 'next', email: 'next@example.com', name: 'Next Student' } } };
  };
  assert.equal((await app.prompt({ selectAccount: true })).email, 'next@example.com');
  assert.equal(app.signIns(), 1);
});

test('a provider failure is safe and retry also opens account selection', async () => {
  const app = harness();
  app.sdk.signIn = async () => { throw new Error('Provider payload must not reach the UI'); };
  await assert.rejects(app.prompt(), error => /unavailable/.test(error.message) && !error.message.includes('Provider payload'));
  assert.equal(app.signOuts(), 1);
  app.sdk.signIn = async () => ({ data: { user: { id: 'next', email: 'next@example.com', name: 'Next Student' } } });
  assert.equal((await app.prompt()).email, 'next@example.com');
  assert.equal(app.signOuts(), 2);
});

test('each successful sign-in opens fresh account selection, including the second login', async () => {
  const app = harness();
  const events = [];
  app.sdk.signOut = async () => { events.push('signOut'); };
  app.sdk.signIn = async () => {
    events.push('signIn');
    return { data: { user: { id: `user-${app.signIns()}`, email: `user${app.signIns()}@example.com` } } };
  };
  assert.equal((await app.prompt()).email, 'user1@example.com');
  assert.equal((await app.prompt()).email, 'user2@example.com');
  assert.deepEqual(events, ['signOut', 'signIn', 'signOut', 'signIn']);
});

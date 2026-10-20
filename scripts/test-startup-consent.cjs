// Run with: node scripts/test-startup-consent.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.join(__dirname, '../utils/startupConsent.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { STARTUP_CONSENT_KEY, hasStartupConsent, saveStartupConsent } = loaded.exports;
const versions = { terms: 'October 10, 2026', privacy: 'October 16, 2026' };

function storage(initial = null) {
  let value = initial;
  let writes = 0;
  return {
    get writes() { return writes; },
    async getItem(key) { assert.equal(key, STARTUP_CONSENT_KEY); return value; },
    async setItem(key, next) { assert.equal(key, STARTUP_CONSENT_KEY); value = next; writes++; },
  };
}

test('first launch and malformed storage require agreement', async () => {
  for (const value of [null, '', 'true', 'null', '{}', '{broken', JSON.stringify({ accepted: true, ...versions })]) {
    assert.equal(await hasStartupConsent(storage(value), versions), false);
  }
});

test('an unchecked checkbox cannot persist agreement', async () => {
  const device = storage();
  await assert.rejects(saveStartupConsent(device, versions, false));
  assert.equal(device.writes, 0);
  assert.equal(await hasStartupConsent(device, versions), false);
});

test('successful agreement survives the next app launch for the same policies', async () => {
  const device = storage();
  await saveStartupConsent(device, versions, true);
  assert.equal(await hasStartupConsent(device, versions), true);
  const saved = JSON.parse(await device.getItem(STARTUP_CONSENT_KEY));
  assert.equal(saved.accepted, true);
  assert.ok(Number.isFinite(Date.parse(saved.acceptedAt)));
});

test('a change to either policy version requires a new agreement', async () => {
  const device = storage();
  await saveStartupConsent(device, versions, true);
  assert.equal(await hasStartupConsent(device, { ...versions, terms: 'new terms' }), false);
  assert.equal(await hasStartupConsent(device, { ...versions, privacy: 'new privacy' }), false);
});

test('read failures keep the gate closed; failed saves never count as agreement', async () => {
  const unavailable = {
    async getItem() { throw new Error('Storage unavailable'); },
    async setItem() { throw new Error('Storage unavailable'); },
  };
  assert.equal(await hasStartupConsent(unavailable, versions), false);
  await assert.rejects(saveStartupConsent(unavailable, versions, true));
  assert.equal(await hasStartupConsent(unavailable, versions), false);
});

/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.join(__dirname, '../utils/uploadRateLimit.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { getUploadRateLimitNotice } = loaded.exports;

test('upload 429 shows the server cooldown without copying provider or request secrets', () => {
  const notice = getUploadRateLimitNotice({ response: { status: 429, data: { retry_after: 45, message: 'provider-secret' } }, config: { data: 'private-file' } });
  assert.equal(notice.title, 'Please wait before uploading');
  assert.match(notice.message, /45 seconds/);
  assert.equal(notice.iconName, 'schedule');
  assert.ok(!JSON.stringify(notice).includes('provider-secret'));
  assert.ok(!JSON.stringify(notice).includes('private-file'));
});

test('Retry-After header works when the backend returns no cooldown body', () => {
  assert.match(getUploadRateLimitNotice({ response: { status: 429, headers: { 'retry-after': '12' } } }).message, /12 seconds/);
});

test('invalid cooldown values fall back to a bounded waiting message', () => {
  for (const value of [null, '', 0, -1, Infinity, 50000, {}, [], true, '<script>']) {
    assert.match(getUploadRateLimitNotice({ response: { status: 429, data: { retry_after: value } } }).message, /60 seconds/);
  }
});

test('validation and connection errors retain their original error handling', () => {
  for (const error of [null, undefined, new Error('offline'), {}, { response: { status: 422 } }, { response: { status: 503 } }, { response: { status: 401 } }]) {
    assert.equal(getUploadRateLimitNotice(error), null);
  }
});

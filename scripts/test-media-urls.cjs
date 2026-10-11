/* global __dirname */
// Run with: node scripts/test-media-urls.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.join(__dirname, '../utils/media.ts');
const loaded = new Module(filename, module);
const backend = 'https://diskartech-backend.onrender.com';
loaded.require = name => {
  assert.equal(name, '@/api/axios');
  return { BACKEND_URL: backend, STORAGE_URL: backend + '/storage/' };
};
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { resolveMediaUrl, mediaFilename } = loaded.exports;

test('Cloudinary URLs and signed query strings are preserved byte for byte', () => {
  for (const url of [
    'https://res.cloudinary.com/cloud/image/upload/v123/student/avatar.png',
    backend + '/media/cloudinary/raw/authenticated/id.png?expires=123&signature=a%2Bb',
  ]) assert.equal(resolveMediaUrl(url), url);
});
test('legacy paths never get a duplicate storage prefix', () => {
  for (const value of ['student/id.png', '/student/id.png', 'storage/student/id.png', '/storage/student/id.png', 'storage/storage/student/id.png']) {
    assert.equal(resolveMediaUrl(value), backend + '/storage/student/id.png');
  }
});
test('backend signed route stays outside the public storage directory', () => {
  assert.equal(resolveMediaUrl('/media/cloudinary/raw/authenticated/id.png?signature=abc&expires=123'), backend + '/media/cloudinary/raw/authenticated/id.png?signature=abc&expires=123');
});
test('local device image previews remain usable', () => {
  for (const uri of ['file:///cache/photo.jpg', 'content://media/external/images/1']) assert.equal(resolveMediaUrl(uri), uri);
});
test('missing values, raw private references and unsafe inputs do not become image URLs', () => {
  for (const value of [null, undefined, {}, '', ' null ', 'undefined', 'javascript:alert(1)', '//example.com/file', '../id.png', 'student/../id.png', 'file\\id.png', 'photo\x00.png', '<img>', 'cloudinary/raw/authenticated/private.png', '/storage/cloudinary/raw/authenticated/private.png']) {
    assert.equal(resolveMediaUrl(value), null, String(value));
  }
});
test('display filename excludes signed credentials and decodes spaces', () => {
  assert.equal(mediaFilename(backend + '/media/My%20ID.png?signature=private&expires=123'), 'My ID.png');
  assert.equal(mediaFilename(null), null);
});

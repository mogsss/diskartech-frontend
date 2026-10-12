/* global __dirname, setImmediate */
// Run with: node scripts/test-student-document-upload.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, dependencies = {}, prefix = '') {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  loaded._compile(prefix + ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}
const analysis = load('utils/documentAnalysis.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness() {
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect() {}, // Polling is driven explicitly in these asynchronous regression checks.
  };
  const initial = { coe: 'old.pdf', coe_ai_is_valid: false, school_id: 'school.jpg', school_id_ai_is_valid: true, isVerified: false, rejection_reason: 'Old document needs replacement' };
  const cache = new Map([['userProfile', JSON.stringify(initial)]]);
  const storage = { getItem: async key => cache.get(key) ?? null, setItem: async (key, value) => cache.set(key, value) };
  const api = { get: async () => ({ data: { profile: JSON.parse(cache.get('userProfile')) } }), post: async () => { throw new Error('Upload mock not configured'); } };
  const picker = { getDocumentAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///test/coe.pdf', name: 'coe.pdf', mimeType: 'application/pdf', size: 50 }] }) };
  const imagePicker = { launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///test/avatar.jpg', fileName: 'avatar.jpg', mimeType: 'image/jpeg' }] }) };
  const hook = load('hooks/useStudentProfile.ts', {
    react, '@react-native-async-storage/async-storage': storage,
    'expo-router': { router: {} }, 'expo-document-picker': picker, 'expo-image-picker': imagePicker,
    '@/utils/notifications': {}, '@/api/axios': api,
    '@/utils/media': { resolveMediaUrl: value => value ?? null }, '@/utils/documentAnalysis': analysis,
  }, 'const FormData = class { fields = new Map(); append(key, value) { this.fields.set(key, value); } };\n');
  return { api, picker, imagePicker, cache, storage, render() { cursor = 0; return hook.useStudentProfile(); } };
}

test('profile picture upload shows loading, blocks duplicate uploads, and updates the avatar', async () => {
  const app = harness();
  await app.render().fetchStudentProfile();
  const request = deferred();
  let posts = 0;
  app.api.post = (url, body) => {
    posts++;
    assert.equal(url, '/student/upload-doc');
    assert.equal(body.fields.get('document_type'), 'profile_picture');
    return request.promise;
  };
  const upload = app.render().handleUploadProfilePic();
  await tick();
  assert.equal(app.render().uploadingProfilePicture, true);
  await app.render().handleUploadProfilePic();
  await app.render().handleUploadDocument('coe', 'COR/COE');
  assert.equal(posts, 1);
  request.resolve({ data: { status: 'success', file_path: 'new-avatar.jpg', full_url: 'https://example.com/new-avatar.jpg' } });
  await upload;
  await tick();
  assert.equal(app.render().uploadingProfilePicture, false);
  assert.equal(app.render().profilePicUri, 'https://example.com/new-avatar.jpg');
  assert.equal(app.render().alertModalConfig.title, 'Profile Updated');
});

test('profile picture picker cancellation and upload failure release loading and allow retry', async () => {
  const app = harness();
  app.imagePicker.launchImageLibraryAsync = async () => ({ canceled: true });
  await app.render().handleUploadProfilePic();
  assert.equal(app.render().uploadingProfilePicture, false);
  app.imagePicker.launchImageLibraryAsync = async () => ({ canceled: false, assets: [{ uri: 'file:///avatar.jpg' }] });
  let posts = 0;
  app.api.post = async () => { posts++; throw new Error('Network unavailable'); };
  await app.render().handleUploadProfilePic();
  assert.equal(app.render().uploadingProfilePicture, false);
  assert.equal(app.render().alertModalConfig.title, 'Upload Failed');
  await app.render().handleUploadProfilePic();
  assert.equal(posts, 2);
});

test('upload shows loading, blocks duplicate submissions, and replaces the old AI verdict with pending', async () => {
  const app = harness();
  await app.render().fetchStudentProfile();
  const request = deferred();
  let posts = 0;
  app.api.post = (url, body) => {
    posts++;
    assert.equal(url, '/student/upload-doc');
    assert.equal(body.fields.get('document_type'), 'coe');
    return request.promise;
  };
  const upload = app.render().handleUploadDocument('coe', 'COR/COE');
  await tick();
  assert.equal(app.render().uploadingDocument, 'coe');
  await app.render().handleUploadDocument('coe', 'COR/COE');
  assert.equal(posts, 1);
  request.resolve({ data: { status: 'success', file_path: 'new.pdf' } });
  await upload;
  await tick();
  const result = app.render();
  assert.equal(result.uploadingDocument, null);
  assert.equal(result.uploadedDocs.coe_raw, 'new.pdf');
  assert.equal(result.uploadedDocs.coe_ai_is_valid, null);
  assert.equal(result.uploadedDocs.school_id_ai_is_valid, true);
  assert.equal(result.rejectionReason, null);
  assert.equal(analysis.getDocumentAnalysisStatus('coe', true, result.uploadedDocs.coe_ai_is_valid).label, 'Pending analysis');
});

test('cancel and request failure release the loading state and permit another upload', async () => {
  const app = harness();
  app.picker.getDocumentAsync = async () => ({ canceled: true });
  await app.render().handleUploadDocument('coe', 'COR/COE');
  assert.equal(app.render().uploadingDocument, null);
  app.picker.getDocumentAsync = async () => ({ canceled: false, assets: [{ uri: 'file:///coe.pdf', name: 'coe.pdf', size: 50 }] });
  let calls = 0;
  app.api.post = async () => { calls++; throw new Error('Network unavailable'); };
  await app.render().handleUploadDocument('coe', 'COR/COE');
  assert.equal(app.render().uploadingDocument, null);
  assert.equal(app.render().alertModalVisible, true);
  await app.render().handleUploadDocument('coe', 'COR/COE');
  assert.equal(calls, 2);
});

test('a profile response started before replacement cannot restore the old AI verdict', async () => {
  const app = harness();
  await app.render().fetchStudentProfile();
  const oldRequest = deferred();
  app.api.get = () => oldRequest.promise;
  const oldRefresh = app.render().fetchStudentProfile();
  await tick();
  app.api.post = async () => ({ data: { status: 'success', file_path: 'replacement.pdf' } });
  app.api.get = async () => ({ data: { profile: JSON.parse(app.cache.get('userProfile')) } });
  await app.render().handleUploadDocument('coe', 'COR/COE');
  await tick();
  oldRequest.resolve({ data: { profile: { coe: 'old.pdf', coe_ai_is_valid: false } } });
  await oldRefresh;
  assert.equal(app.render().uploadedDocs.coe_raw, 'replacement.pdf');
  assert.equal(app.render().uploadedDocs.coe_ai_is_valid, null);
});

test('cache failures after a successful upload do not leave loading active or report upload failure', async () => {
  const app = harness();
  await app.render().fetchStudentProfile();
  app.storage.getItem = async key => { if (key === 'userProfile') throw new Error('Cache unavailable'); return null; };
  app.api.post = async () => ({ data: { status: 'success', file_path: 'replacement.pdf' } });
  app.api.get = async () => ({ data: { profile: { coe: 'replacement.pdf', coe_ai_is_valid: null } } });
  await app.render().handleUploadDocument('coe', 'COR/COE');
  await tick();
  assert.equal(app.render().uploadingDocument, null);
  assert.equal(app.render().alertModalConfig.title, 'Upload Successful');
  assert.equal(app.render().uploadedDocs.coe_raw, 'replacement.pdf');
  assert.equal(app.render().uploadedDocs.coe_ai_is_valid, null);
});

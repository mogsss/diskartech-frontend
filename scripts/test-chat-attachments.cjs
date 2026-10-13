/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const attachment = { id: '11111111-1111-4111-8111-111111111111', filename: 'photo.png', mime_type: 'image/png', kind: 'image', size: 123 };

function load(relative, dependencies = {}, prefix = '') {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; };
  loaded._compile(prefix + ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}
const helpers = load('utils/chatAttachments.ts');

test('drafts validate supported types and size, sanitize filenames, and reject remote or executable attachments', () => {
  const draft = helpers.createAttachmentDraft({ uri: 'file:///photo.png', name: '../<photo>\r\n.png', mimeType: 'image/png', size: 123 });
  assert.equal(draft.filename, 'photo.png'); assert.equal(draft.kind, 'image');
  assert.equal(helpers.createAttachmentDraft({ uri: 'content:///resume', name: 'resume.pdf', size: 123 }).mime_type, 'application/pdf');
  for (const invalid of [
    { uri: 'https://example.com/photo.png', name: 'photo.png' },
    { uri: 'file:///script', name: 'script.svg', mimeType: 'image/svg+xml' },
    { uri: 'file:///photo.png', name: 'photo.png', size: 0 },
    { uri: 'file:///photo.png', name: 'photo.png', size: 10485761 },
  ]) assert.throws(() => helpers.createAttachmentDraft(invalid));
  assert.equal(helpers.sanitizeChatText('Hello\x00\nWorld'), 'Hello\nWorld');
});

test('message attachment metadata cannot contain arbitrary URLs, invalid IDs, or mismatched image types', () => {
  assert.deepEqual(helpers.normalizeChatAttachment({ ...attachment, url: 'https://untrusted.example/file' }), attachment);
  for (const invalid of [{ ...attachment, id: '../../file' }, { ...attachment, size: -1 }, { ...attachment, kind: 'file' }, { ...attachment, mime_type: 'text/html' }]) assert.equal(helpers.normalizeChatAttachment(invalid), null);
});

function hookHarness() {
  const slots = []; let cursor = 0; const errors = []; let picks = 0; let uploads = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect() {},
  };
  const native = { pick: async () => ({ canceled: false, assets: [{ uri: 'file:///photo.png', fileName: 'photo.png', mimeType: 'image/png', fileSize: 123 }] }) };
  const api = { post: async () => ({ data: { attachment } }) };
  const hooks = load('hooks/useChatAttachments.ts', {
    react, '@/api/axios': { post: (...args) => { uploads++; return api.post(...args); } }, '@/utils/chatAttachments': helpers,
    'expo-image-picker': { UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' }, launchImageLibraryAsync: (...args) => { picks++; return native.pick(...args); } },
    'expo-document-picker': { getDocumentAsync: (...args) => { picks++; return native.pick(...args); } },
  }, 'const FormData = class { fields = new Map(); append(key, value) { this.fields.set(key, value); } };\n');
  return { api, native, errors, picks: () => picks, uploads: () => uploads, render() { cursor = 0; return hooks.useChatAttachments('chat_u1_u2', message => errors.push(message)); } };
}

test('picker cancellation preserves a draft and invalid files never reach the upload endpoint', async () => {
  const app = hookHarness();
  await app.render().pick('photo');
  app.native.pick = async () => ({ canceled: true });
  await app.render().pick('file');
  assert.equal(app.render().draft.filename, 'photo.png');
  app.native.pick = async () => ({ canceled: false, assets: [{ uri: 'file:///bad.svg', name: 'bad.svg', mimeType: 'image/svg+xml' }] });
  await app.render().pick('file');
  assert.equal(app.errors.length, 1); assert.equal(app.uploads(), 0);
  assert.equal(app.render().draft.filename, 'photo.png');
});

test('upload tracks progress, prevents simultaneous selections/uploads, and reuses the uploaded ID on retry', async () => {
  const app = hookHarness(); await app.render().pick('photo');
  let finish;
  app.api.post = (url, body, config) => {
    assert.equal(url, '/chats/chat_u1_u2/attachments');
    assert.equal(body.fields.get('file').name, 'photo.png');
    config.onUploadProgress({ loaded: 50, total: 100 });
    return new Promise(resolve => { finish = resolve; });
  };
  const uploading = app.render().prepare();
  assert.equal(app.render().uploading, true); assert.equal(app.render().progress, 50);
  await assert.rejects(app.render().prepare(), /wait/);
  await app.render().pick('file'); assert.equal(app.picks(), 1);
  finish({ data: { attachment } });
  assert.deepEqual(await uploading, attachment);
  assert.equal(app.render().progress, 100); assert.equal(app.render().uploading, false);
  assert.deepEqual(await app.render().prepare(), attachment); assert.equal(app.uploads(), 1);
  app.render().clear(); assert.equal(app.render().draft, null);
});

test('failed uploads preserve the selected attachment and allow a later retry', async () => {
  const app = hookHarness(); await app.render().pick('photo');
  app.api.post = async () => { throw { response: { status: 422, data: { errors: { file: ['The file is too large.'] } } } }; };
  await assert.rejects(app.render().prepare(), /too large/);
  assert.equal(app.render().draft.filename, 'photo.png'); assert.equal(app.render().uploading, false);
  app.api.post = async () => ({ data: { attachment } });
  assert.deepEqual(await app.render().prepare(), attachment); assert.equal(app.uploads(), 2);
});

test('upload service failures show safe messages and never echo provider response bodies', async () => {
  const app = hookHarness(); await app.render().pick('photo');
  for (const status of [403, 404, 429, 503]) {
    app.api.post = async () => { throw { response: { status, data: { message: 'Provider-private-payload' } } }; };
    await assert.rejects(app.render().prepare(), error => !error.message.includes('Provider-private-payload'));
    assert.equal(app.render().draft.filename, 'photo.png');
  }
});

function chatHarness() {
  const writes = []; const commits = []; let fail = false; let pushes = 0;
  const firestore = {
    collection: (...parts) => ({ parts }),
    doc: (...parts) => ({ path: parts.map(part => typeof part === 'object' ? 'db' : part).join('/') }),
    serverTimestamp: () => 'server-time',
    writeBatch: () => {
      const staged = [];
      return { set: (ref, body, options) => staged.push({ ref, body, options }), commit: async () => { commits.push(staged); if (fail) throw new Error('Write failed'); writes.push(...staged); } };
    },
  };
  const chat = load('utils/chat.ts', {
    '@/utils/firebase': { db: {} }, 'firebase/firestore': firestore, '@/types/chat': {}, './chatHelpers': {}, './chatAttachments': helpers,
    './notifications': { getRecipientPushToken: async () => { pushes++; return null; } },
  });
  return { send: chat.sendChatMessage, writes, commits, fail(value) { fail = value; }, pushes: () => pushes };
}

test('attachment-only messages update the message and conversation preview atomically', async () => {
  const app = chatHarness();
  await app.send({ chatId: 'chat_u1_u2', senderId: '1', senderName: 'Student', receiverId: '2', receiverName: 'Employer', text: '', attachment, messageId: 'retry-id' });
  assert.equal(app.commits.length, 1); assert.equal(app.writes.length, 2);
  assert.equal(app.writes[0].body.text, ''); assert.deepEqual(app.writes[0].body.attachment, attachment);
  assert.equal(app.writes[1].body.last_message, 'Photo'); assert.equal(app.writes[1].body.last_message_for_2, 'Photo');
});

test('failed Firestore writes leave no partial message and a retry keeps the same message ID', async () => {
  const app = chatHarness();
  const message = { chatId: 'chat_u1_u2', senderId: '1', senderName: 'Student', receiverId: '2', receiverName: 'Employer', text: 'Hello\x00', attachment, messageId: 'retry-id' };
  app.fail(true); await assert.rejects(app.send(message));
  assert.equal(app.writes.length, 0); assert.equal(app.pushes(), 0);
  app.fail(false); await app.send(message);
  assert.equal(app.commits[0][0].ref.path, app.commits[1][0].ref.path);
  assert.equal(app.writes[0].body.text, 'Hello'); assert.equal(app.pushes(), 1);
});

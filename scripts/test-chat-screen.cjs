/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
const attachment = { id: '11111111-1111-4111-8111-111111111111', filename: 'photo.png', mime_type: 'image/png', kind: 'image', size: 123 };

function load(relative, dependencies, prefix = '') {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; };
  loaded._compile(prefix + ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}
const helpers = load('utils/chatAttachments.ts', {});
const jsx = (type, props) => ({ type, props });

function harness() {
  const slots = []; let cursor = 0; const effects = []; const sends = []; const toasts = []; const clears = []; let identifiers = 0;
  const session = { token: 'fixture-session', userId: '1', role: 'student' };
  const routes = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect(callback, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((value, i) => value !== previous[i])) { slots[index] = deps; effects.push(callback); } },
  };
  const files = {
    draft: null, selecting: false, uploading: false, progress: 0,
    pick: async () => { files.draft = { uri: 'file:///photo.png', filename: 'photo.png', mime_type: 'image/png', kind: 'image', size: 123 }; },
    prepare: async () => files.draft ? attachment : undefined,
    clear: () => { files.draft = null; },
  };
  const sender = { send: async () => {} };
  const clearer = { clear: async () => {} };
  const stream = { messageDocs: [] };
  const helpersMock = {
    CHATS_COLLECTION: 'chats', getLoggedInUserId: async () => session.userId, normalizeChatFields: data => data,
    getLoggedInRole: async () => session.role,
    getOtherParticipant: () => ({ id: '2', name: 'Employer', avatar: '' }), getTimestampMs: () => 0,
    markChatAsRead() {}, sendChatMessage: async params => { sends.push(params); return sender.send(params); },
    clearChatConversation: async (...params) => { clears.push(params); return clearer.clear(...params); },
    getMessageCreatedAt: () => null, getMessageSenderId: data => data.sender_id,
  };
  const screen = load('app/chat.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@/components/ui/Avatar': 'Avatar', '@/components/ui/modals/ChatOptionsModal': 'Options',
    '@/components/ui/modals/NotificationModal': 'Notice', '@/components/ui/modals/UserProfileModal': 'Profile',
    '@/components/ui/SafeStatusBar': 'Status', '@/components/chat/ChatAttachmentBubble': 'Attachment',
    '@/api/axios': { get: async () => ({ data: { status: 'success', user: { name: 'Employer' } } }) },
    '@/utils/media': { resolveMediaUrl: value => value }, '@/utils/chatAttachments': helpers,
    '@/utils/chat': helpersMock, '@/utils/notifications': { setActiveChatScreen() {} },
    '@react-native-async-storage/async-storage': { getItem: async () => session.token },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: false }) },
    '@/hooks/useToast': { useToast: () => ({ showToast: options => toasts.push(options) }) },
    '@/hooks/useChatAttachments': { useChatAttachments: () => files },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    'expo-crypto': { randomUUID: () => `message-${++identifiers}` },
    'expo-router': { router: { back() { routes.push('back'); }, dismissTo: route => routes.push(route) }, useLocalSearchParams: () => ({ id: 'chat_u1_u2' }) },
    'react-native': { ActivityIndicator: 'Spinner', Image: 'Image', Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) }, Platform: { OS: 'android' }, ScrollView: 'Scroll', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/utils/firebase': { db: {} },
    'firebase/firestore': { doc: () => ({ kind: 'chat' }), collection: () => ({}), query: () => ({ kind: 'messages' }), orderBy() {}, onSnapshot: (ref, receive) => { receive(ref.kind === 'chat' ? { exists: () => true, data: () => ({}) } : { docs: stream.messageDocs }); return () => {}; } },
  }, 'const setTimeout = () => 0; const clearTimeout = () => {};\n').default;
  const nodes = [];
  function walk(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); nodes.push(node); walk(node.props?.children); }
  const app = { sends, sender, files, session, toasts, clears, clearer, stream, routes,
    render() { cursor = 0; nodes.length = 0; walk(screen()); return app; },
    commitEffects() { while (effects.length) effects.shift()(); },
    button(label) { app.render(); const node = nodes.find(item => item.props?.accessibilityLabel === label); assert.ok(node, `Missing ${label}`); return node.props; },
    input() { app.render(); return nodes.find(item => item.type === 'Input').props; },
    notice() { app.render(); return nodes.find(item => item.type === 'Notice').props; },
    options() { app.render(); return nodes.find(item => item.type === 'Options').props; },
    hasText(text) { app.render(); return nodes.some(item => item.type === 'Text' && item.props?.children === text); },
    icons() { app.render(); return nodes.filter(item => item.type === 'Icon').map(item => item.props.name); },
  };
  return app;
}

async function ready(app) {
  app.render(); app.commitEffects(); await tick();
  app.render(); app.commitEffects(); await tick();
  app.render(); app.commitEffects(); await tick();
}

test('plus opens Photo/File choices and attachment-only messages can be sent with a preview', async () => {
  const app = harness(); await ready(app);
  assert.ok(app.icons().includes('add')); assert.equal(app.button('Send message').disabled, true);
  app.button('Add attachment').onPress();
  app.button('Choose photo').onPress(); await tick();
  assert.equal(app.files.draft.filename, 'photo.png');
  assert.equal(app.input().placeholder, 'Add a message (optional)...');
  assert.equal(app.button('Send message').disabled, false);
  app.button('Send message').onPress(); await tick();
  assert.equal(app.sends.length, 1); assert.equal(app.sends[0].text, '');
  assert.deepEqual(app.sends[0].attachment, attachment);
  assert.equal(app.files.draft, null);
});

test('failed message sends preserve caption and attachment; retry keeps the same message ID', async () => {
  const app = harness(); await ready(app);
  app.button('Add attachment').onPress(); app.button('Choose photo').onPress(); await tick();
  app.input().onChangeText('Caption\x00');
  app.sender.send = async () => { throw new Error('Network unavailable'); };
  app.button('Send message').onPress(); await tick();
  assert.equal(app.input().value, 'Caption'); assert.ok(app.files.draft);
  assert.equal(app.notice().visible, true);
  app.sender.send = async () => {};
  app.button('Send message').onPress(); await tick();
  assert.equal(app.sends[0].messageId, app.sends[1].messageId);
  assert.equal(app.input().value, ''); assert.equal(app.files.draft, null);
});

test('file validation messages reach the user without being replaced by the generic send error', async () => {
  const app = harness(); await ready(app);
  app.button('Add attachment').onPress(); app.button('Choose photo').onPress(); await tick();
  for (const message of [
    'Choose a JPG, PNG, WEBP, GIF, PDF, or DOCX file no larger than 10 MB.',
    'Choose a valid image no larger than 12000 pixels on either side.',
    'The file failed to upload.',
  ]) {
    app.files.prepare = async () => { throw new helpers.ChatAttachmentUploadError(message); };
    app.button('Send message').onPress(); await tick();
    assert.equal(app.notice().message, message);
    assert.ok(app.files.draft);
    assert.equal(app.sends.length, 0);
  }
});

test('rapid send taps submit once and keep attachment removal disabled while sending', async () => {
  const app = harness(); await ready(app);
  app.button('Add attachment').onPress(); app.button('Choose photo').onPress(); await tick();
  let finish;
  app.sender.send = () => new Promise(resolve => { finish = resolve; });
  const send = app.button('Send message').onPress;
  send(); send(); await tick();
  assert.equal(app.sends.length, 1);
  assert.equal(app.button('Remove attachment').disabled, true);
  assert.equal(app.input().editable, false);
  finish(); await tick();
  assert.equal(app.files.draft, null);
});

test('logout during attachment preparation cannot send a message as the previous account', async () => {
  const app = harness(); await ready(app);
  app.button('Add attachment').onPress(); app.button('Choose photo').onPress(); await tick();
  let finish;
  app.files.prepare = () => new Promise(resolve => { finish = resolve; });
  app.button('Send message').onPress(); await tick();
  app.session.token = 'different-session'; app.session.userId = '2';
  finish(attachment); await tick();
  assert.equal(app.sends.length, 0);
  assert.ok(app.files.draft);
  assert.match(app.notice().message, /session changed/);
});

test('clearing chat still requires confirmation and Cancel does not delete or show a toast', async () => {
  const app = harness(); await ready(app);
  app.options().onClearChat();
  assert.equal(app.notice().title, 'Delete Conversation');
  assert.equal(app.notice().visible, true);
  assert.equal(app.clears.length, 0);
  app.notice().onSecondaryPress();
  assert.equal(app.notice().visible, false);
  assert.equal(app.clears.length, 0);
  assert.equal(app.toasts.length, 0);
  assert.deepEqual(app.routes, []);
});

test('a successful clear shows a toast only after deletion succeeds and clears the visible messages', async () => {
  const app = harness();
  app.stream.messageDocs = [{ id: 'msg-1', data: () => ({ sender_id: '1', text: 'Existing message' }) }];
  await ready(app);
  assert.equal(app.hasText('Existing message'), true);
  let finish;
  app.clearer.clear = () => new Promise(resolve => { finish = resolve; });
  app.options().onClearChat();
  const pending = app.notice().onPrimaryPress();
  assert.deepEqual(app.clears, [['chat_u1_u2', '1']]);
  assert.equal(app.notice().visible, false);
  assert.equal(app.toasts.length, 0);
  assert.equal(app.hasText('Existing message'), true);
  assert.deepEqual(app.routes, []);
  finish(); await pending;
  assert.equal(app.hasText('Existing message'), false);
  assert.equal(app.toasts[0].type, 'success');
  assert.equal(app.toasts[0].title, 'Chat cleared');
  assert.equal(app.notice().visible, false);
  assert.deepEqual(app.routes, ['/students/(tabs)/messages']);
});

test('a failed chat clear keeps the messages and shows an error toast', async () => {
  const app = harness();
  app.stream.messageDocs = [{ id: 'msg-1', data: () => ({ sender_id: '1', text: 'Keep this message' }) }];
  await ready(app);
  app.clearer.clear = async () => { throw Error('Offline'); };
  app.options().onClearChat(); await app.notice().onPrimaryPress();
  assert.equal(app.hasText('Keep this message'), true);
  assert.equal(app.toasts.length, 1);
  assert.equal(app.toasts[0].type, 'error');
  assert.equal(app.notice().visible, false);
  assert.deepEqual(app.routes, []);
});

test('employer and household users return to their Messages tab after clearing a chat', async () => {
  for (const role of ['employer', 'household']) {
    const app = harness(); app.session.role = role; await ready(app);
    app.options().onClearChat(); await app.notice().onPrimaryPress();
    assert.equal(app.toasts[0].type, 'success');
    assert.deepEqual(app.routes, ['/employer/(tabs)/messages']);
  }
});

/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));
const attachment = { id: '11111111-1111-4111-8111-111111111111', filename: 'photo.png', mime_type: 'image/png', kind: 'image', size: 123 };

function load(relative, dependencies) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

function harness(file = attachment) {
  const slots = []; let cursor = 0; let effect; let requests = 0;
  const opened = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useCallback(callback) { return callback; }, useEffect(callback) { effect = callback; },
  };
  const base = 'https://backend.example.com';
  const api = { get: async url => {
    assert.equal(url, `/chats/chat_u1_u2/attachments/${file.id}`);
    requests++;
    return { data: { attachment: file, url: `${base}/chat-attachments/${file.id}/view?expires=${requests}&signature=fixture` } };
  } };
  const jsx = (type, props) => ({ type, props });
  const bubble = load('components/chat/ChatAttachmentBubble.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@/api/axios': { default: api, BACKEND_URL: base, __esModule: true },
    '@/utils/chatAttachments': load('utils/chatAttachments.ts', {}),
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {} }) }, '@expo/vector-icons': { MaterialIcons: 'Icon' },
    'expo-web-browser': { openBrowserAsync: async url => opened.push(url) },
    'react-native': { ActivityIndicator: 'Spinner', Image: 'Image', Modal: 'Modal', Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
  }).default;
  const nodes = [];
  function walk(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); nodes.push(node); walk(node.props?.children); }
  const app = { api, opened, requests: () => requests,
    render() { cursor = 0; nodes.length = 0; walk(bubble({ chatId: 'chat_u1_u2', attachment: file, mine: false })); return app; },
    mount() { app.render(); effect(); },
    open() { app.render(); return nodes.find(node => node.props?.accessibilityLabel?.startsWith('Open ')).props.onPress(); },
    preview() { app.render(); return nodes.find(node => node.type === 'Image')?.props; },
    viewer() { app.render(); return nodes.find(node => node.type === 'Modal').props; },
  };
  return app;
}

test('opening a document resolves an authorized fresh link each time without persisting a URL in the message', async () => {
  const file = { ...attachment, kind: 'file', filename: 'resume.pdf', mime_type: 'application/pdf' };
  const app = harness(file); app.mount();
  assert.equal(app.requests(), 0);
  app.open(); await tick();
  app.open(); await tick();
  assert.equal(app.requests(), 2); assert.equal(app.opened.length, 2);
  assert.notEqual(app.opened[0], app.opened[1]);
  assert.equal(file.url, undefined);
});

test('photo delivery failure refreshes once and photo opening obtains a fresh full-screen viewing link', async () => {
  const app = harness(); app.mount(); await tick();
  const first = app.preview().source.uri;
  app.preview().onError(); await tick();
  assert.notEqual(app.preview().source.uri, first);
  assert.equal(app.requests(), 2);
  app.open(); await tick();
  assert.equal(app.requests(), 3); assert.equal(app.viewer().visible, true);
});

test('a viewing URL outside the backend cannot be opened', async () => {
  const file = { ...attachment, kind: 'file', filename: 'resume.pdf', mime_type: 'application/pdf' };
  const app = harness(file); app.mount();
  app.api.get = async () => ({ data: { attachment: file, url: 'https://untrusted.example.com/file.pdf' } });
  app.open(); await tick();
  assert.deepEqual(app.opened, []);
  assert.equal(app.viewer().visible, false);
});

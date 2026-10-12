/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(overrides = {}) {
  const slots = []; let cursor = 0;
  const selected = []; const prompts = []; let unlinks = 0;
  const checks = []; const routes = [];
  const api = { post: async (url, body) => { checks.push({ url, body }); return { data: { status: 'success', exists: false } }; } };
  const props = { linkedEmail: 'old@example.com', linkedName: 'Old Student', onGoogleProfileLoaded: profile => selected.push(profile), onUnlink: () => { unlinks++; }, ...overrides };
  const native = { prompt: async () => null };
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ActivityIndicator: 'Spinner', Image: 'Image', Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: false }) },
    '@/components/ui/modals/NotificationModal': 'Notice',
    '@/api/axios': api,
    'expo-router': { router: { push: route => routes.push(route) } },
    '@/utils/googleAuth': { promptNativeGoogleSignIn: options => { prompts.push(options); return native.prompt(); } },
    '../../assets/images/google-g.png': 1,
  };
  const filename = path.join(__dirname, '../components/auth/GoogleRegisterButton.tsx');
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  const nodes = [];
  function walk(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(walk); return; } nodes.push(node); walk(node.props?.children); }
  const app = { native, api, selected, prompts, checks, routes, props, unlinks: () => unlinks,
    render() { cursor = 0; nodes.length = 0; walk(loaded.exports.default(props)); return app; },
    change() { app.render(); return nodes.find(node => node.props?.accessibilityLabel === 'Change Google account').props; },
    notice() { app.render(); return nodes.find(node => node.type === 'Notice').props; },
    existingNotice() { app.render(); return nodes.find(node => node.type === 'Notice' && node.props.title === 'Account already exists').props; },
    continue() { app.render(); return nodes.find(node => node.props?.accessibilityLabel === 'Continue with Google').props; },
  };
  return app;
}

test('Change opens account selection instead of unlinking, and guards rapid taps', async () => {
  const app = harness();
  let finish;
  app.native.prompt = () => new Promise(resolve => { finish = resolve; });
  const change = app.change().onPress;
  change(); change();
  assert.deepEqual(app.prompts, [{ selectAccount: true }]);
  assert.equal(app.unlinks(), 0);
  assert.equal(app.change().disabled, true);
  const next = { email: 'next@example.com', firstName: 'Next', lastName: 'Student' };
  finish(next); await tick();
  assert.deepEqual(app.selected, [next]);
  assert.equal(app.change().disabled, false);
});

test('cancelling Change preserves the linked account and does not open a fallback picker', async () => {
  const app = harness();
  app.change().onPress(); await tick();
  assert.equal(app.unlinks(), 0);
  assert.deepEqual(app.selected, []);
  assert.equal(app.props.linkedEmail, 'old@example.com');
  assert.equal(app.notice().visible, false);
  assert.deepEqual(app.checks, []);
});

test('Change is available without an unlink callback on the final registration step', async () => {
  const app = harness({ onUnlink: undefined });
  app.native.prompt = async () => ({ email: 'final-step@example.com' });
  app.change().onPress(); await tick();
  assert.equal(app.selected[0].email, 'final-step@example.com');
});

test('native errors keep the old account and permit retry, without constructing a fake Google identity', async () => {
  const app = harness();
  app.native.prompt = async () => { throw new Error('Test native failure'); };
  app.change().onPress(); await tick();
  assert.equal(app.notice().visible, true);
  assert.equal(app.props.linkedEmail, 'old@example.com');
  assert.deepEqual(app.selected, []);
  app.native.prompt = async () => ({ email: 'retry@example.com' });
  app.change().onPress(); await tick();
  assert.equal(app.selected[0].email, 'retry@example.com');
  assert.equal(app.notice().visible, false);
});

test('first Google registration opens account selection and registration submission prevents account changes', async () => {
  const app = harness({ linkedEmail: undefined });
  app.continue().onPress(); await tick();
  assert.deepEqual(app.prompts, [{ selectAccount: true }]);
  const locked = harness({ disabled: true });
  assert.equal(locked.change().disabled, true);
  locked.change().onPress(); await tick();
  assert.deepEqual(locked.prompts, []);
});

test('existing email blocks registration details and offers Login without changing the current selection', async () => {
  const app = harness();
  app.native.prompt = async () => ({ email: ' Existing@Example.com ' });
  app.api.post = async (url, body) => {
    assert.equal(url, '/register/check-email');
    assert.deepEqual(body, { email: 'existing@example.com' });
    return { data: { status: 'success', exists: true } };
  };
  app.change().onPress(); await tick();
  assert.deepEqual(app.selected, []);
  assert.equal(app.unlinks(), 0);
  assert.equal(app.existingNotice().visible, true);
  assert.deepEqual(app.routes, []);
  app.existingNotice().onPrimaryPress();
  assert.deepEqual(app.routes, [{ pathname: '/auth/login', params: { google: '1', email: 'existing@example.com' } }]);
});

test('canceling an existing-account notice lets initial registration choose another Google account', async () => {
  const app = harness({ linkedEmail: undefined });
  app.native.prompt = async () => ({ email: 'existing@example.com' });
  app.api.post = async () => ({ data: { exists: true } });
  app.continue().onPress(); await tick();
  app.existingNotice().onSecondaryPress();
  app.native.prompt = async () => ({ email: 'new@example.com' });
  app.api.post = async () => ({ data: { exists: false } });
  app.continue().onPress(); await tick();
  assert.deepEqual(app.prompts, [{ selectAccount: true }, { selectAccount: true }]);
  assert.equal(app.selected[0].email, 'new@example.com');
});

test('failed or malformed availability checks cannot mark a Google profile as ready for registration', async () => {
  const app = harness();
  app.native.prompt = async () => ({ email: 'new@example.com' });
  for (const response of [undefined, { data: {} }, { data: { exists: 'false' } }]) {
    app.api.post = async () => { if (!response) throw new Error('Network unavailable'); return response; };
    app.change().onPress(); await tick();
    assert.equal(app.notice().title, 'Could not check email');
    assert.equal(app.notice().visible, true);
    assert.deepEqual(app.selected, []);
    assert.equal(app.unlinks(), 0);
  }
});

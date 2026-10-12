/* global __dirname */
// Exercises the actual screen handlers without device/network dependencies.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));

function load(relative, dependencies) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

function harness() {
  const slots = []; let cursor = 0; const calls = []; const redirects = [];
  const react = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useEffect() {},
  };
  const api = { post: async (url, body) => {
    calls.push({ url, body });
    return { data: { status: 'success', ...(url.endsWith('verify-code') ? { reset_token: 'a'.repeat(64) } : {}) } };
  } };
  const jsx = (type, props) => ({ type, props });
  const screen = load('app/auth/forgot-password.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, '@/api/axios': api,
    '@/components/ui/InputField': 'Input', '@/components/ui/SafeStatusBar': 'Status', '@/components/ui/modals/NotificationModal': 'Notice',
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: false }) },
    '@/utils/passwordChange': load('utils/passwordChange.ts', {}),
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    'expo-router': { router: { back() {}, replace: route => redirects.push(route) }, Stack: { Screen: 'Screen' } },
    'react-native': { ActivityIndicator: 'Spinner', Image: 'Image', Keyboard: { dismiss() {} }, Text: 'Text', TouchableOpacity: 'Button', View: 'View' },
    '../../assets/images/google-g.png': 1,
    'react-native-keyboard-aware-scroll-view': { KeyboardAwareScrollView: 'Scroll' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  }).default;
  const nodes = [];
  function walk(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) { node.forEach(walk); return; } nodes.push(node); walk(node.props?.children); }
  function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); if (Array.isArray(node)) return node.map(text).join(''); return text(node?.props?.children || ''); }
  const app = { api, calls, redirects,
    render() { cursor = 0; nodes.length = 0; walk(screen()); return app; },
    input(label, value) { app.render(); const input = nodes.find(node => node.type === 'Input' && node.props.label === label); assert.ok(input, `Missing input ${label}`); input.props.onChangeText(value); },
    button(label) { app.render(); const button = nodes.find(node => node.type === 'Button' && text(node) === label); assert.ok(button, `Missing button ${label}`); return button; },
    field(label) { app.render(); return nodes.find(node => node.type === 'Input' && node.props.label === label); },
    notice() { app.render(); return nodes.find(node => node.type === 'Notice').props; },
  };
  return app;
}

test('recovery moves from normalized email to code to new password and confirmation, then returns to login', async () => {
  const app = harness();
  app.input('Email', ' Student@Example.com ');
  app.button('Send reset code').props.onPress(); await tick();
  assert.deepEqual(app.calls[0], { url: '/password/forgot', body: { email: 'student@example.com' } });
  assert.equal(app.field('New password'), undefined);
  app.input('6-digit code', '12a34-56');
  assert.equal(app.field('6-digit code').props.value, '123456');
  app.button('Verify code').props.onPress(); await tick();
  const password = ' <Updated-password2!> ';
  app.input('New password', password); app.input('Confirm password', password);
  assert.equal(app.button('Reset password').props.disabled, false);
  app.button('Reset password').props.onPress(); await tick();
  assert.deepEqual(app.calls[2], { url: '/password/reset', body: { email: 'student@example.com', reset_token: 'a'.repeat(64), password, password_confirmation: password } });
  assert.equal(app.notice().visible, true);
  assert.equal(app.notice().title, 'Password reset');
  assert.equal(app.field('New password').props.value, '');
  app.notice().onPrimaryPress();
  assert.deepEqual(app.redirects, ['/auth/login']);
});

test('invalid OTP cannot reveal password fields and displays the server validation message', async () => {
  const app = harness();
  app.input('Email', 'student@example.com'); app.button('Send reset code').props.onPress(); await tick();
  app.api.post = async () => { throw { response: { status: 422, data: { errors: { code: ['The code has expired.'] } } } }; };
  app.input('6-digit code', '123456'); app.button('Verify code').props.onPress(); await tick();
  assert.equal(app.field('6-digit code').props.error, 'The code has expired.');
  assert.equal(app.field('New password'), undefined);
});

test('weak or mismatched passwords disable reset and duplicate email submissions send only once', async () => {
  const app = harness();
  let resolve;
  const waiting = new Promise(done => { resolve = done; });
  app.api.post = async (url, body) => { app.calls.push({ url, body }); return waiting; };
  app.input('Email', 'student@example.com');
  const send = app.button('Send reset code').props.onPress;
  send(); send();
  assert.equal(app.calls.length, 1);
  resolve({ data: { status: 'success' } }); await tick();
  app.api.post = async () => ({ data: { reset_token: 'a'.repeat(64) } });
  app.input('6-digit code', '123456'); app.button('Verify code').props.onPress(); await tick();
  app.input('New password', 'weak'); app.input('Confirm password', 'weak');
  assert.equal(app.button('Reset password').props.disabled, true);
  app.input('New password', 'Updated-password2!');
  assert.equal(app.button('Reset password').props.disabled, true);
  app.input('Confirm password', 'Updated-password2!');
  assert.equal(app.button('Reset password').props.disabled, false);
});

test('an expired reset grant clears the password fields and restarts recovery', async () => {
  const app = harness();
  app.input('Email', 'student@example.com'); app.button('Send reset code').props.onPress(); await tick();
  app.input('6-digit code', '123456'); app.button('Verify code').props.onPress(); await tick();
  app.input('New password', 'Updated-password2!'); app.input('Confirm password', 'Updated-password2!');
  app.api.post = async () => { throw { response: { status: 422, data: { errors: { reset_token: ['Expired reset session.'] } } } }; };
  app.button('Reset password').props.onPress(); await tick();
  assert.ok(app.field('Email'));
  assert.equal(app.field('New password'), undefined);
  assert.equal(app.notice().success, undefined);
  assert.match(app.notice().message, /expired/);
  assert.deepEqual(app.redirects, []);
});

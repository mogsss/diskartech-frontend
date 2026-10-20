/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));

function load(relative, dependencies = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const consent = load('utils/startupConsent.ts');
const policies = load('data/legalPolicies.ts');
const versions = { terms: policies.TERMS_AND_CONDITIONS.updated, privacy: policies.PRIVACY_POLICY.updated };
const jsx = (type, props) => ({ type, props });
const textOf = node => !node ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : textOf(node.props?.children);

function device() {
  const values = new Map([['userToken', 'fixture-session'], ['userData', '{"role":"student"}']]);
  return {
    values, failRead: false, loseWrite: false,
    async getItem(key) {
      if (this.failRead) throw new Error('Storage unavailable');
      return values.get(key) ?? null;
    },
    async setItem(key, value) { if (!this.loseWrite) values.set(key, value); },
  };
}

function harness(storage, initialRoute = '/auth/welcome') {
  const slots = []; const effects = []; const cleanups = []; const nodes = [];
  let cursor = 0; let route = initialRoute;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext() {},
    useCallback: callback => callback,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous[i])) {
        slots[index] = deps;
        effects.push(() => { cleanups[index]?.(); cleanups[index] = callback(); });
      }
    },
  };
  const Gate = load('components/common/StartupConsentGate.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@/data/legalPolicies': policies, '@/utils/startupConsent': consent,
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: false }) },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    '@react-native-async-storage/async-storage': storage,
    'expo-router': { usePathname: () => route },
    'react-native': { ActivityIndicator: 'Spinner', Modal: 'Modal', ScrollView: 'Scroll', Text: 'Text', TouchableOpacity: 'Button', View: 'View', useWindowDimensions: () => ({ height: 800 }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  }).default;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    nodes.push(node); walk(node.props?.children);
  }
  const app = {
    render() { cursor = 0; nodes.length = 0; walk(Gate({ children: jsx('Screen', {}) })); return app; },
    async settle() { app.render(); while (effects.length) effects.shift()(); await tick(); app.render(); return app; },
    modal() { app.render(); return nodes.find(node => node.type === 'Modal').props; },
    accepted() { app.render(); return nodes.find(node => node.type === 'Provider').props.value; },
    text() { app.render(); return nodes.filter(node => node.type === 'Text').map(textOf).join('\n'); },
    checkbox() { app.render(); return nodes.find(node => node.props?.accessibilityRole === 'checkbox')?.props; },
    button(label) { app.render(); const node = nodes.find(node => node.type === 'Button' && textOf(node) === label); assert.ok(node, `Missing ${label}`); return node.props; },
    navigate(pathname) { route = pathname; app.render(); },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); },
  };
  return app;
}

test('agreement survives closing and reopening the app with a restored student session', async () => {
  const storage = device();
  const first = harness(storage);
  await first.settle();
  assert.equal(first.modal().visible, true);
  assert.equal(first.button('Agree and continue').disabled, true);
  first.checkbox().onPress();
  first.button('Agree and continue').onPress();
  await first.settle();
  assert.equal(first.accepted(), true);
  assert.equal(first.modal().visible, false);
  first.unmount();

  const restarted = harness(storage, '/students/home');
  await restarted.settle();
  assert.equal(restarted.accepted(), true);
  assert.equal(restarted.modal().visible, false);
  restarted.navigate('/settings');
  await restarted.settle();
  assert.equal(restarted.modal().visible, false);
  assert.equal(storage.values.get('userToken'), 'fixture-session');
});

test('a startup read error offers retry instead of a fresh unchecked agreement', async () => {
  const storage = device();
  await consent.saveStartupConsent(storage, versions, true);
  storage.failRead = true;
  const app = harness(storage, '/students/home');
  await app.settle();
  assert.equal(app.accepted(), false);
  assert.equal(app.checkbox(), undefined);
  assert.match(app.text(), /Could not load your agreement/);
  storage.failRead = false;
  app.button('Try again').onPress();
  await app.settle();
  assert.equal(app.accepted(), true);
  assert.equal(app.modal().visible, false);
});

test('a lost save keeps the gate closed and lets the user retry saving', async () => {
  const storage = device(); storage.loseWrite = true;
  const app = harness(storage);
  await app.settle();
  app.checkbox().onPress();
  app.button('Agree and continue').onPress();
  await app.settle();
  assert.equal(app.accepted(), false);
  assert.equal(app.modal().visible, true);
  assert.match(app.text(), /could not save your agreement/);
  storage.loseWrite = false;
  app.button('Agree and continue').onPress();
  await app.settle();
  assert.equal(app.accepted(), true);
});

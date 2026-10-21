// Run with: node --test scripts/test-connectivity-banner.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    if (dependencies[name] instanceof Error) throw dependencies[name];
    return dependencies[name];
  } }, { filename });
  return exports;
}

function fixture({ missingModule = false, initialAppState = 'active' } = {}) {
  let value = null, effect, cleanup, receive, onAppState;
  let subscriptions = 0, removals = 0, refreshes = 0, writes = 0, nextTimer = 0;
  const timers = new Map();
  const warnings = [];
  const network = {
    addEventListener(callback) { receive = callback; subscriptions++; return () => { removals++; }; },
    async refresh() { refreshes++; },
  };
  const hook = load('hooks/useConnectivityNotice.ts', {
    react: {
      useState: () => [value, next => { value = typeof next === 'function' ? next(value) : next; writes++; }],
      useEffect(callback) { effect = callback; },
    },
    'react-native': { AppState: { currentState: initialAppState, addEventListener(event, callback) {
      assert.equal(event, 'change'); onAppState = callback; return { remove() { removals++; } };
    } } },
    '@react-native-community/netinfo': missingModule ? new Error('NativeModule.RNCNetInfo is null') : { default: network },
  }, {
    __DEV__: true, console: { warn: message => warnings.push(message) },
    setTimeout(callback, delay) { assert.equal(delay, 2500); const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  }).useConnectivityNotice;
  assert.equal(hook(), null);
  cleanup = effect();
  return {
    get value() { return value; }, get writes() { return writes; },
    get subscriptions() { return subscriptions; }, get removals() { return removals; },
    get refreshes() { return refreshes; }, timers, warnings, network,
    emit(isConnected, isInternetReachable) { receive({ isConnected, isInternetReachable }); },
    appState(next) { onAppState(next); },
    expire() { for (const [id, callback] of timers) { timers.delete(id); callback(); } },
    stop() { cleanup?.(); },
  };
}

test('startup uncertainty and a healthy initial connection do not flash a banner', () => {
  const app = fixture();
  app.emit(null, null);
  app.emit(true, null);
  app.emit(true, true);
  assert.equal(app.value, null);
  assert.equal(app.timers.size, 0);
  assert.equal(app.subscriptions, 1);
  app.stop();
});

test('disconnected radio and Wi-Fi without internet both show offline', () => {
  for (const state of [[false, null], [true, false]]) {
    const app = fixture();
    app.emit(...state);
    assert.equal(app.value, 'offline');
    app.emit(true, null);
    assert.equal(app.value, 'offline', 'unknown reachability must not announce recovery');
    app.emit(true, true);
    assert.equal(app.value, 'restored');
    app.expire();
    assert.equal(app.value, null);
    app.stop();
  }
});

test('repeated online events do not extend recovery; losing internet cancels its timer', () => {
  const app = fixture();
  app.emit(false, false);
  app.emit(true, true);
  const timer = [...app.timers.keys()][0];
  app.emit(true, true);
  assert.equal([...app.timers.keys()][0], timer);
  app.emit(true, false);
  assert.equal(app.timers.size, 0);
  app.expire();
  assert.equal(app.value, 'offline');
  app.stop();
});

test('background events are ignored and returning to the app requests a fresh check', async () => {
  const app = fixture({ initialAppState: 'background' });
  app.emit(false, false);
  assert.equal(app.value, null);
  app.appState('active');
  assert.equal(app.refreshes, 1);
  app.emit(true, false);
  app.emit(true, true);
  app.appState('background');
  assert.equal(app.value, null);
  assert.equal(app.timers.size, 0);
  app.emit(false, false);
  assert.equal(app.value, null);
  app.network.refresh = async () => { throw new Error('Check failed'); };
  app.appState('active');
  await new Promise(setImmediate);
  assert.equal(app.value, null, 'a failed check must not manufacture an offline result');
  app.stop();
});

test('unmount removes both listeners and timers, and ignores late callbacks', () => {
  const app = fixture();
  app.emit(false, false);
  app.emit(true, true);
  app.stop();
  assert.equal(app.removals, 2);
  assert.equal(app.timers.size, 0);
  const writes = app.writes;
  app.emit(false, false);
  app.expire();
  assert.equal(app.writes, writes);
});

test('an older development APK without NetInfo keeps opening normally', () => {
  const app = fixture({ missingModule: true });
  assert.equal(app.value, null);
  assert.equal(app.subscriptions, 0);
  assert.equal(app.warnings.length, 1);
  app.stop();
});

test('the banner reserves space, preserves its child position, and supports light/dark themes', () => {
  let notice = null, isDark = false;
  const jsx = (type, props) => ({ type, props });
  const Banner = load('components/common/OfflineBanner.tsx', {
    react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/hooks/useConnectivityNotice': { useConnectivityNotice: () => notice },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ isDark, colors: { background: '#FFF' } }) },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: value => value, hairlineWidth: 1 } },
    'react-native-safe-area-context': {
      SafeAreaInsetsContext: { Provider: 'InsetsProvider' },
      useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
    },
  }).default;
  const child = { draft: 'unsent message', route: 'chat' };
  for (isDark of [false, true]) {
    for (notice of [null, 'offline', 'restored', null]) {
      const tree = Banner({ children: child });
      const [banner, provider] = tree.props.children;
      assert.equal(provider.type, 'InsetsProvider');
      assert.equal(provider.props.children.props.children, child);
      assert.equal(provider.props.value.bottom, 16);
      assert.equal(provider.props.value.top, notice ? 0 : 24);
      if (notice) {
        assert.equal(banner.props.accessibilityLiveRegion, 'polite');
        assert.match(banner.props.accessibilityLabel, notice === 'offline' ? /offline/ : /Back online/);
        assert.equal(banner.props.style[1].paddingTop, 34);
        assert.equal(banner.props.style[1].position, undefined, 'must not overlay screen controls');
      }
    }
  }
});

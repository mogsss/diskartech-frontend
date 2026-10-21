// Run with: node --test scripts/test-toast.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, dependencies, globals = {}) {
  const filename = path.join(__dirname, '..', relative);
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename });
  return exports;
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}

function fixture({ os = 'android', recommended = async duration => duration } = {}) {
  const hooks = [], pending = [], timers = new Map(), requests = [];
  const child = { type: 'Navigation' };
  let cursor = 0, nextTimer = 0, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    createContext(value) { const context = { value }; context.Provider = { context }; return context; },
    useContext(context) { return context.value; },
    useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: initial };
      return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useMemo(callback, deps) {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) hooks[index] = { deps, value: callback() };
      return hooks[index].value;
    },
    useCallback(callback, deps) { return this.useMemo(() => callback, deps); },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) {
        const previous = hooks[index];
        hooks[index] = { deps };
        pending.push(() => { previous?.cleanup?.(); hooks[index].cleanup = callback(); });
      }
    },
  };
  // Named hook imports are called without a receiver.
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  const jsx = (type, props) => {
    if (type?.context) type.context.value = props.value;
    return { type, props };
  };
  const exports = load('hooks/useToast.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/components/ui/Toast': 'Toast',
    'react-native': { Platform: { OS: os }, AccessibilityInfo: { getRecommendedTimeoutMillis(duration) { requests.push(duration); return recommended(duration); } } },
  }, {
    setTimeout(callback, duration) { const id = ++nextTimer; timers.set(id, { callback, duration }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  function render() {
    cursor = 0;
    tree = exports.ToastProvider({ children: child });
    pending.splice(0).forEach(effect => effect());
  }
  render();
  return {
    render, timers, requests, child,
    api: () => exports.useToast(),
    toast: () => find(tree, node => node.type === 'Toast')?.props.toast,
    children: () => tree.props.children,
    viewport(active = true, index = 0) {
      cursor = 100 + index * 10;
      const viewport = exports.ToastViewport({ active });
      pending.splice(0).forEach(effect => effect());
      return viewport;
    },
    async settle() { for (let i = 0; i < 5; i++) await Promise.resolve(); },
    expire() { for (const [id, timer] of timers) { timers.delete(id); timer.callback(); } render(); },
    stop() { hooks.forEach(hook => hook?.cleanup?.()); },
  };
}

test('toasts show through a shared hook, preserve navigation and dismiss automatically', async () => {
  const app = fixture();
  assert.equal(app.toast(), undefined);
  app.api().showToast({ type: 'success', message: '  Saved successfully.  ' }); app.render(); await app.settle();
  assert.equal(app.toast().message, 'Saved successfully.');
  assert.equal(app.toast().type, 'success');
  assert.equal([...app.timers.values()][0].duration, 3500);
  assert.equal(app.children()[0], app.child);
  app.expire();
  assert.equal(app.toast(), undefined);
  assert.equal(app.children()[0], app.child);
});

test('an old timeout and close action cannot dismiss a replacement toast', async () => {
  const app = fixture();
  const first = app.api().showToast('First message'); app.render(); await app.settle();
  const oldTimer = [...app.timers.values()][0].callback;
  const second = app.api().showToast({ type: 'error', message: 'Second message' });
  oldTimer(); app.render(); await app.settle();
  assert.equal(app.toast().id, second);
  assert.equal(app.timers.size, 1);
  assert.equal([...app.timers.values()][0].duration, 5000);
  app.api().hideToast(first); app.render();
  assert.equal(app.toast().id, second);
  app.api().hideToast(second); app.render();
  assert.equal(app.toast(), undefined);
  assert.equal(app.timers.size, 0);
});

test('Android accessibility settings can extend the toast timeout', async () => {
  const app = fixture({ recommended: async () => 10000 });
  app.api().showToast('Longer reading time'); app.render(); await app.settle();
  assert.equal(app.requests[0], 3500);
  assert.equal([...app.timers.values()][0].duration, 10000);
});

test('sticky messages have no timer, blank messages are ignored, and durations are bounded', async () => {
  const app = fixture({ os: 'ios' });
  const id = app.api().showToast({ message: 'Still working', duration: 0 }); app.render();
  assert.equal(app.timers.size, 0);
  assert.equal(app.api().showToast('   '), null); app.render();
  assert.equal(app.toast().id, id);
  for (const [duration, expected] of [[-5, 1000], [Infinity, 3500], [5000000000, 60000]]) {
    app.api().showToast({ message: 'Notice', duration }); app.render(); await app.settle();
    assert.equal([...app.timers.values()][0].duration, expected);
  }
  app.api().hideToast(); app.render();
  assert.equal(app.toast(), undefined);
});

test('unmount cancels timeouts and ignores delayed accessibility responses', async () => {
  let resolve;
  const app = fixture({ recommended: () => new Promise(callback => { resolve = callback; }) });
  app.api().showToast('Loading'); app.render();
  app.stop(); resolve(6000); await app.settle();
  assert.equal(app.timers.size, 0);
  const timed = fixture({ os: 'ios' });
  timed.api().showToast('Notice'); timed.render(); await timed.settle();
  assert.equal(timed.timers.size, 1);
  timed.stop();
  assert.equal(timed.timers.size, 0);
});

test('accessibility failures retain the normal timeout and the hook requires its provider', async () => {
  const app = fixture({ recommended: async () => { throw new Error('Unavailable'); } });
  app.api().showToast('Notice'); app.render(); await app.settle();
  assert.equal([...app.timers.values()][0].duration, 3500);
  const { useToast } = load('hooks/useToast.tsx', {
    react: { createContext: () => ({}), useContext: () => undefined },
    'react/jsx-runtime': {}, '@/components/ui/Toast': 'Toast', 'react-native': {},
  });
  assert.throws(() => useToast(), /inside ToastProvider/);
});

test('native modal viewports show one toast above the modal and restore it to the root on close', () => {
  const app = fixture();
  const id = app.api().showToast({ message: 'Hours overlap.', duration: 0 }); app.render();
  assert.equal(app.toast().id, id);
  app.viewport(true); app.render();
  assert.equal(app.toast(), undefined, 'the toast is not duplicated behind the modal');
  assert.equal(app.viewport(true).props.toast.id, id);
  app.viewport(false); app.render();
  assert.equal(app.toast().id, id);
});

test('only the most recently opened modal viewport displays the active toast', () => {
  const app = fixture();
  app.viewport(true, 0); app.render();
  app.viewport(true, 1); app.render();
  const id = app.api().showToast({ message: 'Could not save.', duration: 0 }); app.render();
  assert.equal(app.viewport(true, 0), null);
  assert.equal(app.viewport(true, 1).props.toast.id, id);
  app.viewport(false, 1); app.render();
  assert.equal(app.viewport(true, 0).props.toast.id, id);
  app.viewport(false, 0); app.render();
  assert.equal(app.toast().id, id);
});

function toastViewFixture({ isDark = false, type = 'success', reducedMotion = false } = {}) {
  const dismissals = [], animations = [], finishes = [], cleanups = [];
  const jsx = (kind, props) => ({ type: kind, props });
  const animation = (value, options, kind) => ({ start(callback) {
    animations.push({ kind, ...options }); value.setValue(options.toValue);
    if (callback) finishes.push(callback);
  } });
  const Toast = load('components/ui/Toast.tsx', {
      react: {
        useRef: current => ({ current }), useCallback: callback => callback, useMemo: callback => callback(),
        useEffect(callback) { cleanups.push(callback()); },
      },
      'react/jsx-runtime': { jsx, jsxs: jsx },
      '@expo/vector-icons': { MaterialIcons: 'Icon' },
      '@/hooks/useDarkMode': { useDarkMode: () => ({ isDark, colors: { surface: '#fff', border: '#ccc', text: '#111', textSecondary: '#555' } }) },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, left: 0, right: 0 }) },
      'react-native': {
        View: 'View', Text: 'Text', TouchableOpacity: 'Button',
        AccessibilityInfo: { isReduceMotionEnabled: async () => reducedMotion }, Platform: {}, StyleSheet: { create: value => value },
        Dimensions: { get: () => ({ width: 390 }) }, PanResponder: { create: handlers => ({ panHandlers: handlers }) },
        Animated: {
          View: 'AnimatedView',
          Value: class {
            constructor(value) { this.value = value; }
            interpolate() { return 0; }
            setValue(value) { this.value = value; }
            stopAnimation() {}
          },
          add: (a, b) => ({ a, b }),
          timing: (value, options) => animation(value, options, 'timing'),
          spring: (value, options) => animation(value, options, 'spring'),
          parallel: children => ({ start(callback) { children.forEach(child => child.start()); if (callback) finishes.push(callback); } }),
        },
      },
    }).default;
  const tree = Toast({ toast: { id: 7, type, message: 'Your changes were saved.' }, onDismiss: id => dismissals.push(id) });
  const card = find(tree, node => node.type === 'AnimatedView');
  return {
    tree, card, animations, dismissals,
    complete() { finishes.splice(0).forEach(callback => callback({ finished: true })); },
    stop() { cleanups.forEach(cleanup => cleanup?.()); },
    swipe({ dx = 0, dy = 0, vx = 0, vy = 0 }, terminate = false) {
      const gesture = { dx, dy, vx, vy };
      if (!card.props.onMoveShouldSetPanResponder(null, gesture)) return false;
      // React Native resets accumulated distance when it grants the responder.
      card.props.onPanResponderGrant(null, { dx: 0, dy: 0, vx: 0, vy: 0 });
      card.props.onPanResponderMove(null, gesture);
      if (terminate) card.props.onPanResponderTerminate();
      else card.props.onPanResponderRelease(null, gesture);
      return true;
    },
  };
}

test('light and dark toasts expose readable announcements and a separate dismiss button', () => {
  for (const isDark of [false, true]) for (const type of ['success', 'error', 'warning', 'info']) {
    const app = toastViewFixture({ isDark, type });
    const { tree } = app;
    assert.equal(tree.props.pointerEvents, 'box-none');
    const announcement = find(tree, node => node.props?.accessibilityRole === 'alert');
    assert.match(announcement.props.accessibilityLabel, /Your changes were saved/);
    const button = find(tree, node => node.props?.accessibilityLabel === 'Dismiss notification');
    button.props.onPress();
    assert.equal(app.dismissals.length, 0, 'the close animation finishes before dismissal');
    app.complete();
    assert.deepEqual(app.dismissals, [7]);
  }
});

test('swiping left, right or up slides the toast away and dismisses it exactly once', () => {
  for (const gesture of [{ dx: -100 }, { dx: 100 }, { dy: -70 }]) {
    const app = toastViewFixture();
    assert.equal(app.swipe(gesture), true);
    assert.equal(app.dismissals.length, 0);
    find(app.tree, node => node.props?.accessibilityLabel === 'Dismiss notification').props.onPress();
    app.complete();
    assert.deepEqual(app.dismissals, [7]);
    assert.ok(app.animations.some(animation => Math.abs(animation.toValue) >= 100));
  }
});

test('short drags, reverse flicks and interrupted gestures return without dismissing', () => {
  for (const [gesture, terminate] of [[{ dx: 25 }, false], [{ dy: -20 }, false], [{ dx: 20, vx: -2 }, false], [{ dx: 100 }, true]]) {
    const app = toastViewFixture();
    app.swipe(gesture, terminate); app.complete();
    assert.deepEqual(app.dismissals, []);
    assert.equal(app.animations.filter(animation => animation.kind === 'spring' && animation.toValue === 0).length, 2);
  }
  const app = toastViewFixture();
  assert.equal(app.swipe({ dy: 100 }), false, 'a downward drag is not intercepted');
  assert.equal(app.swipe({ dx: 2, dy: 2 }), false, 'a tap does not begin a swipe');
});

test('deliberate quick flicks can dismiss without a long drag', () => {
  for (const gesture of [{ dx: 20, vx: 1 }, { dy: -20, vy: -1 }]) {
    const app = toastViewFixture();
    app.swipe(gesture); app.complete();
    assert.deepEqual(app.dismissals, [7]);
  }
});

test('unmount during dismissal ignores the late animation completion', () => {
  const app = toastViewFixture();
  app.swipe({ dx: 100 }); app.stop(); app.complete();
  assert.deepEqual(app.dismissals, []);
});

test('reduce motion settings skip the dismissal transition', async () => {
  const app = toastViewFixture({ reducedMotion: true });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  app.swipe({ dx: 100 });
  assert.ok(app.animations.every(animation => animation.duration === 0));
  app.complete();
  assert.deepEqual(app.dismissals, [7]);
});

/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function harness() {
  const listeners = new Map(); const frames = new Map(); const scrolls = [];
  let nextFrame = 0; let effect; let keyboardY;
  const geometry = { viewportY: 32, viewportHeight: 500, inputY: 510, inputHeight: 52 };
  const dependencies = {
    react: { useRef: initial => ({ current: initial }), useCallback: callback => callback, useEffect: callback => { effect = callback; } },
    'react-native': { Keyboard: {
      metrics: () => keyboardY === undefined ? undefined : { screenY: keyboardY },
      dismiss() {},
      addListener: (name, callback) => { listeners.set(name, callback); return { remove: () => listeners.delete(name) }; },
    } },
    testScheduler: {
      request: callback => { frames.set(++nextFrame, callback); return nextFrame; },
      cancel: id => frames.delete(id),
    },
  };
  const filename = path.join(__dirname, '../hooks/useRegistrationKeyboard.ts');
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, name); return dependencies[name]; };
  loaded._compile('const requestAnimationFrame = require("testScheduler").request; const cancelAnimationFrame = require("testScheduler").cancel;\n' + ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  const hook = loaded.exports.useRegistrationKeyboard();
  const cleanup = effect();
  hook.formScrollRef.current = {
    getNativeScrollRef: () => ({ measureInWindow: callback => callback(0, geometry.viewportY, 400, geometry.viewportHeight) }),
    scrollTo: options => scrolls.push(options),
  };
  hook.inputNavigation('first').inputRef({ measureInWindow: callback => callback(0, geometry.inputY, 200, geometry.inputHeight) });
  return {
    hook, geometry, scrolls, frames, listeners, cleanup,
    focus() { hook.inputNavigation('first').onFocus(); },
    showKeyboard(y) { keyboardY = y; listeners.get('keyboardDidShow')({ endCoordinates: { screenY: y } }); },
    hideKeyboard() { keyboardY = undefined; listeners.get('keyboardDidHide')(); },
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    scrollOffset(y) { hook.formScrollProps.onScroll({ nativeEvent: { contentOffset: { y } } }); },
  };
}

test('scroll compensates for the viewport origin below the status bar and keeps a gap below the field', () => {
  const app = harness(); app.scrollOffset(100); app.focus();
  assert.deepEqual(app.scrolls, [{ y: 154, animated: true }]);
});

test('keyboard opening and a later viewport resize each remeasure the focused input', () => {
  const app = harness(); app.geometry.viewportHeight = 800; app.focus();
  assert.equal(app.scrolls.length, 0);
  app.showKeyboard(480); assert.equal(app.scrolls.length, 0);
  app.flush(); assert.deepEqual(app.scrolls.pop(), { y: 106, animated: true });
  app.scrollOffset(106); app.geometry.inputY = 404; app.geometry.viewportHeight = 400;
  app.hook.formScrollProps.onLayout(); app.flush();
  assert.deepEqual(app.scrolls.pop(), { y: 154, animated: true });
});

test('switching to a later input works while the keyboard is already open', () => {
  const app = harness(); app.geometry.inputY = 100; app.showKeyboard(480); app.flush();
  app.hook.inputNavigation('second').inputRef({ measureInWindow: callback => callback(0, 470, 200, 52) });
  app.hook.inputNavigation('second').onFocus();
  assert.deepEqual(app.scrolls, [{ y: 66, animated: true }]);
});

test('visible fields are not scrolled and hiding the keyboard removes its old boundary', () => {
  const app = harness(); app.geometry.inputY = 100; app.showKeyboard(480); app.focus(); app.flush();
  assert.equal(app.scrolls.length, 0);
  app.hideKeyboard(); app.geometry.inputY = 510; app.geometry.viewportHeight = 800;
  app.hook.formScrollProps.onLayout(); app.flush();
  assert.equal(app.scrolls.length, 0);
});

test('validation messages shifting the form trigger a new visibility check', () => {
  const app = harness(); app.geometry.inputY = 100; app.focus();
  app.geometry.inputY = 520; app.hook.formScrollProps.onContentSizeChange(); app.flush();
  assert.deepEqual(app.scrolls, [{ y: 64, animated: true }]);
});

test('repeated layout events coalesce and changing steps or unmounting cancels queued work', () => {
  const app = harness(); app.geometry.inputY = 100; app.focus();
  app.showKeyboard(480); app.hook.formScrollProps.onLayout(); app.hook.formScrollProps.onContentSizeChange();
  assert.equal(app.frames.size, 1);
  app.hook.resetKeyboard(); assert.equal(app.frames.size, 0);
  app.flush(); assert.equal(app.scrolls.length, 0);
  app.hook.formScrollProps.onLayout(); app.cleanup();
  assert.equal(app.frames.size, 0); assert.equal(app.listeners.size, 0);
});

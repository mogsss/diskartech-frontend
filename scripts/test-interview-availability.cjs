// Run with: node scripts/test-interview-availability.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, dependencies = {}, globals = {}) {
  const filename = path.join(__dirname, '..', relativePath);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, ...globals }, { filename });
  return exports;
}

const utils = load('utils/interviewCall.ts');
const settle = () => new Promise(setImmediate);

function mount(responses) {
  const state = [];
  const timers = new Map();
  let nextTimer = 0;
  let requestCount = 0;
  let onFocus;
  let cleanup;
  let onAppState;
  const hook = load('hooks/useInterviewCallAvailability.ts', {
    '@/api/axios': { default: { get: async () => {
      const next = responses[Math.min(requestCount++, responses.length - 1)];
      if (next instanceof Error) throw next;
      return { data: { interview_call: next } };
    } } },
    '@/utils/interviewCall': utils,
    axios: { isAxiosError: (error) => error.isAxiosError === true },
    react: {
      useState: (value) => { const index = state.length; state.push(value); return [value, (next) => { state[index] = next; }]; },
      useCallback: (callback) => callback,
    },
    'expo-router': { useFocusEffect: (callback) => { onFocus = callback; cleanup = callback(); } },
    'react-native': { AppState: { currentState: 'active', addEventListener: (_event, callback) => {
      onAppState = callback;
      return { remove: () => { onAppState = null; } };
    } } },
  }, {
    AbortController,
    setInterval: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearInterval: (id) => timers.delete(id),
  });
  hook.useInterviewCallAvailability('65', true);
  return {
    state, timers, count: () => requestCount,
    foreground: () => onAppState?.('active'),
    reopen: () => { cleanup(); cleanup = onFocus(); },
    cleanup: () => cleanup(),
  };
}

function apiError(status) {
  return Object.assign(new Error('API error'), { isAxiosError: true, response: { status } });
}

for (const status of [401, 403, 404, 410]) {
  test(`${status} stops requests/timers and keeps Join disabled until reopening`, async () => {
    const screen = mount([apiError(status)]);
    const tick = [...screen.timers.values()].find((timer) => timer.delay === 5000).callback;
    await settle();
    assert.equal(screen.count(), 1);
    assert.equal(screen.timers.size, 0);
    assert.equal(screen.state[0], null);
    assert.equal(screen.state[2], utils.interviewAvailabilityFailure(status).message);
    for (let i = 0; i < 30; i++) { tick(); screen.foreground(); }
    await settle();
    assert.equal(screen.count(), 1, 'No repeated requests after a permanent error');
    screen.reopen();
    await settle();
    assert.equal(screen.count(), 2, 'Opening the screen again retries after deployment/access changes');
    screen.cleanup();
  });
}

for (const status of [undefined, 429, 503]) {
  test(`${status || 'network failure'} can recover on a later poll`, async () => {
    const available = { active: true, starts_at: '2026-10-11T17:30:00+08:00', ended_at: null, server_now: '2026-10-11T09:30:00Z', can_join: true };
    const screen = mount([apiError(status), available]);
    await settle();
    assert.equal(screen.timers.size, 2);
    assert.equal(screen.state[0], null);
    [...screen.timers.values()].find((timer) => timer.delay === 5000).callback();
    await settle();
    assert.equal(screen.count(), 2);
    assert.equal(screen.state[0], available);
    assert.equal(screen.state[2], null);
    screen.cleanup();
    assert.equal(screen.timers.size, 0);
  });
}

test('schedule gate stays disabled before the Philippine start and after ending', () => {
  const call = { active: true, starts_at: '2026-10-11T17:30:00+08:00', ended_at: null };
  const start = Date.parse('2026-10-11T09:30:00Z');
  assert.equal(utils.canJoinInterview(call, start - 1), false);
  assert.equal(utils.canJoinInterview(call, start), true);
  assert.equal(utils.canJoinInterview({ ...call, ended_at: '2026-10-11T10:00:00Z' }, start + 3600000), false);
  assert.equal(utils.canJoinInterview({ ...call, active: false }, start), false);
});

test('editing closes exactly at the scheduled start for online and walk-in interviews', () => {
  const start = Date.parse('2026-10-11T09:30:00Z');
  for (const active of [true, false]) {
    const call = { active, starts_at: '2026-10-11T17:30:00+08:00', ended_at: null };
    assert.equal(utils.canEditInterview(call, start - 1), true);
    assert.equal(utils.canEditInterview(call, start), false);
    assert.equal(utils.canEditInterview(call, start + 3600000), false);
    assert.equal(utils.canEditInterview({ ...call, ended_at: '2026-10-11T10:00:00Z' }, start + 3600000), false);
  }
  assert.equal(utils.canEditInterview(null, start), false, 'Hide editing until availability is checked');
  assert.equal(utils.canEditInterview({ starts_at: null, ended_at: null }, start), true, 'Allow fixing an incomplete schedule');
  assert.equal(utils.canEditInterview({ starts_at: 'invalid', ended_at: null }, start), false);
});

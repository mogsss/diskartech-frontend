// Run with: node scripts/test-notification-preferences.cjs
/* global __dirname */
// Exercises the real notification utility with device/network/storage adapters mocked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../utils/notifications.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;

function fixture(options = {}) {
  const storage = new Map();
  const records = new Map();
  const calls = { prompts: 0, tokens: 0, writes: 0, cancelled: 0, scheduled: 0, pushes: 0, appRecords: 0 };
  const state = { permission: { status: 'granted', granted: true }, token: 'ExponentPushToken[fake-device]', executionEnvironment: 'standalone', failWrites: false, failToken: false, ticket: { status: 'ok' }, platform: 'android', ...options };
  let foregroundHandler;
  const Notifications = {
    IosAuthorizationStatus: { PROVISIONAL: 3 }, AndroidImportance: { MAX: 5 },
    setNotificationHandler: handler => { foregroundHandler = handler; },
    addNotificationReceivedListener: () => ({ remove() {} }),
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => state.permission,
    requestPermissionsAsync: async () => { calls.prompts++; return state.permission; },
    getExpoPushTokenAsync: async () => { calls.tokens++; if (state.tokenGate) await state.tokenGate; if (state.failToken) throw Error('Offline'); return { data: state.token }; },
    cancelAllScheduledNotificationsAsync: async () => { calls.cancelled++; },
    scheduleNotificationAsync: async () => { calls.scheduled++; },
  };
  const firestore = {
    doc: (_db, collection, id) => ({ collection, id }),
    collection: (_db, name) => name,
    setDoc: async (ref, data) => { if (state.failWrites) throw Error('Write denied'); calls.writes++; records.set(ref.id, { ...records.get(ref.id), ...data }); },
    deleteDoc: async ref => { records.delete(ref.id); },
    getDoc: async ref => ({ exists: () => records.has(ref.id), data: () => records.get(ref.id) }),
    getDocs: async () => ({ docs: [] }),
    addDoc: async () => { calls.appRecords++; },
    query: (...args) => args, where: (...args) => args,
    onSnapshot: () => () => {}, serverTimestamp: () => 'test-time',
  };
  const mocks = {
    'expo-notifications': Notifications,
    'expo-constants': { get executionEnvironment() { return state.executionEnvironment; }, expoConfig: { extra: { eas: { projectId: 'test-project' } } } },
    'react-native': { Platform: { get OS() { return state.platform; } } },
    '@react-native-async-storage/async-storage': { getItem: async key => storage.get(key) ?? null, setItem: async (key, val) => { storage.set(key, val); }, removeItem: async key => { storage.delete(key); } },
    '@/api/axios': { post: async () => ({ status: 200 }) }, './firebase': { db: {} }, 'firebase/firestore': firestore,
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, require: name => { if (!(name in mocks)) throw Error('Unmocked dependency: ' + name); return mocks[name]; },
    console: { warn() {}, error() {}, log() {} },
    fetch: async () => { calls.pushes++; return { ok: state.httpOk !== false, json: async () => ({ data: state.ticket }) }; },
    Date, Map, Promise,
  });
  return { api: module.exports, storage, records, calls, state, handler: () => foregroundHandler };
}

const notification = { request: { content: { data: { chatId: 'chat-a' } } } };

test('OFF suppresses foreground banners, sounds, badges, local alerts, and registration', async () => {
  const f = fixture(); f.storage.set('notifications_enabled', 'false');
  const behavior = await f.handler().handleNotification(notification);
  assert.ok(Object.values(behavior).every(value => value === false));
  await f.api.sendLocalNotification({ title: 'Message', body: 'Hello' });
  assert.equal(await f.api.registerAndSyncPushToken('7'), 'disabled');
  assert.equal(await f.api.registerForPushNotificationsAsync(), null);
  assert.equal(f.calls.scheduled + f.calls.tokens + f.calls.prompts + f.calls.writes, 0);
});

test('turning OFF removes remote routing without deleting in-app notifications', async () => {
  const f = fixture(); f.records.set('7', { push_token: f.state.token });
  assert.equal(await f.api.setPushNotificationsEnabled('7', false), 'disabled');
  assert.equal(f.storage.get('notifications_enabled'), 'false');
  assert.equal(f.records.get('7').push_token, null);
  assert.equal(f.records.get('7').notifications_enabled, false);
  assert.equal(await f.api.getRecipientPushToken('7'), null);
  assert.equal(f.calls.cancelled, 1);
  await f.api.sendAppNotification({ recipientId: '7', title: 'Application', body: 'Viewed', type: 'application_status' });
  assert.equal(f.calls.appRecords, 1); assert.equal(f.calls.pushes, 0);
  assert.equal(await f.api.registerAndSyncPushToken('7'), 'disabled');
  assert.equal(f.calls.tokens, 0);
});

test('turning ON registers an actual token and enables both routing and device preference', async () => {
  const f = fixture(); f.storage.set('notifications_enabled', 'false');
  assert.equal(await f.api.setPushNotificationsEnabled('7', true), 'enabled');
  assert.equal(f.storage.get('notifications_enabled'), 'true');
  assert.equal(f.records.get('7').notifications_enabled, true);
  assert.equal(await f.api.getRecipientPushToken('7'), f.state.token);
  assert.equal((await f.api.getPushNotificationSettings()).enabled, true);
});

test('denied permission keeps the toggle OFF and does not write a remote token', async () => {
  const f = fixture({ permission: { status: 'denied', granted: false } }); f.storage.set('notifications_enabled', 'false');
  assert.equal(await f.api.setPushNotificationsEnabled('7', true), 'permission-denied');
  assert.equal(f.calls.prompts, 1); assert.equal(f.calls.tokens + f.calls.writes, 0);
  assert.equal(f.storage.get('notifications_enabled'), 'false');
});

test('Android Expo Go never reports remote push enabled', async () => {
  const f = fixture({ executionEnvironment: 'storeClient' }); f.storage.set('notifications_enabled', 'false');
  assert.equal(await f.api.setPushNotificationsEnabled('7', true), 'unavailable');
  assert.equal((await f.api.getPushNotificationSettings()).enabled, false);
  assert.equal(f.calls.tokens + f.calls.prompts + f.calls.writes, 0);
});

test('token fetch failure does not turn a local-permission fallback into remote success', async () => {
  const f = fixture({ failToken: true }); f.storage.set('notifications_enabled', 'false');
  assert.equal(await f.api.setPushNotificationsEnabled('7', true), 'unavailable');
  assert.equal(f.storage.get('notifications_enabled'), 'false'); assert.equal(f.calls.writes, 0);
});

test('failed ON sync restores the prior device preference', async () => {
  const f = fixture({ failWrites: true }); f.storage.set('notifications_enabled', 'false');
  assert.equal(await f.api.setPushNotificationsEnabled('7', true), 'sync-failed');
  assert.equal(f.storage.get('notifications_enabled'), 'false');
});

test('failed OFF sync does not falsely report that background push was stopped', async () => {
  const f = fixture({ failWrites: true }); f.storage.set('notifications_enabled', 'true'); f.records.set('7', { push_token: f.state.token });
  assert.equal(await f.api.setPushNotificationsEnabled('7', false), 'sync-failed');
  assert.equal(f.storage.get('notifications_enabled'), 'true');
  assert.equal(await f.api.getRecipientPushToken('7'), f.state.token);
});

test('registration in progress cannot overwrite a subsequent OFF setting', async () => {
  let release;
  const f = fixture({ tokenGate: new Promise(resolve => { release = resolve; }) });
  const registering = f.api.registerAndSyncPushToken('7');
  const disabling = f.api.setPushNotificationsEnabled('7', false);
  release();
  assert.equal(await registering, 'enabled'); assert.equal(await disabling, 'disabled');
  assert.equal(await f.api.registerAndSyncPushToken('7'), 'disabled');
  assert.equal(f.records.get('7').push_token, null); assert.equal(f.storage.get('notifications_enabled'), 'false');
});

test('logout waits for registration and then removes the token', async () => {
  let release;
  const f = fixture({ tokenGate: new Promise(resolve => { release = resolve; }) });
  const registering = f.api.registerAndSyncPushToken('7'); const clearing = f.api.clearPushToken('7');
  release(); await registering; await clearing;
  assert.equal(f.records.has('7'), false); assert.equal(f.storage.has('expo_push_token'), false);
});

test('explicitly disabled recipients are skipped even if a stale token exists', async () => {
  const f = fixture(); f.records.set('7', { notifications_enabled: false, push_token: f.state.token });
  assert.equal(await f.api.getRecipientPushToken('7'), null);
});

test('both Expo token formats work; local and malformed tokens are rejected', async () => {
  for (const token of ['ExponentPushToken[fake-device]', 'ExpoPushToken[fake-device]']) {
    const f = fixture({ token }); assert.equal(await f.api.registerAndSyncPushToken('7'), 'enabled');
    assert.equal(await f.api.sendRemotePushNotification({ toToken: token, title: 'Update', body: 'Hello' }), true);
  }
  for (const token of ['local_granted', 'ExponentPushToken', 'invalid']) {
    const f = fixture(); assert.equal(await f.api.sendRemotePushNotification({ toToken: token, title: 'Update', body: 'Hello' }), false);
    assert.equal(f.calls.pushes, 0);
  }
});

test('an HTTP 200 with an Expo error ticket is a failure, not a successful send', async () => {
  const f = fixture({ ticket: { status: 'error', details: { error: 'DeviceNotRegistered' } } });
  assert.equal(await f.api.sendRemotePushNotification({ toToken: f.state.token, title: 'Update', body: 'Hello' }), false);
  f.state.ticket = [{ status: 'ok', id: 'ticket-id' }];
  assert.equal(await f.api.sendRemotePushNotification({ toToken: f.state.token, title: 'Update', body: 'Hello' }), true);
  f.state.httpOk = false;
  assert.equal(await f.api.sendRemotePushNotification({ toToken: f.state.token, title: 'Update', body: 'Hello' }), false);
});

test('active chat suppression stays intact and other chats can display alerts', async () => {
  const f = fixture(); f.api.setActiveChatScreen('chat-a');
  assert.equal((await f.handler().handleNotification(notification)).shouldShowBanner, false);
  f.api.setActiveChatScreen('chat-b');
  assert.equal((await f.handler().handleNotification(notification)).shouldShowBanner, true);
});

test('returning from phone settings reflects permissions without prompting', async () => {
  const f = fixture({ permission: { status: 'denied', granted: false } });
  assert.equal((await f.api.getPushNotificationSettings()).enabled, false);
  f.state.permission = { status: 'granted', granted: true };
  assert.equal((await f.api.getPushNotificationSettings()).enabled, true); assert.equal(f.calls.prompts, 0);
});

test('iOS provisional permission is usable without another permission prompt', async () => {
  const f = fixture({ platform: 'ios', permission: { status: 'undetermined', granted: false, ios: { status: 3 } } });
  assert.equal(await f.api.registerAndSyncPushToken('7'), 'enabled'); assert.equal(f.calls.prompts, 0);
});

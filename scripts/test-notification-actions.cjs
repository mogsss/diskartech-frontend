// Run with: node --test scripts/test-notification-actions.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

function storageFixture() {
  const data = new Map();
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
  const preferences = load('utils/notificationPreferences.ts', { '@react-native-async-storage/async-storage': storage });
  return { data, storage, ...preferences };
}

test('read and delete actions survive reload, remain account-specific, and preserve earlier history', async () => {
  const app = storageFixture();
  const first = { id: 'app_1', timestampMs: 100, read: false };
  const second = { id: 'firestore_2', timestampMs: 200, read: false };
  await app.saveNotificationAction('student', 'read', [first]);
  await app.saveNotificationAction('student', 'read', [second]);
  await app.saveNotificationAction('student', 'deleted', [first]);
  const reloaded = load('utils/notificationPreferences.ts', { '@react-native-async-storage/async-storage': app.storage });
  const saved = await reloaded.readNotificationPreferences('student');
  assert.deepEqual(saved.read, { app_1: 100, firestore_2: 200 });
  assert.deepEqual(reloaded.applyNotificationPreferences([first, second], saved), [{ ...second, read: true }]);
  assert.deepEqual(reloaded.applyNotificationPreferences([first, second], await reloaded.readNotificationPreferences('household')), [first, second]);
});

test('a later message or application update reappears unread, even after deleting the older version', async () => {
  const app = storageFixture();
  const older = { id: 'chat_1', timestampMs: 100, read: false };
  await app.saveNotificationAction('1', 'deleted', [older]);
  await app.saveNotificationAction('1', 'read', [older]);
  const newer = { ...older, timestampMs: 200 };
  assert.deepEqual(app.applyNotificationPreferences([newer], await app.readNotificationPreferences('1')), [newer]);
  assert.equal(app.applyNotificationPreferences([older], await app.readNotificationPreferences('1')).length, 0);
});

test('merged alerts delete every displayed source without deleting a new alert arriving during confirmation', async () => {
  const app = storageFixture();
  const feed = load('utils/notificationFeed.ts');
  const api = { id: 'app_27', type: 'application_status', title: 'Interview Invitation', targetId: 27, timestampMs: 100, read: false };
  const live = { ...api, id: 'firestore_1', firestoreDocId: '1', timestampMs: 200 };
  const selected = feed.mergeNotificationSources([api], [live]);
  const targets = app.getNotificationActionSources(selected, [api, live]);
  assert.equal(targets.length, 2);
  await app.saveNotificationAction('1', 'deleted', targets);
  const saved = await app.readNotificationPreferences('1');
  assert.equal(feed.mergeNotificationSources(app.applyNotificationPreferences([api], saved), app.applyNotificationPreferences([live], saved)).length, 0);
  const rescheduled = { ...api, timestampMs: 300 };
  assert.equal(app.applyNotificationPreferences([rescheduled], saved).length, 1);
});

test('concurrent writes merge safely and a failed write neither hides cards nor poisons later retries', async () => {
  const app = storageFixture();
  const events = [];
  const stop = app.subscribeNotificationPreferences('1', state => events.push(state));
  const first = { id: 'first', timestampMs: 100 };
  const second = { id: 'second', timestampMs: 200 };
  await Promise.all([app.saveNotificationAction('1', 'read', [first]), app.saveNotificationAction('1', 'deleted', [second])]);
  assert.equal((await app.readNotificationPreferences('1')).read.first, 100);
  assert.equal((await app.readNotificationPreferences('1')).deleted.second, 200);
  const setItem = app.storage.setItem;
  app.storage.setItem = async () => { throw new Error('Storage full'); };
  await assert.rejects(app.saveNotificationAction('1', 'deleted', [first]), /Storage full/);
  assert.equal(events.length, 2);
  assert.equal((await app.readNotificationPreferences('1')).deleted.first, undefined);
  app.storage.setItem = setItem;
  await app.saveNotificationAction('1', 'deleted', [first]);
  assert.equal(events.length, 3);
  stop();
});

function cloudFixture(role = 'student') {
  const records = new Map([
    ['app_notifications/invite', { recipient_id: '1', type: role === 'student' ? 'application_status' : 'application', title: role === 'student' ? 'Interview Invitation' : 'New Applicant', target_id: 27, created_at: 100, read: false }],
    ['chats/conversation', { sender_id: '2', receiver_id: '1', last_sender_id: '2', last_message: 'Hello', last_message_at: 200 }],
  ]);
  const listeners = new Map(), writes = [], failures = new Set(), listenErrors = new Map();
  let failDeletes = false, beforeCommit;
  const snapshot = prefix => ({ docs: [...records].filter(([key]) => key.startsWith(`${prefix}/`) && !key.slice(prefix.length + 1).includes('/'))
    .map(([key, data]) => ({ id: key.slice(prefix.length + 1), data: () => data })) });
  const emit = prefix => listeners.get(prefix)?.forEach(listener => listener(snapshot(prefix)));
  const firestore = {
    collection: (_, ...segments) => segments.join('/'),
    doc: (base, ...segments) => [typeof base === 'string' ? base : '', ...segments].filter(Boolean).join('/'),
    query: (source, ...filters) => ({ source, filters }), where: (field, operator, value) => ({ field, value }), orderBy() {}, limit() {}, setDoc: async () => {}, getDocs: async () => ({ docs: [] }),
    onSnapshot(ref, callback, onError) {
      const source = typeof ref === 'string' ? ref : ref.source;
      const filtered = value => callback({ docs: value.docs.filter(entry => (ref.filters || []).every(filter => entry.data()[filter.field] === filter.value)) });
      if (!listeners.has(source)) listeners.set(source, new Set());
      if (listenErrors.has(source)) { onError?.(listenErrors.get(source)); return () => {}; }
      listeners.get(source).add(filtered); filtered(snapshot(source));
      return () => listeners.get(source).delete(filtered);
    },
    async runTransaction(_, callback) {
      let staged;
      const run = async () => {
        staged = [];
        await callback({
          get: async ref => {
            assert.equal(staged.length, 0, 'all reads precede writes');
            if (failDeletes || failures.has(ref)) throw new Error('Permission denied or offline');
            return { exists: () => records.has(ref), data: () => records.get(ref) };
          },
          set: (ref, value) => staged.push({ ref, value }), delete: ref => staged.push({ ref, deleted: true }),
        });
      };
      await run();
      if (beforeCommit) { const retry = beforeCommit; beforeCommit = undefined; retry(); await run(); }
      staged.forEach(write => { writes.push(write); if (write.deleted) records.delete(write.ref); else records.set(write.ref, write.value); });
      new Set(staged.map(write => write.ref.slice(0, write.ref.lastIndexOf('/')))).forEach(emit);
    },
  };
  const actions = load('utils/notificationActions.ts', {
    '@/utils/firebase': { db: {} }, './notificationPreferences': storageFixture(), 'firebase/firestore': firestore,
  });
  return { records, writes, failures, listenErrors, firestore, actions, emit,
    failDeletes: value => { failDeletes = value; }, retryBeforeCommit: callback => { beforeCommit = callback; } };
}

test('Firestore deletion removes the alert and atomically saves every merged-source dismissal', async () => {
  const cloud = cloudFixture();
  const result = await cloud.actions.deleteNotificationSources('1', [
    { id: 'app_27', timestampMs: 100 }, { id: 'firestore_invite', firestoreDocId: 'invite', timestampMs: 100 },
    { id: 'chat_conversation', timestampMs: 200 },
  ]);
  assert.equal(result.failedIds.length, 0);
  assert.equal(cloud.records.has('app_notifications/invite'), false);
  assert.equal(cloud.records.get('app_notifications/dismissal:1:app_27').through, 100);
  assert.equal(cloud.records.get('app_notifications/dismissal:1:chat_conversation').through, 200);
  assert.equal(cloud.records.has('chats/conversation'), true, 'dismissing a chat alert never clears the conversation');
  assert.ok(cloud.writes.every(write => write.ref.startsWith('app_notifications/dismissal:1:') || write.ref === 'app_notifications/invite'));
});

test('a retried transaction preserves a newer alert and never moves a dismissal cutoff backwards', async () => {
  const cloud = cloudFixture();
  cloud.retryBeforeCommit(() => {
    cloud.records.set('app_notifications/invite', { recipient_id: '1', created_at: 300 });
    cloud.records.set('app_notifications/dismissal:1:firestore_invite', { type: 'notification_dismissal', recipient_id: '1', source_id: 'firestore_invite', through: 250 });
  });
  const result = await cloud.actions.deleteNotificationSources('1', [{ id: 'firestore_invite', firestoreDocId: 'invite', timestampMs: 100 }]);
  assert.equal(result.failedIds.length, 0);
  assert.equal(cloud.records.get('app_notifications/invite').created_at, 300);
  assert.equal(cloud.records.get('app_notifications/dismissal:1:firestore_invite').through, 250);
});

test('live-only application deletion dismisses the later API fallback without mistaking a legacy job ID for an application', async () => {
  const cloud = cloudFixture();
  await cloud.actions.deleteNotificationSources('1', [{ id: 'firestore_invite', firestoreDocId: 'invite', type: 'application_status', targetId: 27, timestampMs: 100 }]);
  assert.equal(cloud.records.get('app_notifications/dismissal:1:app_27').through, 100);
  cloud.records.set('app_notifications/legacy', { recipient_id: '1', created_at: 100 });
  await cloud.actions.deleteNotificationSources('1', [{ id: 'firestore_legacy', firestoreDocId: 'legacy', type: 'application', targetId: 99, timestampMs: 100 }]);
  assert.equal(cloud.records.has('app_notifications/dismissal:1:app_99'), false);
});

test('wrong-recipient and offline deletes roll back the entire chunk without hiding API summaries', async () => {
  const cloud = cloudFixture();
  const targets = [{ id: 'app_27', timestampMs: 100 }, { id: 'firestore_invite', firestoreDocId: 'invite', timestampMs: 100 }];
  const outsider = await cloud.actions.deleteNotificationSources('2', targets);
  assert.equal(outsider.failedIds.length, 2);
  assert.equal(cloud.writes.length, 0);
  cloud.failDeletes(true);
  assert.equal((await cloud.actions.deleteNotificationSources('1', targets)).failedIds.length, 2);
  assert.equal(cloud.writes.length, 0);
  cloud.failDeletes(false);
  assert.equal((await cloud.actions.deleteNotificationSources('1', targets)).deletedIds.length, 2);
  assert.equal((await cloud.actions.deleteNotificationSources('1', targets)).failedIds.length, 0, 'retrying an already deleted alert succeeds');
});

test('Select all bounds transaction size, deduplicates sources, and validates paths before writing', async () => {
  const cloud = cloudFixture();
  const targets = Array.from({ length: 250 }, (_, index) => ({ id: `app_${index}`, timestampMs: 100 }));
  const result = await cloud.actions.deleteNotificationSources('1', [...targets, targets[0]]);
  assert.equal(result.deletedIds.length, 250); assert.equal(cloud.writes.length, 250);
  await assert.rejects(cloud.actions.deleteNotificationSources('bad/user', targets));
  await assert.rejects(cloud.actions.deleteNotificationSources('1', [{ id: 'firestore_bad', firestoreDocId: '../bad' }]));
  assert.equal(cloud.writes.length, 250);
});

test('large bulk deletion reports partial failures and only retries the remaining sources', async () => {
  const cloud = cloudFixture();
  const targets = Array.from({ length: 250 }, (_, index) => ({ id: `app_${index}`, timestampMs: 100 }));
  cloud.failures.add('app_notifications/dismissal:1:app_120');
  const result = await cloud.actions.deleteNotificationSources('1', targets);
  assert.equal(result.deletedIds.length, 150); assert.equal(result.failedIds.length, 100);
  assert.equal(cloud.records.has('app_notifications/dismissal:1:app_120'), false);
  assert.equal(cloud.records.has('app_notifications/dismissal:1:app_100'), false, 'the failed chunk rolls back atomically');
  cloud.failures.clear();
  assert.equal((await cloud.actions.deleteNotificationSources('1', targets.filter(item => result.failedIds.includes(item.id)))).deletedIds.length, 100);
});

test('dismissals are scoped to the recipient account', async () => {
  const cloud = cloudFixture();
  await cloud.actions.deleteNotificationSources('1', [{ id: 'app_27', timestampMs: 100 }]);
  const received = [];
  const stop = cloud.actions.subscribeNotificationDismissals('2', value => received.push(value), error => { throw error; });
  assert.deepEqual(received, [{}]);
  stop();
});

function screenFixture({ badge = false, role = 'student', cloud = cloudFixture(role) } = {}) {
  const storage = storageFixture();
  storage.data.set('userData', JSON.stringify({ id: 1, role }));
  const slots = [], effects = [], toasts = [], routes = [], chatReads = [];
  let cursor = 0, tree, failWrites = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, value: callback() };
      return slots[index].value;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) {
        const previous = slots[index]; slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
      }
    },
  };
  react.useCallback = (callback, deps) => react.useMemo(() => callback, deps);
  const jsx = (type, props) => ({ type, props });
  const showToast = toast => toasts.push(toast);
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', FlatList: 'FlatList', ScrollView: 'ScrollView', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner', BackHandler: { addEventListener: () => ({ remove() {} }) } },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    '@react-native-async-storage/async-storage': storage.storage,
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: { text: '#111', textSecondary: '#666', border: '#ccc', accent: '#c00', background: '#fff', surface: '#fff' } }) },
    '@/hooks/useToast': { useToast: () => ({ showToast }) },
    '@/utils/notificationPreferences': storage,
    '@/utils/notificationActions': cloud.actions,
    '@/utils/notificationFeed': load('utils/notificationFeed.ts'),
    '@/utils/notifications': { APP_NOTIFICATIONS_COLLECTION: 'app_notifications', CHATS_COLLECTION: 'chats' },
    '@/utils/firebase': { db: {} },
    '@/utils/chat': { CHATS_COLLECTION: 'chats', getOtherParticipant: () => ({ name: 'Employer' }), isChatUnreadForUser: () => true, normalizeChatFields: raw => raw, markChatAsRead: async (...args) => chatReads.push(args) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    'expo-router': { router: { back: () => routes.push('back'), push: route => routes.push(route) }, useFocusEffect: callback => react.useEffect(callback, [callback]) },
    '@/api/axios': { get: async url => ({ data: url === '/student/applications'
      ? { applications: [{ id: 27, status: 'interview', updated_at: 100, job: { title: 'Tutor' } }] }
      : url === '/employer/applicants' ? { status: 'success', applicants: [{ id: 27, status: 'pending', created_at: 100, student: { student_name: 'Juan' }, job: { title: 'Tutor' } }] }
      : { profile: { isVerified: true, updated_at: 50 } } }) },
    'firebase/firestore': cloud.firestore,
  };
  for (const name of ['NotificationCard', 'SafeStatusBar']) dependencies[`@/components/ui/${name}`] = name;
  dependencies['@/components/ui/modals/NotificationModal'] = 'NotificationModal';
  dependencies['@/hooks/useNotificationPreferences'] = load('hooks/useNotificationPreferences.ts', dependencies);
  const Screen = badge ? load('hooks/useUnreadNotifications.ts', dependencies).useUnreadNotifications : load('app/notifications.tsx', dependencies).default;
  const realSetItem = storage.storage.setItem;
  storage.storage.setItem = async (...args) => { if (failWrites) throw new Error('Storage full'); return realSetItem(...args); };
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
    return predicate(node) ? node : find(node.props?.children, predicate);
  }
  const app = {
    toasts, routes, chatReads, storage, cloud,
    render() { cursor = 0; tree = Screen(); effects.splice(0).forEach(effect => effect()); return app; },
    async settle() { for (let i = 0; i < 15; i++) { app.render(); await new Promise(setImmediate); } return app; },
    list() { app.render(); return find(tree, node => node.type === 'FlatList').props; },
    card(id) { const list = app.list(); return list.renderItem({ item: list.data.find(item => item.id === id) }).props; },
    action(label) { app.render(); return find(tree, node => node.props?.accessibilityLabel === label)?.props; },
    dialog() { app.render(); return find(tree, node => node.type === 'NotificationModal').props; },
    failWrites(value) { failWrites = value; },
    failDeletes: cloud.failDeletes,
    badge() { app.render(); return tree; },
    emitChat(timestamp) { cloud.records.set('chats/conversation', { sender_id: '2', receiver_id: '1', last_sender_id: '2', last_message: 'New message', last_message_at: timestamp }); cloud.emit('chats'); },
    stop() { slots.forEach(slot => slot?.cleanup?.()); },
  };
  return app;
}

test('long press selects instead of opening, supports multiple selection, and Cancel keeps the feed', async () => {
  const app = await screenFixture().settle();
  app.card('app_27').onLongPress();
  assert.equal(app.card('app_27').selected, true);
  app.card('chat_conversation').onPress();
  assert.equal(app.card('chat_conversation').selected, true);
  assert.equal(app.routes.length, 0);
  app.action('Delete 2 selected notifications').onPress();
  assert.equal(app.dialog().visible, true);
  app.dialog().onSecondaryPress();
  assert.equal(app.dialog().visible, false);
  assert.equal(app.list().data.length, 3);
  app.action('Cancel selection').onPress();
  assert.equal(app.card('app_27').selectionMode, false);
  app.stop();
});

test('confirmed delete hides all merged source records without deleting applications or reading chats', async () => {
  const app = await screenFixture().settle();
  app.card('app_27').onLongPress();
  app.action('Delete 1 selected notifications').onPress();
  app.dialog().onPrimaryPress(); await app.settle();
  assert.equal(app.list().data.some(item => item.id === 'app_27'), false);
  assert.equal(app.cloud.records.get('app_notifications/dismissal:1:app_27').through, 100);
  assert.equal(app.cloud.records.get('app_notifications/dismissal:1:firestore_invite').through, 100);
  assert.equal(app.cloud.records.has('app_notifications/invite'), false);
  assert.equal(app.chatReads.length, 0);
  assert.equal(app.routes.length, 0);
  assert.equal(app.toasts.at(-1).type, 'success');
  app.stop();
});

test('failed deletion retains selection and cards, and a retry can succeed', async () => {
  const app = await screenFixture().settle();
  app.card('app_27').onLongPress(); app.failDeletes(true);
  app.action('Delete 1 selected notifications').onPress(); app.dialog().onPrimaryPress();
  const log = console.error; console.error = () => {};
  try { await app.settle(); } finally { console.error = log; }
  assert.equal(app.card('app_27').selected, true);
  assert.equal(app.toasts.at(-1).type, 'error');
  app.failDeletes(false);
  app.action('Delete 1 selected notifications').onPress(); app.dialog().onPrimaryPress(); await app.settle();
  assert.equal(app.list().data.some(item => item.id === 'app_27'), false);
  app.stop();
});

test('cloud permission errors do not show the reopen toast or block local Mark all read', async () => {
  const cloud = cloudFixture();
  cloud.listenErrors.set('app_notifications', Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' }));
  const warn = console.warn, error = console.error;
  console.warn = () => {}; console.error = () => {};
  let app;
  try {
    app = await screenFixture({ cloud }).settle();
    assert.equal(app.toasts.length, 0, 'an optional cloud sync failure must not produce a misleading reopen message');
    assert.equal(app.action('Mark all notifications as read').disabled, false);
    app.action('Mark all notifications as read').onPress(); await app.settle();
    assert.equal(app.toasts.at(-1).type, 'success');
    assert.equal(app.list().data.every(item => item.read), true);
    app.card('app_27').onLongPress(); app.failDeletes(true);
    app.action('Delete 1 selected notifications').onPress(); app.dialog().onPrimaryPress(); await app.settle();
    assert.equal(app.toasts.at(-1).type, 'error', 'an actual failed cloud delete must still report failure');
    assert.equal(app.card('app_27').selected, true);
  } finally { app?.stop(); console.warn = warn; console.error = error; }
});

test('a second device and fresh install observe permanent deletion without local preferences; newer alerts survive', async () => {
  const cloud = cloudFixture();
  const first = await screenFixture({ cloud }).settle();
  const second = await screenFixture({ cloud }).settle();
  const badge = await screenFixture({ cloud, badge: true }).settle();
  first.card('app_27').onLongPress();
  first.action('Delete 1 selected notifications').onPress(); first.dialog().onPrimaryPress();
  await first.settle(); await second.settle(); await badge.settle();
  assert.equal(second.list().data.some(item => item.id === 'app_27'), false, 'the API fallback is also dismissed on the other phone');
  assert.equal(second.list().data.length, 2, 'dismissal metadata must never become a notification card');
  assert.deepEqual((await second.storage.readNotificationPreferences('1')).deleted, {});
  assert.equal(badge.badge().unreadCount, 1, 'only the chat alert remains');
  const installedAgain = await screenFixture({ cloud }).settle();
  assert.equal(installedAgain.list().data.some(item => item.id === 'app_27'), false);
  cloud.records.set('app_notifications/invite', { recipient_id: '1', type: 'application_status', title: 'Interview Invitation', target_id: 27, created_at: 300, read: false });
  cloud.emit('app_notifications'); await second.settle();
  assert.equal(second.list().data.find(item => item.id === 'firestore_invite').timestampMs, 300);
  [first, second, badge, installedAgain].forEach(app => app.stop());
});

test('mark all read persists all sources, updates the displayed unread state, and keeps conversations untouched', async () => {
  const app = await screenFixture().settle();
  app.action('Mark all notifications as read').onPress(); await app.settle();
  assert.equal(app.list().data.every(item => item.read), true);
  assert.equal(app.action('Mark all notifications as read').disabled, true);
  const saved = await app.storage.readNotificationPreferences('1');
  assert.equal(saved.read.app_27, 100); assert.equal(saved.read.firestore_invite, 100);
  assert.equal(saved.read.chat_conversation, 200);
  assert.equal(app.chatReads.length, 0);
  app.stop();
});

test('Select all and Deselect all affect the current filter, and changing filters exits selection', async () => {
  const app = await screenFixture().settle();
  app.action('Select notifications').onPress();
  app.action('Select all notifications in this filter').onPress();
  assert.equal(app.list().data.every(item => app.card(item.id).selected), true);
  app.action('Deselect all notifications in this filter').onPress();
  assert.equal(app.list().data.every(item => !app.card(item.id).selected), true);
  app.action('Messages, 1 notifications').onPress();
  assert.equal(app.list().data.length, 1);
  assert.equal(app.card('chat_conversation').selectionMode, false);
  app.stop();
});

test('saved actions immediately clear the notification badge while preserving the Messages unread count', async () => {
  const app = await screenFixture({ badge: true }).settle();
  assert.equal(app.badge().unreadCount, 2, 'API and live invitation are counted once');
  const items = [{ id: 'app_27', timestampMs: 100 }, { id: 'firestore_invite', timestampMs: 100 }, { id: 'chat_conversation', timestampMs: 200 }];
  await app.storage.saveNotificationAction('1', 'read', items); await app.settle();
  assert.equal(app.badge().hasUnread, false);
  assert.equal(app.badge().unreadMessagesCount, 1, 'marking alerts read does not open a conversation');
  await app.storage.saveNotificationAction('1', 'deleted', items); await app.settle();
  app.emitChat(300); await app.settle();
  assert.equal(app.badge().unreadCount, 1, 'a newer incoming message is not hidden by an earlier deletion');
  app.stop();
});

for (const role of ['employer', 'household']) {
  test(`${role}: applicant alerts support mark all read and confirmed deletion`, async () => {
    const app = await screenFixture({ role }).settle();
    assert.equal(app.list().data.find(item => item.id === 'app_27').title, 'New Applicant');
    app.action('Mark all notifications as read').onPress(); await app.settle();
    assert.equal(app.list().data.every(item => item.read), true);
    app.card('app_27').onLongPress();
    app.action('Delete 1 selected notifications').onPress(); app.dialog().onPrimaryPress(); await app.settle();
    assert.equal(app.list().data.some(item => item.id === 'app_27'), false);
    assert.equal(app.routes.length, 0);
    app.stop();
  });
}

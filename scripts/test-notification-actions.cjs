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

function screenFixture({ badge = false, role = 'student' } = {}) {
  const storage = storageFixture();
  storage.data.set('userData', JSON.stringify({ id: 1, role }));
  const slots = [], effects = [], toasts = [], routes = [], chatReads = [];
  const snapshots = new Map();
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
    'firebase/firestore': {
      collection: (_, name) => name, query: value => value, where() {}, orderBy() {}, limit() {}, doc() {}, setDoc: async () => {}, getDocs: async () => ({ docs: [] }),
      onSnapshot(source, callback) {
        snapshots.set(source, callback);
        const data = source === 'app_notifications'
          ? [{ id: 'invite', type: role === 'student' ? 'application_status' : 'application', title: role === 'student' ? 'Interview Invitation' : 'New Applicant', target_id: 27, created_at: 100, read: false }]
          : [{ id: 'conversation', sender_id: '2', receiver_id: '1', last_sender_id: '2', last_message: 'Hello', last_message_at: 200 }];
        callback({ docs: data.map(item => ({ id: item.id, data: () => item })) });
        return () => {};
      },
    },
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
    toasts, routes, chatReads, storage,
    render() { cursor = 0; tree = Screen(); effects.splice(0).forEach(effect => effect()); return app; },
    async settle() { for (let i = 0; i < 15; i++) { app.render(); await new Promise(setImmediate); } return app; },
    list() { app.render(); return find(tree, node => node.type === 'FlatList').props; },
    card(id) { const list = app.list(); return list.renderItem({ item: list.data.find(item => item.id === id) }).props; },
    action(label) { app.render(); return find(tree, node => node.props?.accessibilityLabel === label)?.props; },
    dialog() { app.render(); return find(tree, node => node.type === 'NotificationModal').props; },
    failWrites(value) { failWrites = value; },
    badge() { app.render(); return tree; },
    emitChat(timestamp) { snapshots.get('chats')({ docs: [{ id: 'conversation', data: () => ({ sender_id: '2', receiver_id: '1', last_sender_id: '2', last_message: 'New message', last_message_at: timestamp }) }] }); },
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
  const saved = await app.storage.readNotificationPreferences('1');
  assert.equal(saved.deleted.app_27, 100);
  assert.equal(saved.deleted.firestore_invite, 100);
  assert.equal(app.chatReads.length, 0);
  assert.equal(app.routes.length, 0);
  assert.equal(app.toasts.at(-1).type, 'success');
  app.stop();
});

test('failed deletion retains selection and cards, and a retry can succeed', async () => {
  const app = await screenFixture().settle();
  app.card('app_27').onLongPress(); app.failWrites(true);
  app.action('Delete 1 selected notifications').onPress(); app.dialog().onPrimaryPress();
  const log = console.error; console.error = () => {};
  try { await app.settle(); } finally { console.error = log; }
  assert.equal(app.card('app_27').selected, true);
  assert.equal(app.toasts.at(-1).type, 'error');
  app.failWrites(false);
  app.action('Delete 1 selected notifications').onPress(); app.dialog().onPrimaryPress(); await app.settle();
  assert.equal(app.list().data.some(item => item.id === 'app_27'), false);
  app.stop();
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

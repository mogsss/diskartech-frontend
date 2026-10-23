// Run with: node --test scripts/test-conversation-selection.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative, dependencies) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const timestamp = value => typeof value === 'number' ? value : value?.toMillis?.() || 0;
const sample = (id, otherId, lastAt = 100, unread = true) => ({
  id, sender_id: otherId, receiver_id: '1', participant_ids: ['1', otherId],
  last_sender_id: otherId, last_message: `Hello from ${otherId}`, last_message_at: lastAt, unread,
  messages: ['The original messages stay available to the other user.'],
});

function coreFixture() {
  const records = new Map([['a', sample('a', '2', 100)], ['b', sample('b', '3', 200, false)]]);
  const failures = new Set(), listeners = new Set(), writes = [];
  let active = 0, maxActive = 0;
  const emit = () => listeners.forEach(listener => listener({ docs: [...records].map(([id, value]) => ({ id, data: () => value })) }));
  const firestore = {
    doc: (_, collection, id) => ({ collection, id }), collection: () => 'chats',
    onSnapshot(_, callback) { listeners.add(callback); emit(); return () => listeners.delete(callback); },
    Timestamp: { fromMillis: ms => ({ toMillis: () => ms }) }, serverTimestamp: () => ({ toMillis: () => 10000 }),
    async runTransaction(_, callback) {
      active++; maxActive = Math.max(active, maxActive);
      const staged = [];
      try {
        await new Promise(setImmediate);
        await callback({
          get: async ref => {
            if (failures.has(ref.id)) throw new Error('Network unavailable');
            return { exists: () => records.has(ref.id), data: () => records.get(ref.id) };
          },
          update: (ref, value) => staged.push({ ref, value }),
        });
        staged.forEach(({ ref, value }) => { records.set(ref.id, { ...records.get(ref.id), ...value }); writes.push({ ref, value }); });
        if (staged.length) emit();
      } finally { active--; }
    },
  };
  const actions = load('utils/conversationActions.ts', {
    '@/utils/firebase': { db: {} }, '@/utils/chatHelpers': { getTimestampMs: timestamp }, 'firebase/firestore': firestore,
  });
  return { records, failures, writes, emit, firestore, actions, maxActive: () => maxActive };
}

test('delete writes only the requesting participant cutoff and preserves newer messages and the other participant', async () => {
  const app = coreFixture();
  app.records.set('a', { ...app.records.get('a'), last_message_at: 300, cleared_at_for_2: 50 });
  const messages = app.records.get('a').messages;
  const result = await app.actions.deleteConversationsForUser('1', [{ id: 'a', lastMessageAt: 100 }]);
  assert.deepEqual(result, { deletedIds: ['a'], failedIds: [] });
  assert.equal(timestamp(app.records.get('a').cleared_at_for_1), 100);
  assert.equal(app.records.get('a').last_message_at, 300, 'an incoming message during confirmation is preserved');
  assert.equal(app.records.get('a').cleared_at_for_2, 50);
  assert.equal(app.records.get('a').messages, messages);
  assert.deepEqual(Object.keys(app.writes[0].value), ['cleared_at_for_1']);
});

test('delete validates membership, handles partial failure, and never moves a newer clear cutoff backwards', async () => {
  const app = coreFixture();
  app.records.set('a', { ...app.records.get('a'), cleared_at_for_1: 500 });
  app.failures.add('b');
  const result = await app.actions.deleteConversationsForUser('1', [{ id: 'a', lastMessageAt: 100 }, { id: 'b', lastMessageAt: 200 }]);
  assert.deepEqual(result.deletedIds, ['a']); assert.deepEqual(result.failedIds, ['b']);
  assert.equal(app.records.get('a').cleared_at_for_1, 500);
  assert.equal(app.records.get('b').cleared_at_for_1, undefined);
  const outsider = await app.actions.deleteConversationsForUser('99', [{ id: 'a', lastMessageAt: 100 }]);
  assert.deepEqual(outsider.failedIds, ['a']);
  await assert.rejects(app.actions.deleteConversationsForUser('unknown', [{ id: 'a', lastMessageAt: 100 }]));
  await assert.rejects(app.actions.deleteConversationsForUser('1', [{ id: '../bad', lastMessageAt: 100 }]));
});

test('Select all bounds concurrent transactions and does not submit duplicate thread IDs', async () => {
  const app = coreFixture();
  const targets = Array.from({ length: 14 }, (_, index) => {
    const id = `chat-${index}`; app.records.set(id, sample(id, '2'));
    return { id, lastMessageAt: 100 };
  });
  const result = await app.actions.deleteConversationsForUser('1', [...targets, targets[0]]);
  assert.equal(result.deletedIds.length, 14); assert.equal(result.failedIds.length, 0);
  assert.ok(app.maxActive() <= 4);
  assert.equal(app.writes.length, 14);
});

test('legacy duplicate threads retain every source but different users sharing a name stay separate', () => {
  const app = coreFixture();
  const newest = { id: 'new', otherUserId: '2', senderName: 'Juan', lastMessageAt: 200 };
  const older = { ...newest, id: 'old', lastMessageAt: 100 };
  const other = { ...newest, id: 'other', otherUserId: '3' };
  const original = JSON.stringify([newest, older, other]);
  const merged = app.actions.mergeConversationThreads([newest, older, other]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].sourceChats.map(item => item.id), ['new', 'old']);
  assert.equal(JSON.stringify([newest, older, other]), original);
});

function screenFixture(role) {
  const core = coreFixture();
  const slots = [], effects = [], toasts = [], routes = [];
  let cursor = 0, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++; slots[index] ??= { value: initial };
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) {
        const previous = slots[index]; slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', FlatList: 'FlatList', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner', Keyboard: { dismiss() {} }, BackHandler: { addEventListener: () => ({ remove() {} }) } },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ isDark: false, colors: { background: '#fff', surface: '#fff', border: '#ccc', accent: '#c00', primary: '#c00', text: '#111', textSecondary: '#666' } }) },
    '@/hooks/useToast': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
    '@/utils/conversationActions': core.actions,
    '@/api/axios': { STORAGE_URL: 'https://example.test/', get: async () => ({ data: { statuses: {} } }) },
    '@react-native-async-storage/async-storage': { getItem: async () => JSON.stringify({ role, name: 'Test User' }) },
    'expo-router': { router: { push: route => routes.push(route) } },
    '@/utils/firebase': { db: {} }, 'firebase/firestore': core.firestore,
    '@/utils/chat': {
      CHATS_COLLECTION: 'chats', getLoggedInUserId: async () => '1', getTimestampMs: timestamp,
      normalizeChatFields: data => data, formatChatListTime: () => 'Just now', isChatUnreadForUser: chat => chat.unread,
      getOtherParticipant: chat => ({ id: chat.sender_id, name: chat.sender_id === '2' ? 'Alice' : 'Bob', avatar: '' }),
    },
  };
  for (const component of ['Avatar', 'SearchBar', 'SafeStatusBar', 'DrawerMenuButton']) dependencies[`@/components/ui/${component}`] = component;
  dependencies['@/components/student/StudentTabBarSpacer'] = 'Spacer';
  dependencies['@/components/employer/EmployerTabBarSpacer'] = 'Spacer';
  dependencies['@/components/ui/modals/SideDrawerMenu'] = 'Drawer';
  dependencies['@/components/ui/modals/NotificationModal'] = 'NotificationModal';
  dependencies['@/components/chat/ConversationSelectionActions'] = 'SelectionActions';
  dependencies['@/hooks/useConversationSelection'] = load('hooks/useConversationSelection.ts', dependencies);
  const Controls = load('components/chat/ConversationSelectionActions.tsx', dependencies).default;
  const Screen = load(`app/${role === 'student' ? 'students' : 'employer'}/(tabs)/messages.tsx`, dependencies).default;
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.map(item => find(item, predicate)).find(Boolean);
    return predicate(node) ? node : find(node.props?.children, predicate);
  };
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const app = {
    core, toasts, routes,
    render() { cursor = 0; tree = Screen(); effects.splice(0).forEach(effect => effect()); return app; },
    async settle() { for (let i = 0; i < 12; i++) { app.render(); await new Promise(setImmediate); } return app; },
    list() { app.render(); return find(tree, node => node.type === 'FlatList').props; },
    row(id) { const list = app.list(); const item = list.data.find(value => value.id === id); assert.ok(item, `Missing conversation ${id}`); return list.renderItem({ item }).props; },
    selection() { app.render(); return find(tree, node => node.type === 'SelectionActions').props.selection; },
    control(label) { return find(Controls({ selection: app.selection() }), node => node.props?.accessibilityLabel === label).props; },
    dialog() { return find(Controls({ selection: app.selection() }), node => node.type === 'NotificationModal').props; },
    search(value) { app.render(); find(tree, node => node.type === 'SearchBar').props.onChangeText(value); },
    filter(label) { app.render(); find(tree, node => node.type === 'Button' && text(node).startsWith(label)).props.onPress(); },
    stop() { slots.forEach(slot => slot?.cleanup?.()); },
  };
  return app;
}

for (const role of ['student', 'employer', 'household']) {
  test(`${role}: long press selects, Select all toggles visible conversations, and Cancel keeps messages`, async () => {
    const app = await screenFixture(role).settle();
    app.row('a').onLongPress();
    assert.equal(app.row('a').accessibilityRole, 'checkbox');
    assert.equal(app.row('a').accessibilityState.checked, true);
    app.row('b').onPress(); assert.equal(app.selection().selectedCount, 2);
    assert.equal(app.routes.length, 0, 'tapping in selection mode does not open chat');
    app.control('Deselect all visible conversations').onPress(); assert.equal(app.selection().selectedCount, 0);
    app.control('Select all visible conversations').onPress(); assert.equal(app.selection().selectedCount, 2);
    app.control('Delete 2 selected conversations').onPress(); assert.equal(app.dialog().visible, true);
    app.dialog().onSecondaryPress(); assert.equal(app.dialog().visible, false);
    assert.equal(app.core.writes.length, 0);
    app.selection().exit(); app.row('a').onPress(); assert.deepEqual(app.routes, ['/chat?id=a']);
    app.stop();
  });

  test(`${role}: filtered Select all deletes only matching conversations and retains the other participant's messages`, async () => {
    const app = await screenFixture(role).settle();
    app.search('Alice'); app.control('Select conversations').onPress();
    app.control('Select all visible conversations').onPress();
    app.control('Delete 1 selected conversations').onPress();
    app.dialog().onPrimaryPress(); await app.settle();
    assert.equal(timestamp(app.core.records.get('a').cleared_at_for_1), 100);
    assert.equal(app.core.records.get('b').cleared_at_for_1, undefined);
    assert.equal(app.core.records.get('a').messages.length, 1);
    assert.equal(app.list().data.length, 0);
    assert.equal(app.toasts.at(-1).type, 'success');
    app.stop();
  });
}

test('a new message during confirmation stays visible; a failed deletion stays selected and can be retried', async () => {
  const app = await screenFixture('student').settle();
  app.row('a').onLongPress(); app.control('Select all visible conversations').onPress();
  app.control('Delete 2 selected conversations').onPress();
  app.core.records.set('a', { ...app.core.records.get('a'), last_message_at: 300, last_message: 'Arrived during confirmation' });
  app.core.emit(); app.core.failures.add('b');
  app.dialog().onPrimaryPress(); await app.settle();
  assert.equal(app.row('a').accessibilityState.checked, false);
  assert.equal(app.row('b').accessibilityState.checked, true);
  assert.equal(app.toasts.at(-1).type, 'warning');
  assert.equal(timestamp(app.core.records.get('a').cleared_at_for_1), 100);
  app.core.failures.delete('b');
  app.control('Delete 1 selected conversations').onPress(); app.dialog().onPrimaryPress(); await app.settle();
  assert.equal(app.list().data.length, 1); assert.equal(app.list().data[0].id, 'a');
  app.stop();
});

test('Unread filtering and search changes exit selection so hidden conversations cannot be accidentally included', async () => {
  const app = await screenFixture('student').settle();
  app.row('b').onLongPress(); app.filter('Unread');
  assert.equal(app.selection().mode, false); assert.equal(app.list().data.length, 1);
  app.control('Select conversations').onPress(); app.control('Select all visible conversations').onPress();
  assert.equal(app.selection().selectedCount, 1);
  app.search('Alice'); assert.equal(app.selection().mode, false);
  app.stop();
});

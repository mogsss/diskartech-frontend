// Run with: node --test scripts/test-application-schedule-warning.cjs
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
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const slot = (day, start, end) => ({ day_of_week: day, start_time: start, end_time: end, ends_next_day: false });
const required = [slot('Mon', '06:00', '12:00')];
const availability = [slot('Mon', '13:00', '17:00')];
const warning = { response: { status: 409, data: {
  requires_schedule_confirmation: true,
  message: 'Your saved availability does not cover all the work hours for this job.',
  schedule_review: { required_slots: required, availability_slots: availability },
} } };

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}

async function fixture(postResponse) {
  const hooks = [], effects = [], requests = [], scrolls = [], routes = [], toasts = [];
  let cursor = 0, tree;
  const jsx = (type, props) => {
    if (props.ref) props.ref.current = { scrollTo: options => scrolls.push(options) };
    return { type, props };
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!hooks[i]) hooks[i] = { value: initial };
      return [hooks[i].value, next => { hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next; }];
    },
    useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial }; },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!hooks[i] || deps.some((dep, index) => !Object.is(dep, hooks[i].deps[index]))) hooks[i] = { callback, deps };
      return hooks[i].callback;
    },
  };
  let focused;
  const Screen = load('app/students/job-details.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': Object.fromEntries(['ScrollView', 'Text', 'TouchableOpacity', 'View', 'ActivityIndicator', 'Modal', 'Pressable', 'Image', 'Share'].map(name => [name, name])),
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    'expo-router': {
      router: { push: route => routes.push(route), back() {} }, useLocalSearchParams: () => ({ id: '7' }),
      useFocusEffect(callback) { if (focused !== callback) { focused = callback; effects.push(callback); } },
    },
    '@/api/axios': { get: async url => ({ data: url === '/jobs/7'
      ? { status: 'success', job: { id: 7, title: 'Assistant', schedule_slots: required } }
      : { status: 'success', jobs: [], applications: [] } }),
    post: async (url, data) => { requests.push({ url, data }); return postResponse(data); } },
    '@react-native-async-storage/async-storage': { getItem: async () => '{"isVerified":true}' },
    '@/utils/media': { resolveMediaUrl: () => null },
    '@/utils/chat': { ensureChatRoom() {}, getStudentParticipantFromStorage: async () => ({}), isGenericName: () => false, resolveOwnerFromJob: () => ({}) },
    '@/utils/notifications': { sendAppNotification: async () => {} },
    '@/utils/notificationFeed': { getCreatedApplicationId: () => 83 },
    '@/utils/jobApplications': { getAppliedJobIds: () => new Set() },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: true }) },
    '@/hooks/useToast': { useToast: () => ({ showToast: options => toasts.push(options) }) },
    '@/utils/jobRate': { getSalaryLabel: () => 'Pay', getSalaryUnit: () => 'day' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    ...Object.fromEntries([
      ['@/components/ui/modals/NotificationModal', 'Notification'], ['@/components/ui/SafeStatusBar', 'SafeStatusBar'],
      ['@/components/student/application-details/ApplicationSection', 'Section'],
      ['@/components/schedule/WeeklyScheduleSummary', 'WeeklyScheduleSummary'], ['@/components/schedule/ScheduleMatchNotice', 'ScheduleMatchNotice'],
    ].map(([name, type]) => [name, type])),
  }).default;
  function render() { cursor = 0; tree = Screen(); }
  async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve(); render(); }
  render();
  const nativeSetInterval = global.setInterval;
  // Keep the screen's polling lifecycle out of this isolated interaction test.
  global.setInterval = () => 0;
  try { effects.splice(0).forEach(effect => effect()); } finally { global.setInterval = nativeSetInterval; }
  await settle();
  return {
    requests, scrolls, routes, toasts, settle, render,
    find: predicate => find(tree, predicate),
    apply: () => find(tree, node => node.props?.accessibilityLabel === 'Apply now').props.onPress(),
    notice: () => find(tree, node => node.type === 'Notification').props,
  };
}

const success = { data: { status: 'success', data: { id: 83 } } };

test('saving and removing a job use toasts without opening a blocking modal', async () => {
  const screen = await fixture(async () => success);
  await screen.find(node => node.props?.accessibilityLabel === 'Save job').props.onPress(); screen.render();
  assert.equal(screen.toasts[0].title, 'Job saved');
  assert.equal(screen.toasts[0].type, 'success');
  assert.equal(screen.notice().visible, false);
  await screen.find(node => node.props?.accessibilityLabel === 'Unsave job').props.onPress(); screen.render();
  assert.equal(screen.toasts[1].title, 'Job removed');
  assert.equal(screen.notice().visible, false);
  assert.ok(screen.requests.every(request => request.url === '/student/toggle-save-job'));
});

test('mismatched hours require a deliberate Continue anyway before submitting', async () => {
  const screen = await fixture(async data => { if (!data.acknowledge_schedule_warning) throw warning; return success; });
  screen.apply(); await screen.settle();
  assert.equal(screen.requests.length, 1);
  assert.equal(screen.requests[0].data.acknowledge_schedule_warning, false);
  assert.equal(screen.notice().title, 'Review your schedule');
  assert.equal(screen.notice().secondaryButtonText, 'Continue anyway');
  assert.equal(screen.find(node => node.props?.accessibilityLabel === 'Application submitted'), undefined);
  screen.notice().onSecondaryPress(); await screen.settle();
  assert.equal(screen.requests.length, 2);
  assert.equal(screen.requests[1].data.acknowledge_schedule_warning, true);
  assert.equal(screen.notice().title, 'Application Submitted!');
});

test('Review schedule shows both schedules and does not submit an application', async () => {
  const screen = await fixture(async () => { throw warning; });
  screen.apply(); await screen.settle();
  screen.find(node => typeof node.props?.onLayout === 'function').props.onLayout({ nativeEvent: { layout: { y: 400 } } });
  screen.notice().onPrimaryPress(); screen.render();
  assert.equal(screen.notice().visible, false);
  assert.deepEqual(screen.scrolls, [{ y: 388, animated: true }]);
  assert.ok(screen.find(node => node.type === 'WeeklyScheduleSummary' && node.props.slots === availability));
  assert.equal(screen.requests.length, 1);
});

test('dismissing the warning and retrying never silently acknowledges a mismatch', async () => {
  const screen = await fixture(async () => { throw warning; });
  screen.apply(); await screen.settle();
  screen.notice().onRequestClose(); screen.render();
  assert.equal(screen.notice().visible, false);
  screen.apply(); await screen.settle();
  assert.equal(screen.requests.length, 2);
  assert.ok(screen.requests.every(request => request.data.acknowledge_schedule_warning === false));
});

test('tapping outside the schedule warning dismisses it without submitting', async () => {
  const screen = await fixture(async () => { throw warning; });
  screen.apply(); await screen.settle();
  screen.notice().onBackdropPress(); screen.render();
  assert.equal(screen.notice().visible, false);
  assert.equal(screen.requests.length, 1);
  assert.equal(screen.requests[0].data.acknowledge_schedule_warning, false);
});

test('ordinary server errors cannot offer a schedule override', async () => {
  const screen = await fixture(async () => { throw { response: { status: 500, data: { message: 'Try again later.' } } }; });
  screen.apply(); await screen.settle();
  assert.equal(screen.notice().title, 'Notice');
  assert.equal(screen.notice().secondaryButtonText, undefined);
});

test('matching hours submit directly and repeated taps do not send duplicate requests', async () => {
  const screen = await fixture(async () => success);
  screen.apply(); screen.apply(); await screen.settle();
  assert.equal(screen.requests.length, 1);
  assert.equal(screen.notice().title, 'Application Submitted!');
});

test('Android Back uses the explicit dismiss callback instead of Continue anyway', () => {
  const jsx = (type, props) => ({ type, props });
  const Modal = load('components/ui/modals/NotificationModal.tsx', {
    react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable' },
    '@expo/vector-icons': { MaterialIcons: 'Icon' }, '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: true }) },
  }).default;
  let dismissed = 0, submitted = 0;
  const tree = Modal({ visible: true, onPrimaryPress() {}, secondaryButtonText: 'Continue anyway', onSecondaryPress: () => submitted++, onRequestClose: () => dismissed++ });
  tree.props.onRequestClose();
  assert.equal(dismissed, 1);
  assert.equal(submitted, 0);
});

test('the backdrop dismiss action is separate from the dialog content and is opt-in', () => {
  const jsx = (type, props) => ({ type, props });
  const Modal = load('components/ui/modals/NotificationModal.tsx', {
    react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Modal: 'Modal', View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable' },
    '@expo/vector-icons': { MaterialIcons: 'Icon' }, '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: true }) },
  }).default;
  let dismissed = 0, submitted = 0;
  const props = { visible: true, onPrimaryPress() {}, secondaryButtonText: 'Continue anyway', onSecondaryPress: () => submitted++ };
  assert.equal(find(Modal(props), node => node.type === 'Pressable'), undefined);
  const tree = Modal({ ...props, onBackdropPress: () => dismissed++ });
  const backdrop = find(tree, node => node.type === 'Pressable');
  assert.equal(backdrop.props.children, undefined, 'the content is not inside the dismiss target');
  backdrop.props.onPress();
  assert.equal(dismissed, 1);
  assert.equal(submitted, 0);
});

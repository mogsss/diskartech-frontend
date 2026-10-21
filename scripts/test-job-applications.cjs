// Run with: node --test scripts/test-job-applications.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const tick = () => new Promise(setImmediate);

function load(relative, dependencies = {}, prefix = '') {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  loaded._compile(prefix + ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

const helpers = load('utils/jobApplications.ts');
const { getAppliedJobIds, sortApplicationsNewestFirst } = helpers;

test('newest applications appear first even if an older record has a newer status update', () => {
  const records = Object.freeze([
    { id: 99, status: 'viewed', created_at: '2026-10-20T08:00:00Z', updated_at: '2026-10-23T08:00:00Z' },
    { id: 2, status: 'pending', created_at: '2026-10-22T08:00:00Z' },
    { id: 100, status: 'pending', created_at: '2026-10-21T08:00:00Z' },
  ]);
  const sorted = sortApplicationsNewestFirst(records);
  assert.deepEqual(sorted.map(item => item.id), [2, 100, 99]);
  assert.deepEqual(sorted.filter(item => item.status === 'pending').map(item => item.id), [2, 100]);
  assert.deepEqual(records.map(item => item.id), [99, 2, 100]);
});

test('equal application dates use numeric record IDs, including equivalent timezone offsets', () => {
  const records = [
    { id: '9', created_at: '2026-10-21T08:00:00Z' },
    { id: 10, created_at: '2026-10-21T08:00:00Z' },
    { id: '11', created_at: '2026-10-21T16:00:00+08:00' },
  ];
  assert.deepEqual(sortApplicationsNewestFirst(records).map(item => item.id), ['11', 10, '9']);
});

test('missing or invalid application dates sort below dated records with a consistent ID order', () => {
  const records = [{ id: 3 }, { id: 4, created_at: 'invalid' }, { id: 2, created_at: null }, { id: 1, created_at: '2026-10-21T08:00:00Z' }];
  assert.deepEqual(sortApplicationsNewestFirst(records).map(item => item.id), [1, 4, 3, 2]);
  assert.deepEqual(sortApplicationsNewestFirst([]), []);
});

test('cancelled history does not count as applied or get removed from the original records', () => {
  const records = Object.freeze([
    Object.freeze({ id: 10, job_id: 7, status: 'cancelled' }),
    Object.freeze({ id: 11, job: { id: '8' }, status: ' Cancelled ' }),
  ]);
  assert.deepEqual([...getAppliedJobIds(records)], []);
  assert.equal(records.length, 2);
  assert.equal(records[0].status, 'cancelled');
});

test('non-cancelled statuses still count as applied, including declined and finished history', () => {
  const statuses = ['pending', 'Viewed', 'shortlisted', 'interview', 'accepted', 'rejected', 'completed', 'terminated'];
  const records = statuses.map((status, index) => ({ job_id: index + 1, status }));
  assert.deepEqual([...getAppliedJobIds(records)], statuses.map((_, index) => String(index + 1)));
});

test('a new application remains applied regardless of where its cancelled history appears', () => {
  const cancelled = { job_id: '7', status: 'cancelled' };
  const pending = { job: { id: 7 }, status: 'pending' };
  for (const records of [[cancelled, pending], [pending, cancelled]]) {
    assert.deepEqual([...getAppliedJobIds(records)], ['7']);
  }
});

test('job IDs work with either API shape; missing IDs never create an applied entry', () => {
  assert.deepEqual([...getAppliedJobIds([
    { job_id: 7, status: 'pending' }, { job: { id: '7' }, status: 'viewed' },
    { job_id: null, job: { id: 8 }, status: 'pending' },
    { status: 'pending' }, { job: null, status: 'pending' }, { job_id: '', status: 'pending' },
  ])], ['7', '8']);
  assert.deepEqual([...getAppliedJobIds([])], []);
});

function detailsFixture(history) {
  const slots = [], posts = [], timers = new Set();
  let cursor = 0, focus, cleanup;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useCallback: callback => callback,
  };
  const job = { id: 7, status: 'active', title: 'Cafe assistant', salary: 100, salary_type: 'hour', employer: { employer_name: 'Cafe' } };
  const screen = load('app/students/job-details.tsx', {
    __clock: {
      setInterval(callback) { timers.add(callback); return callback; },
      clearInterval(callback) { timers.delete(callback); },
    },
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    'expo-router': { router: { push() {} }, useLocalSearchParams: () => ({ id: '7' }), useFocusEffect(callback) { focus = callback; } },
    'react-native': { ScrollView: 'Scroll', Text: 'Text', TouchableOpacity: 'Button', View: 'View', ActivityIndicator: 'Spinner', Modal: 'Modal', Pressable: 'Pressable', Image: 'Image', Share: { share() {} } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '@/api/axios': {
      async get(url) {
        if (url === '/jobs/7') return { data: { status: 'success', job } };
        if (url === '/student/saved-jobs') return { data: { status: 'success', jobs: [] } };
        assert.equal(url, '/student/applications');
        return { data: { status: 'success', applications: history } };
      },
      async post(url, data) {
        assert.equal(url, '/student/apply-job');
        assert.equal(data.job_id, 7);
        posts.push({ url, data });
        const application = { id: 20, job_id: 7, status: 'pending' };
        history.push(application);
        return { data: { status: 'success', data: application } };
      },
    },
    '@/utils/jobApplications': helpers,
    '@/utils/media': { resolveMediaUrl: value => value },
    '@react-native-async-storage/async-storage': { getItem: async () => JSON.stringify({ isVerified: true }) },
    '@/components/ui/modals/NotificationModal': 'Notice', '@/components/ui/SafeStatusBar': 'StatusBar',
    '@/utils/chat': { ensureChatRoom() {}, getStudentParticipantFromStorage: async () => ({ student_user_id: '21', student_name: 'Student' }), isGenericName: () => false, resolveOwnerFromJob: () => ({ owner_user_id: '10' }) },
    '@/utils/notifications': { sendAppNotification: async () => {} },
    '@/utils/notificationFeed': { getCreatedApplicationId: data => String(data.data.id) },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ isDark: false, colors: {} }) },
    '@/hooks/useToast': { useToast: () => ({ showToast() {} }) },
    '@/utils/jobRate': { getSalaryLabel: () => 'Hourly rate', getSalaryUnit: () => 'per hour' },
    '@/components/student/application-details/ApplicationSection': 'Section',
    '@/components/schedule/WeeklyScheduleSummary': 'Schedule', '@/components/schedule/ScheduleMatchNotice': 'Match',
  }, "const { setInterval, clearInterval } = require('__clock');\n").default;
  const app = {
    posts, history,
    render() { cursor = 0; return screen(); },
    find(label) {
      let found;
      const visit = node => {
        if (Array.isArray(node)) return node.forEach(visit);
        if (!node || typeof node !== 'object') return;
        if (node.props?.accessibilityLabel === label) found = node;
        visit(node.props?.children);
      };
      visit(app.render());
      return found;
    },
    async start() { app.render(); cleanup = focus(); await tick(); app.render(); },
    async poll() { for (const callback of timers) callback(); await tick(); app.render(); },
    stop() { cleanup?.(); },
  };
  return app;
}

test('Job details restores Apply now after cancellation without deleting history', async () => {
  const history = [{ id: 10, job_id: 7, status: 'pending' }];
  const app = detailsFixture(history);
  try {
    await app.start();
    assert.ok(app.find('Application submitted'));
    assert.equal(app.find('Apply now'), undefined);
    history[0].status = 'cancelled';
    await app.poll();
    assert.ok(app.find('Apply now'));
    assert.equal(app.find('Application submitted'), undefined);
    assert.equal(history.length, 1);
    await app.find('Apply now').props.onPress();
    assert.equal(app.posts.length, 1);
    assert.equal(history.length, 2);
    assert.equal(history[0].status, 'cancelled');
    assert.equal(history[1].status, 'pending');
    assert.ok(app.find('Application submitted'));
    await app.poll();
    assert.equal(app.find('Apply now'), undefined);
  } finally { app.stop(); }
});

test('Job details ignores cancelled history for the current job without mixing in another job', async () => {
  const app = detailsFixture([{ job_id: 7, status: 'cancelled' }, { job_id: 8, status: 'pending' }]);
  try {
    await app.start();
    assert.ok(app.find('Apply now'));
    assert.equal(app.find('Application submitted'), undefined);
  } finally { app.stop(); }
});

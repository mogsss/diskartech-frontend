// Run with: node --test scripts/test-home-bookmark-toast.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}

async function fixture({ initiallySaved = false, fail = false } = {}) {
  const hooks = [], focusEffects = [], toasts = [];
  const job = { id: 7, title: 'Assistant', salary: 100, salary_type: 'hour' };
  let saved = initiallySaved, cursor = 0, tree, requests = 0;
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react: { useState(initial) {
      const index = cursor++;
      hooks[index] ??= { value: initial };
      return [hooks[index].value, next => { hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next; }];
    }, useCallback: callback => callback },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      ...Object.fromEntries(['View', 'Text', 'FlatList', 'ScrollView', 'TouchableOpacity', 'ActivityIndicator', 'RefreshControl'].map(name => [name, name])),
      BackHandler: { addEventListener: () => ({ remove() {} }) },
    },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    'expo-router': { router: { push() {} }, useFocusEffect: effect => focusEffects.push(effect) },
    '@react-native-async-storage/async-storage': { getItem: async () => null },
    '@/api/axios': {
      async get(url) {
        if (url === '/student/applications') return { data: { status: 'success', applications: [] } };
        if (url === '/student/saved-jobs') return { data: { status: 'success', jobs: saved ? [job] : [] } };
        return { data: { status: 'success', jobs: [job], matched_jobs: [job], matched_by: 'fallback_math' } };
      },
      async post(url, body) {
        assert.equal(url, '/student/toggle-save-job'); assert.equal(body.job_id, '7'); requests++;
        if (fail) throw Error('Unavailable');
        saved = !saved;
        return { data: { status: 'success', message: saved ? 'Job saved successfully' : 'Job removed from saved items' } };
      },
    },
    '@/utils/media': { resolveMediaUrl: value => value },
    '@/utils/jobFeatured': { buildForYouJobs: matched => matched, isFeaturedJob: () => false, moveAppliedJobsLast: jobs => jobs },
    '@/utils/jobApplications': { getAppliedJobIds: () => new Set() },
    '@/utils/fuzzySearch': { matchJobWithQuery: () => ({ score: 1, matches: true }) },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: true }) },
    '@/hooks/useToast': { useToast: () => ({ showToast: options => toasts.push(options) }) },
    '@/hooks/useUnreadNotifications': { useUnreadNotifications: () => ({ hasUnread: false }) },
    '@/components/student/HomeJobCard': 'HomeJobCard', '@/components/ui/SearchBar': 'SearchBar',
    '@/components/ui/SafeStatusBar': 'SafeStatusBar', '@/components/ui/modals/SideDrawerMenu': 'SideDrawerMenu',
  };
  const filename = path.join(__dirname, '..', 'app/students/(tabs)/home.tsx');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports, setInterval: () => 0, clearInterval() {}, console: { error() {} }, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name];
  } }, { filename });
  const render = () => { cursor = 0; tree = exports.default(); };
  const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); render(); };
  render(); focusEffects.splice(0).forEach(effect => effect()); await settle();
  const list = () => find(tree, node => node.type === 'FlatList');
  return {
    toasts, settle, requests: () => requests,
    select(label) { find(list().props.ListHeaderComponent, node => node.props?.accessibilityLabel === label).props.onPress(); render(); },
    card() { return find(list().props.renderItem({ item: list().props.data[0] }), node => node.type === 'HomeJobCard'); },
    count: () => list().props.data.length,
  };
}

test('Home All jobs, Nearby and For you show success toasts for saving and removing jobs', async () => {
  for (const label of ['All jobs', 'Nearby', 'Recommended jobs']) {
    const app = await fixture(); app.select(label);
    await app.card().props.onBookmark(); await app.settle();
    assert.equal(app.toasts[0].type, 'success');
    assert.equal(app.toasts[0].title, 'Job saved');
    assert.equal(app.toasts[0].message, 'Job saved successfully');
    assert.equal(app.card().props.job.bookmarked, true);
    await app.card().props.onBookmark(); await app.settle();
    assert.equal(app.toasts[1].title, 'Job removed');
    assert.equal(app.card().props.job.bookmarked, false);
    assert.equal(app.requests(), 2);
  }
});

test('removing a job from the Saved tab shows a toast and removes it from the list', async () => {
  const app = await fixture({ initiallySaved: true }); app.select('Saved');
  await app.card().props.onBookmark(); await app.settle();
  assert.equal(app.toasts[0].title, 'Job removed');
  assert.equal(app.count(), 0);
});

test('a failed bookmark request shows an error toast without changing the saved state', async () => {
  const app = await fixture({ fail: true });
  await app.card().props.onBookmark(); await app.settle();
  assert.equal(app.toasts[0].type, 'error');
  assert.equal(app.toasts[0].title, 'Could not update saved jobs');
  assert.equal(app.card().props.job.bookmarked, false);
  assert.equal(app.count(), 1);
});

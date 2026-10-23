/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console: { log() {}, error() {} }, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename });
  return exports;
}

const account = load('utils/hirerAccount.ts');
const jsx = (type, props) => ({ type, props });
function text(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(text).join(' ');
  return node && typeof node === 'object' ? text(node.props?.children) : '';
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(value => find(value, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}

function fixture({ user = { id: 3, role: 'household', email: 'household@example.test' }, profile = { user_id: 3, household_name: 'Household owner', isVerified: 1 }, fresh = profile, type, offline = false, layout = false } = {}) {
  const storage = new Map([['userData', JSON.stringify(user)], ['userProfile', typeof profile === 'string' ? profile : JSON.stringify(profile)]]);
  const hooks = [], effects = [], navigation = [];
  let cursor = 0, tree, focusCallback;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === 'function' ? initial() : initial, set(value) { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; } };
      return [hooks[index].value, hooks[index].set];
    },
    useRef(initial) { const index = cursor++; if (!hooks[index]) hooks[index] = { current: initial }; return hooks[index]; },
    useCallback(callback, deps) { const index = cursor++; if (!same(hooks[index]?.deps, deps)) hooks[index] = { callback, deps }; return hooks[index].callback; },
  };
  const native = Object.fromEntries(['ActivityIndicator', 'RefreshControl', 'ScrollView', 'Text', 'TouchableOpacity', 'View'].map(name => [name, name]));
  native.Platform = { OS: 'android' };
  const dependencies = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': native,
    '@expo/vector-icons': { MaterialIcons: 'Icon', Ionicons: 'Icon' },
    '@react-navigation/bottom-tabs': { BottomTabBar: 'BottomTabBar' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    '@/components/employer/EmployerTabBarSpacer': {
      default: 'EmployerTabBarSpacer', __esModule: true,
      EMPLOYER_TAB_BAR_HEIGHT: 74, EMPLOYER_POST_TAB_LIFT: 22,
      getEmployerTabBarHeight: bottom => 74 + 22 + Math.max(bottom, 12) + 8,
    },
    '@react-navigation/native': { useFocusEffect(callback) { if (callback !== focusCallback) { focusCallback = callback; effects.push(callback); } } },
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
      multiGet: async keys => keys.map(key => [key, storage.get(key) ?? null]),
    },
    'expo-router': {
      router: { push: value => navigation.push(value), replace: value => navigation.push(value) },
      useLocalSearchParams: () => ({ type }), useGlobalSearchParams: () => ({ type }),
    },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: { background: '#fff', surface: '#fff', primary: '#DC2626', accent: '#DC2626', border: '#ddd', text: '#000', textSecondary: '#555' }, isDark: false }) },
    '@/hooks/useToast': { useToast: () => ({ showToast() {} }) },
    '@/utils/hirerAccount': account,
    '@/utils/logoutStorage': { clearStorageForLogout: async () => {} },
    '@/api/axios': { get: async () => { if (offline) throw Error('Offline'); return { data: { status: 'success', profile: fresh, rating: 5, review_count: 0 } }; } },
    'expo-image-picker': {}, 'expo-document-picker': {},
    '@/utils/media': { resolveMediaUrl: value => value || null, mediaFilename: value => value?.split('/').pop() },
    '@/utils/documentAnalysis': load('utils/documentAnalysis.ts'),
    '@/utils/uploadRateLimit': { getUploadRateLimitNotice() {} },
    '@/utils/notifications': { clearPushToken() {} },
    '@/components/ui/Avatar': 'Avatar', '@/components/ui/SafeStatusBar': 'StatusBar',
    '@/components/ui/modals/LoadingModal': 'LoadingModal', '@/components/ui/modals/DocumentViewerModal': 'DocumentViewer',
    '@/components/ui/modals/NotificationModal': 'Notice', '@/components/ui/modals/SideDrawerMenu': 'Drawer',
    '@/components/ui/DrawerMenuButton': 'DrawerButton', '@/components/ui/haptic-tab': { HapticTab: 'HapticTab' },
    '@/constants/colors': { Colors: { gray400: '#999' } },
    '@/hooks/useUnreadNotifications': { useUnreadNotifications: () => ({ unreadMessagesCount: 0 }) },
  };
  // Functions stand in for Tabs so its static Screen property survives transpilation.
  dependencies['expo-router'].Tabs = Object.assign(function Tabs() {}, { Screen: 'TabScreen' });
  const Screen = load(layout ? 'app/employer/(tabs)/_layout.tsx' : 'app/employer/(tabs)/profile.tsx', dependencies, { setInterval: () => 1, clearInterval() {} }).default;
  const app = {
    storage, navigation,
    render() { cursor = 0; tree = Screen(); return tree; },
    get tree() { return tree; },
    async flush() { while (effects.length) effects.shift()(); await new Promise(setImmediate); app.render(); },
  };
  app.render();
  return app;
}

test('account role wins over missing or stale route params; profile fields support legacy caches', () => {
  assert.equal(account.resolveHirerAccountType({ role: 'household' }, {}, 'business'), 'household');
  assert.equal(account.resolveHirerAccountType({ role: 'employer' }, {}, 'household'), 'business');
  assert.equal(account.resolveHirerAccountType(null, { household_name: '' }), 'household');
  assert.equal(account.resolveHirerAccountType(null, { employer_name: 'Shop' }), 'business');
  assert.equal(account.resolveHirerAccountType(null, null), null);
  assert.equal(account.resolveHirerAccountType('{bad json', '{bad json'), null);
});

test('household profile without a type param displays its actual name and hides business-only sections', async () => {
  const app = fixture();
  assert.doesNotMatch(text(app.tree), /Business profile|Business Name/);
  await app.flush();
  assert.match(text(app.tree), /Household profile/);
  assert.match(text(app.tree), /Household owner/);
  assert.doesNotMatch(text(app.tree), /Business profile|Business Permit|Basic\s+plan|Business information/);
  assert.equal(find(app.tree, node => node.type === 'Drawer').props.user.role, 'household');
});

test('offline household cache still overrides a stale business route', async () => {
  const app = fixture({ user: { id: 3, email: 'household@example.test' }, type: 'business', offline: true });
  await app.flush();
  assert.match(text(app.tree), /Household profile/);
  assert.match(text(app.tree), /Household owner/);
  assert.doesNotMatch(text(app.tree), /Business Permit|Basic\s+plan/);
});

test('fresh household profile corrects stale cached role and stores it for subsequent navigation', async () => {
  const app = fixture({ user: { id: 3, role: 'employer' }, profile: { employer_name: 'Stale business' }, fresh: { user_id: 3, household_name: 'Correct household', isVerified: 1 }, type: 'business' });
  await app.flush();
  assert.match(text(app.tree), /Household profile/);
  assert.match(text(app.tree), /Correct household/);
  assert.doesNotMatch(text(app.tree), /Stale business|Business Permit|Basic\s+plan/);
  assert.equal(JSON.parse(app.storage.get('userData')).role, 'household');
});

test('corrupt cached profile does not prevent fresh API role detection', async () => {
  const app = fixture({ user: { id: 3 }, profile: '{bad json', fresh: { household_name: 'Fresh household', isVerified: 1 } });
  await app.flush();
  assert.match(text(app.tree), /Household profile/);
  assert.match(text(app.tree), /Fresh household/);
});

test('business accounts retain their name, permit and plan despite a stale household route', async () => {
  const app = fixture({ user: { id: 3, role: 'employer' }, profile: { employer_name: 'Local shop', isVerified: 1 }, type: 'household' });
  await app.flush();
  assert.match(text(app.tree), /Business profile/);
  assert.match(text(app.tree), /Local shop/);
  assert.match(text(app.tree), /Business Permit/);
  assert.match(text(app.tree), /Basic\s+plan/);
});

test('household tab navigation preserves the authenticated type on Profile and Post', async () => {
  const app = fixture({ layout: true, type: 'business' });
  assert.equal(find(app.tree, node => node.type === 'TabScreen'), undefined, 'Tabs must not capture a business default before the account loads');
  await app.flush();
  const profile = find(app.tree, node => node.props?.name === 'profile');
  assert.equal(profile.props.initialParams.type, 'household');
  profile.props.listeners.tabPress({ preventDefault() {} });
  find(app.tree, node => node.props?.name === 'post').props.listeners.tabPress({ preventDefault() {} });
  assert.deepEqual(app.navigation, ['/employer/profile?type=household', '/employer/job-posting?type=household']);
});

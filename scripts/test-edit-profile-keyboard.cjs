/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const fieldLabel = value => String(value || '').replace(/, required$/, '').replace(/\*/g, '').trim().toLowerCase()
  .replace('detailed street address / landmark', 'street address / landmark');

function load(relative, dependencies, scheduler = false) {
  const filename = path.join(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.require = name => { assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name]; };
  loaded._compile((scheduler ? 'const requestAnimationFrame = require("testScheduler").request; const cancelAnimationFrame = require("testScheduler").cancel;\n' : '') + ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

async function fixture({ role = 'student', isDark = false, platform = 'android' } = {}) {
  const slots = [], effects = [], events = [], posts = [], scrolls = [], frames = new Map(), listeners = new Map();
  let cursor = 0, tree, frameId = 0, keyboardY;
  const profile = { first_name: 'Juan', middle_name: '', last_name: 'Cruz', hirer_name: 'Juan Cruz', household_name: 'Juan Cruz', employer_name: 'Store', school: 'College', course: 'IT', year_level: '3rd Year', contact_number: '09123456789', detailed_address: 'Zone 1', location: 'Pinamalayan' };
  const storage = new Map([['userData', JSON.stringify({ id: 1, role, email: 'juan@example.test' })], ['userProfile', JSON.stringify(profile)]]);
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) { const index = cursor++; slots[index] ??= { value: initial }; return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { deps, callback }; return slots[index].callback; },
    useEffect(callback, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) { const previous = slots[index]; slots[index] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); }); } },
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { View: 'View', Text: 'Text', TextInput: 'NativeInput', ScrollView: 'ScrollView', TouchableOpacity: 'Button', KeyboardAvoidingView: 'AvoidKeyboard', ActivityIndicator: 'Spinner', Platform: { OS: platform }, Keyboard: {
      metrics: () => keyboardY === undefined ? undefined : { screenY: keyboardY }, dismiss: () => events.push('dismiss'),
      addListener(name, callback) { listeners.set(name, callback); return { remove: () => listeners.delete(name) }; },
    } },
    testScheduler: { request: callback => { frames.set(++frameId, callback); return frameId; }, cancel: id => frames.delete(id) },
    '@expo/vector-icons': { MaterialIcons: 'Icon' }, 'expo-router': { router: { back: () => events.push('back') } },
    '@react-native-async-storage/async-storage': { getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) },
    '@/api/axios': { get: async () => ({ data: { profile } }), post: async (url, body) => { posts.push({ url, body }); return { data: { status: 'success', profile } }; } },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ isDark, colors: { background: isDark ? '#111827' : '#fff', surface: isDark ? '#1f2937' : '#fff', text: isDark ? '#fff' : '#111', textSecondary: '#888', primary: '#dc2626', accent: '#ef4444', border: '#555' } }) },
    '@/hooks/useToast': { useToast: () => ({ showToast: () => events.push('toast') }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 28, bottom: 24 }) },
  };
  for (const [name, stub] of Object.entries({
    '@/components/ui/SafeStatusBar': 'StatusBar', '@/components/ui/InputField': 'Input', '@/components/ui/PrimaryButton': 'Save',
    '@/components/ui/modals/NotificationModal': 'Notification', '@/components/ui/modals/LocationPickerModal': 'Location',
    '@/components/student/modals/CourseModal': 'Course', '@/components/student/modals/YearLevelModal': 'Year', '@/components/employer/modals/BusinessTypeModal': 'Business',
  })) dependencies[name] = stub;
  dependencies['@/hooks/useRegistrationKeyboard'] = load('hooks/useRegistrationKeyboard.ts', dependencies, true);
  // Preview uses extracted profile forms; development also supports its inline form.
  if (fs.existsSync(path.join(__dirname, '../components/student/StudentProfileForm.tsx'))) {
    dependencies['@/components/ui/profile/ProfileFormFields'] = load('components/ui/profile/ProfileFormFields.tsx', dependencies);
    dependencies['@/components/student/StudentProfileForm'] = load('components/student/StudentProfileForm.tsx', dependencies).default;
    dependencies['@/components/employer/profile/HirerProfileForm'] = load('components/employer/profile/HirerProfileForm.tsx', dependencies).default;
  }
  const Screen = load('app/edit-profile.tsx', dependencies).default;
  const nodes = [];
  function mount(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(mount); return; }
    if (typeof node.type === 'function') { mount(node.type(node.props)); return; }
    nodes.push(node);
    if (node.type === 'ScrollView') node.props.ref.current = {
      getNativeScrollRef: () => ({ measureInWindow: callback => callback(0, 150, 400, 500) }),
      scrollTo: options => scrolls.push(options),
    };
    if (node.type === 'Input' || node.type === 'NativeInput') (node.props.inputRef || node.props.ref)?.({
      focus: () => { events.push(`focus ${fieldLabel(node.props.label || node.props.accessibilityLabel)}`); node.props.onFocus?.({}); },
      measureInWindow: callback => callback(0, 600, 300, 52),
    });
    mount(node.props?.children);
  }
  const app = {
    events, posts, scrolls,
    render() { cursor = 0; nodes.length = 0; tree = Screen(); mount(tree); effects.splice(0).forEach(effect => effect()); return app; },
    async settle() { for (let i = 0; i < 8; i++) { app.render(); await new Promise(setImmediate); } return app; },
    input(label) { return nodes.find(node => ['Input', 'NativeInput'].includes(node.type) && fieldLabel(node.props.label || node.props.accessibilityLabel) === fieldLabel(label)).props; },
    fields() { return nodes.filter(node => ['Input', 'NativeInput'].includes(node.type)).map(node => fieldLabel(node.props.label || node.props.accessibilityLabel)); },
    node(type) { return nodes.find(node => node.type === type || (type === 'Save' && node.props.accessibilityLabel === 'Save profile changes'))?.props; },
    showKeyboard(y) { keyboardY = y; listeners.get('keyboardDidShow')({ endCoordinates: { screenY: y } }); const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    stop() { slots.forEach(slot => slot?.cleanup?.()); },
  };
  return app.settle();
}

for (const isDark of [false, true]) {
  test(`student ${isDark ? 'dark' : 'light'}: Next advances names and phone, opens course, and Done never auto-saves`, async () => {
    const app = await fixture({ isDark });
    app.input('First Name').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus middle name (optional)');
    app.input('Middle Name (Optional)').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus last name');
    const schoolFirst = app.fields().indexOf('college / university') < app.fields().indexOf('contact number');
    app.input('Last Name').onSubmitEditing(); assert.equal(app.events.at(-1), schoolFirst ? 'focus college / university' : 'focus contact number');
    if (!schoolFirst) { app.input('Contact Number').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus college / university'); }
    app.input('College / University').onSubmitEditing(); app.render(); assert.equal(app.node('Course').visible, true);
    if (schoolFirst) { app.input('Contact Number').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus street address / landmark'); }
    assert.equal(app.input('Detailed Street Address / Landmark').returnKeyType, 'done');
    app.input('Detailed Street Address / Landmark').onSubmitEditing(); assert.equal(app.events.at(-1), 'dismiss');
    assert.equal(app.posts.length, 0);
    app.stop();
  });
}

test('focused address scrolls above the keyboard using the viewport below the fixed profile header', async () => {
  const app = await fixture();
  app.input('Detailed Street Address / Landmark').onFocus();
  app.showKeyboard(480);
  assert.deepEqual(app.scrolls.at(-1), { y: 196, animated: true });
  app.node('ScrollView').onScroll({ nativeEvent: { contentOffset: { y: 196 } } });
  app.input('First Name').onFocus();
  assert.deepEqual(app.scrolls.at(-1), { y: 392, animated: true }, 'focus is remeasured even while the keyboard remains open');
  app.stop();
});

for (const role of ['employer', 'household']) {
  test(`${role}: shared edit form keeps keyboard navigation and finishes without submitting`, async () => {
    const app = await fixture({ role });
    if (role === 'employer') { app.input('Business / company name').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus first name'); }
    app.input('First name').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus middle name (optional)');
    app.input('Middle name (optional)').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus last name');
    app.input('Last name').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus contact number');
    app.input('Contact number').onSubmitEditing(); assert.equal(app.events.at(-1), 'focus street address / landmark');
    app.input('Street address / landmark').onSubmitEditing(); assert.equal(app.events.at(-1), 'dismiss');
    assert.equal(app.posts.length, 0);
    app.stop();
  });
}

test('iOS uses keyboard padding while Android uses a resizing container', async () => {
  for (const platform of ['ios', 'android']) {
    const app = await fixture({ platform });
    assert.equal(app.node('AvoidKeyboard').behavior, platform === 'ios' ? 'padding' : 'height');
    app.stop();
  }
});

test('profile save retains its endpoint and field values after keyboard navigation', async () => {
  const app = await fixture();
  app.input('Contact Number').onChangeText('09987654321');
  app.render(); await app.node('Save').onPress();
  assert.equal(app.posts[0].url, '/user/update-profile');
  assert.equal(app.posts[0].body.first_name, 'Juan');
  assert.equal(app.posts[0].body.contact_number, '09987654321');
  assert.equal(app.posts[0].body.phone_number, '09987654321');
  assert.equal(app.events.at(-1), 'back');
  app.stop();
});

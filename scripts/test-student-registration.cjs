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
  loaded.require = name => {
    if (name.startsWith('@/components/')) return name.split('/').pop();
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

function harness(role = 'student') {
  const slots = []; let cursor = 0;
  const toasts = []; const calls = []; const events = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect() {},
    useCallback(callback) { return callback; },
  };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Text: 'Text', View: 'View', TextInput: 'TextInput', TouchableOpacity: 'Button',
      Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) },
      Alert: { alert: (...args) => events.push(args) } },
    'expo-router': { router: { back() {}, replace() {} } },
    '@expo/vector-icons': { MaterialIcons: 'Icon' }, '@/constants/colors': { Colors: {} },
    '@/hooks/useToast': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
    '@/utils/phoneNumber': load('utils/phoneNumber.ts', {}),
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: { border: '#CCC' }, isDark: false }) },
    '@/api/axios': { post: async (...args) => { calls.push(args); return { data: { status: 'success', user: {} } }; } },
    '@react-native-async-storage/async-storage': { setItem: async () => {} },
  };
  dependencies['@/hooks/useRegistrationKeyboard'] = load('hooks/useRegistrationKeyboard.ts', dependencies);
  const screen = load(`app/auth/${role}-register.tsx`, dependencies).default;
  let nodes;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    nodes.push(node); walk(node.props?.children);
  }
  function text(node) {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(text).join('');
    return node?.props ? text(node.props.children) : '';
  }
  const app = {
    toasts, calls, events, dependencies,
    render() { cursor = 0; nodes = []; walk(screen()); return app; },
    find(type) { app.render(); return nodes.find(node => node.type === type); },
    field(label) { app.render(); return nodes.find(node => node.type === 'InputField' && node.props.label === label)?.props; },
    input(label, value) { const field = app.field(label); assert.ok(field, label); field.onChangeText(value); },
    next() { app.render(); nodes.find(node => node.type === 'Button' && text(node) === 'NEXT').props.onPress(); },
    step() { return app.find('BaseRegisterScreen').props.step; },
    readyForAccount() {
      app.input('First Name', 'Juan'); app.input('Last Name', 'Santos');
      if (role === 'employer') {
        app.input('Business Name', 'Test Business'); app.find('BusinessTypeModal').props.onSelect('Retail');
      } else {
        app.input('Age', '18'); app.find('GenderModal').props.onSelect('Male');
      }
      if (role === 'student') {
        app.input('Phone Number', '09123456789');
        app.find('LocationPickerModal').props.onSelectLocation({ address: 'Pinamalayan', latitude: 13.03, longitude: 121.48 });
        app.next(); assert.equal(app.step(), 2);
        app.input('School Name', 'Test School'); app.find('CourseModal').props.onSelect('BSIT');
        app.find('YearLevelModal').props.onSelect('4th Year');
      } else {
        app.next(); assert.equal(app.step(), 2);
        app.input('Phone Number', '09123456789');
        app.find('LocationPickerModal').props.onSelectLocation({ address: 'Pinamalayan', latitude: 13.03, longitude: 121.48 });
      }
      app.next(); assert.equal(app.step(), 3);
    },
  };
  return app;
}

for (const role of ['student', 'employer', 'household']) {
  test(`${role}: switching roles preserves entered information until explicitly confirmed`, () => {
    const app = harness(role);
    const routes = [];
    app.dependencies['expo-router'].router.replace = route => routes.push(route);
    const BaseRegisterScreen = load('components/ui/BaseRegisterScreen.tsx', {
      ...app.dependencies,
      'react-native': { ...app.dependencies['react-native'], Platform: { OS: 'android' },
        useWindowDimensions: () => ({ width: 400 }), ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView' },
      '@react-navigation/native': { useIsFocused: () => true },
      'expo-status-bar': { StatusBar: 'StatusBar' },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    }).default;
    function findInBase(predicate, override = {}) {
      const tree = BaseRegisterScreen({ ...app.find('BaseRegisterScreen').props, ...override });
      const visit = node => {
        if (!node || typeof node !== 'object') return undefined;
        if (Array.isArray(node)) return node.map(visit).find(Boolean);
        return predicate(node) ? node : visit(node.props?.children);
      };
      return visit(tree).props;
    }
    const tab = label => findInBase(node => node.props?.label === label);
    const dialog = () => findInBase(node => node.type === 'NotificationModal' && node.props.title === 'Switch account type?');
    const otherRole = role === 'student' ? 'employer' : 'student';
    const otherLabel = otherRole === 'student' ? 'Student' : 'Employer';
    const currentLabel = role[0].toUpperCase() + role.slice(1);

    assert.equal(app.find('BaseRegisterScreen').props.hasUnsavedChanges, false);
    tab(currentLabel).onPress(); assert.equal(routes.length, 0);
    tab(otherLabel).onPress(); assert.deepEqual(routes, [`/auth/${otherRole}-register`]);
    routes.length = 0;
    app.input('First Name', 'Juan');
    assert.equal(app.find('BaseRegisterScreen').props.hasUnsavedChanges, true);
    tab(currentLabel).onPress(); assert.equal(dialog().visible, false);
    for (const cancel of ['onPrimaryPress', 'onBackdropPress', 'onRequestClose']) {
      tab(otherLabel).onPress(); assert.equal(dialog().visible, true);
      assert.equal(routes.length, 0);
      assert.equal(dialog().primaryButtonText, 'Stay');
      dialog()[cancel](); assert.equal(dialog().visible, false);
      assert.equal(app.field('First Name').value, 'Juan');
    }
    findInBase(node => node.props?.label === otherLabel, { submitting: true }).onPress();
    assert.equal(dialog().visible, false); assert.equal(routes.length, 0);
    tab(otherLabel).onPress(); dialog().onSecondaryPress();
    assert.deepEqual(routes, [`/auth/${otherRole}-register`]);
    assert.equal(dialog().visible, false);
  });
}

test('personal fields validate before Next, clear after correction, and do not emit typing toasts', () => {
  const app = harness();
  for (const label of ['First Name', 'Last Name', 'Age', 'Phone Number']) assert.equal(app.field(label).error, undefined);
  app.field('First Name').onBlur(); assert.match(app.field('First Name').error, /required/);
  app.input('First Name', 'Juan'); assert.equal(app.field('First Name').error, '');
  app.input('Age', '17'); assert.match(app.field('Age').error, /18/);
  app.input('Age', '18'); assert.equal(app.field('Age').error, '');
  app.input('Phone Number', '08123456789'); assert.match(app.field('Phone Number').error, /starting with 09/);
  app.input('Phone Number', '09123'); assert.match(app.field('Phone Number').error, /11-digit/);
  app.input('Phone Number', '09123456789'); assert.equal(app.field('Phone Number').error, '');
  app.input('Phone Number', '0912abc3456789123'); assert.equal(app.field('Phone Number').value, '09123456789');
  assert.equal(app.field('Phone Number').maxLength, 11);
  assert.equal(app.step(), 1); assert.equal(app.toasts.length, 0); assert.equal(app.events.length, 0);
});

for (const role of ['student', 'employer', 'household']) {
test(`${role}: account fields show live errors and password confirmation follows password edits`, async () => {
  const app = harness(role); app.readyForAccount();
  app.input('Email Address', 'not-an-email'); assert.match(app.field('Email Address').error, /valid email/);
  app.input('Password', 'short'); assert.match(app.field('Password').error, /requirements/);
  app.input('Password', 'Password123!'); assert.equal(app.field('Password').error, '');
  app.input('Confirm Password', 'different'); assert.match(app.field('Confirm Password').error, /not match/);
  app.input('Confirm Password', 'Password123!'); assert.equal(app.field('Confirm Password').error, '');
  app.input('Password', 'Changed123!'); assert.match(app.field('Confirm Password').error, /not match/);
  await app.find('PrimaryButton').props.onPress(); assert.equal(app.calls.length, 0);
  app.input('Email Address', ' student@example.com '); assert.equal(app.field('Email Address').error, '');
  app.input('Confirm Password', 'Changed123!');
  await app.find('PrimaryButton').props.onPress();
  assert.equal(app.calls.length, 1); assert.equal(app.calls[0][1].email, 'student@example.com');
  assert.equal(app.calls[0][0], `/register/${role}`);
});
}

test('blank school names are visible on blur and cannot advance the school step', () => {
  const app = harness(); app.readyForAccount();
  app.find('BaseRegisterScreen').props.onBack(); assert.equal(app.step(), 2);
  app.input('School Name', '   '); app.field('School Name').onBlur();
  assert.match(app.field('School Name').error, /required/);
  app.next(); assert.equal(app.step(), 2);
  app.input('School Name', 'Test School'); assert.equal(app.field('School Name').error, '');
});

test('InputField forwards both focus and blur events', () => {
  const app = harness(); const input = load('components/ui/InputField.tsx', app.dependencies).default;
  let focus = 0; let blur = 0;
  const props = { onFocus: () => focus++, onBlur: () => blur++ };
  const wrapper = input(props); const native = wrapper.props.children[1].props.children.find(node => node?.type === 'TextInput');
  native.props.onFocus({}); native.props.onBlur({});
  assert.equal(focus, 1); assert.equal(blur, 1);
});

test('keyboard Next focuses the next input and Done does not submit registration', () => {
  const app = harness(); const focused = [];
  for (const label of ['First Name', 'Middle Name (Optional)', 'Last Name', 'Age', 'Phone Number', 'Street, Barangay']) {
    app.field(label).inputRef({ focus: () => focused.push(label) });
  }
  const fields = ['First Name', 'Middle Name (Optional)', 'Last Name', 'Age', 'Phone Number'];
  for (const label of fields) {
    assert.equal(app.field(label).returnKeyType, 'next');
    assert.equal(app.field(label).submitBehavior, 'submit');
    app.field(label).onSubmitEditing();
  }
  assert.deepEqual(focused, ['Middle Name (Optional)', 'Last Name', 'Age', 'Phone Number', 'Street, Barangay']);
  app.readyForAccount();
  for (const label of ['Email Address', 'Password', 'Confirm Password']) {
    app.field(label).inputRef({ focus: () => focused.push(label) });
  }
  app.field('Email Address').onSubmitEditing(); app.field('Password').onSubmitEditing();
  assert.deepEqual(focused.slice(-2), ['Password', 'Confirm Password']);
  assert.equal(app.field('Confirm Password').returnKeyType, 'done');
  app.field('Confirm Password').onSubmitEditing(); assert.equal(app.calls.length, 0);
});

test('focusing an input requests scroll space above the keyboard', () => {
  const app = harness(); const scrolls = [];
  app.find('BaseRegisterScreen').props.scrollViewRef.current = {
    getNativeScrollRef: () => ({ measureInWindow: callback => callback(0, 24, 400, 480) }),
    scrollTo: options => scrolls.push(options),
  };
  app.field('Phone Number').inputRef({ measureInWindow: callback => callback(0, 460, 200, 52) });
  app.field('Phone Number').onFocus({ nativeEvent: { target: 42 } });
  assert.deepEqual(scrolls, [{ y: 32, animated: true }]);
});

for (const role of ['employer', 'household']) {
  test(`${role}: required fields and phone errors appear before Next and clear after correction`, () => {
    const app = harness(role);
    assert.equal(app.field('First Name').error, undefined);
    app.field('First Name').onBlur(); assert.match(app.field('First Name').error, /required/);
    app.input('First Name', 'Juan'); assert.equal(app.field('First Name').error, '');
    if (role === 'employer') {
      app.input('Business Name', '   '); assert.match(app.field('Business Name').error, /required/);
    } else {
      app.input('Age', 'abc'); assert.match(app.field('Age').error, /valid age/);
      app.input('Age', '18'); assert.equal(app.field('Age').error, '');
    }
    assert.equal(app.toasts.length, 0);
    app.readyForAccount(); app.find('BaseRegisterScreen').props.onBack();
    assert.equal(app.step(), 2);
    app.input('Phone Number', '08123456789'); assert.match(app.field('Phone Number').error, /starting with 09/);
    app.next(); assert.equal(app.step(), 2);
    app.input('Phone Number', '09123456789'); assert.equal(app.field('Phone Number').error, '');
    app.next(); assert.equal(app.step(), 3);
  });

  test(`${role}: Next moves between inputs, scrolls to focus, and Done does not create an account`, () => {
    const app = harness(role); const focused = []; const scrolls = [];
    app.field('Middle Name (Optional)').inputRef({ focus: () => focused.push('middle') });
    app.field('Last Name').inputRef({ focus: () => focused.push('last') });
    app.field('First Name').onSubmitEditing(); app.field('Middle Name (Optional)').onSubmitEditing();
    assert.deepEqual(focused, ['middle', 'last']);
    app.readyForAccount();
    app.find('BaseRegisterScreen').props.scrollViewRef.current = {
      getNativeScrollRef: () => ({ measureInWindow: callback => callback(0, 24, 400, 480) }),
      scrollTo: options => scrolls.push(options),
    };
    app.field('Password').inputRef({ focus: () => focused.push('password') });
    app.field('Confirm Password').inputRef({ focus: () => focused.push('confirm'), measureInWindow: callback => callback(0, 500, 200, 52) });
    app.field('Email Address').onSubmitEditing(); app.field('Password').onSubmitEditing();
    assert.deepEqual(focused.slice(-2), ['password', 'confirm']);
    app.field('Confirm Password').onFocus({ nativeEvent: { target: 52 } });
    assert.deepEqual(scrolls, [{ y: 72, animated: true }]);
    assert.equal(app.field('Confirm Password').returnKeyType, 'done');
    app.field('Confirm Password').onSubmitEditing(); assert.equal(app.calls.length, 0);
  });
}

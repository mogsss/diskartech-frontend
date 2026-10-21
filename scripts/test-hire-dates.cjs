// Run with: node scripts/test-hire-dates.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const filename = path.join(__dirname, '..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console, setTimeout, clearTimeout, require: name => {
    assert.ok(name in dependencies, `Unmocked dependency: ${name}`);
    return dependencies[name];
  } }, { filename });
  return exports;
}

function fixture() {
  const hooks = [];
  const submissions = [];
  const listeners = new Map();
  const nativeRefs = new Map();
  const scrolls = [];
  const measurements = { modalHeight: 800, viewportY: 200, viewportHeight: 300, inputY: 650, inputHeight: 100 };
  let cursor = 0, dirty = false, effects = [], tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useRef(initial) {
      const i = cursor++;
      if (!hooks[i]) hooks[i] = { current: initial };
      return hooks[i];
    },
    useState(initial) {
      const i = cursor++;
      if (!hooks[i]) {
        hooks[i] = { value: typeof initial === 'function' ? initial() : initial, set(next) {
          const value = typeof next === 'function' ? next(hooks[i].value) : next;
          if (!Object.is(value, hooks[i].value)) { hooks[i].value = value; dirty = true; }
        } };
      }
      return [hooks[i].value, hooks[i].set];
    },
    useEffect(callback, deps) {
      const i = cursor++;
      if (!same(hooks[i]?.deps, deps)) { hooks[i] = { deps }; effects.push(callback); }
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!same(hooks[i]?.deps, deps)) hooks[i] = { deps, callback };
      return hooks[i].callback;
    },
  };
  const jsx = (type, props) => {
    if (props.ref) {
      if (!nativeRefs.has(props.ref)) nativeRefs.set(props.ref, {
        props,
        measureInWindow(callback) {
          if (type === 'TextInput') callback(0, measurements.inputY, 300, measurements.inputHeight);
          else if (props.style?.backgroundColor) callback(0, 0, 400, measurements.modalHeight);
          else callback(0, measurements.viewportY, 400, measurements.viewportHeight);
        },
        scrollTo({ y }) {
          const previous = scrolls.at(-1) ?? 0;
          scrolls.push(y);
          measurements.inputY -= y - previous;
          this.props.onScroll?.({ nativeEvent: { contentOffset: { y } } });
        },
      });
      props.ref.current = nativeRefs.get(props.ref);
      props.ref.current.props = props;
    }
    return { type, props };
  };
  const HireModal = load('components/employer/modals/HireModal.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': {
      ...Object.fromEntries(['Modal', 'View', 'Text', 'TextInput', 'TouchableOpacity', 'ScrollView', 'KeyboardAvoidingView', 'ActivityIndicator'].map(name => [name, name])),
      Platform: { OS: 'android' }, Keyboard: { dismiss() {}, addListener(name, callback) {
        listeners.set(name, callback);
        return { remove: () => listeners.delete(name) };
      } },
    },
    '@expo/vector-icons': { MaterialIcons: 'Icon' },
    '@react-native-community/datetimepicker': { default: 'DatePicker' },
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: {}, isDark: false }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/data/jobSchedule': load('data/jobSchedule.ts'),
    '@/utils/jobRate': load('utils/jobRate.ts'),
    '@/utils/plainTextInput': load('utils/plainTextInput.ts'),
    '@/components/ui/modals/NotificationModal': { default: 'Notification' },
    '@/components/schedule/WeeklyScheduleSummary': { default: 'WeeklyScheduleSummary' },
    axios: { isAxiosError: () => false },
  }).default;
  const render = () => {
    for (let pass = 0; pass < 10; pass++) {
      cursor = 0; dirty = false; effects = [];
      // A fresh array simulates the application's background API polling.
      tree = HireModal({ visible: true, defaultRate: '200', defaultWorkDays: ['Mon'], defaultWorkHours: 'Whole Day', onSubmit: data => submissions.push(data), onClose() {} });
      effects.forEach(effect => effect());
      if (!dirty) return;
    }
    throw Error('Render did not settle');
  };
  function find(predicate, node) {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) return node.map(child => find(predicate, child)).find(Boolean);
    if (predicate(node)) return node;
    return find(predicate, node.props?.children);
  }
  render();
  return {
    render, submissions, measurements, scrolls,
    keyboard: (name, screenY) => listeners.get(name)?.({ endCoordinates: { screenY } }),
    keyboardPadding: () => find(node => node.props?.style?.justifyContent === 'flex-end', tree).props.style.paddingBottom,
    field: name => find(node => node.props?.accessibilityLabel === name, tree),
    picker: () => find(node => node.type === 'DatePicker', tree), notice: () => find(node => node.type === 'Notification', tree),
  };
}

const event = type => ({ type });
function future(days) { const date = new Date(); date.setDate(date.getDate() + days); date.setHours(0, 0, 0, 0); return date; }
const label = date => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

test('confirmed start/end dates survive polling, typing, reopening, cancellation and submission', async () => {
  const screen = fixture();
  const dates = [future(7), future(14)];
  for (const [i, field] of ['Select contract start date', 'Select contract end date'].entries()) {
    screen.field(field).props.onPress(); screen.render();
    const original = screen.picker().props;
    for (let poll = 0; poll < 5; poll++) {
      screen.render();
      assert.equal(screen.picker().props.onChange, original.onChange, 'Polling must not reopen/reset the Android picker');
      assert.equal(screen.picker().props.value.getTime(), original.value.getTime());
    }
    original.onChange(event('set'), dates[i]); screen.render();
    assert.equal(screen.picker(), undefined);
    screen.field(field).props.onPress(); screen.render();
    assert.equal(screen.picker().props.value.getTime(), dates[i].getTime());
    screen.picker().props.onChange(event('dismissed'), new Date()); screen.render();
  }
  screen.field('Agreed compensation in pesos per day').props.onChangeText('250'); screen.render();
  await screen.field('Accept and hire student').props.onPress();
  assert.equal(screen.submissions.length, 1);
  assert.equal(screen.submissions[0].start_date, label(dates[0]));
  assert.equal(screen.submissions[0].end_date, label(dates[1]));
  assert.equal(screen.submissions[0].agreed_rate, '250');
});

test('cancelling an unselected start date does not silently select today', async () => {
  const screen = fixture();
  screen.field('Select contract start date').props.onPress(); screen.render();
  screen.picker().props.onChange(event('dismissed'), new Date()); screen.render();
  await screen.field('Accept and hire student').props.onPress(); screen.render();
  assert.equal(screen.submissions.length, 0);
  assert.equal(screen.notice().props.title, 'Start Date Required');
});

test('end picker opens at the minimum start date, but cancelling cannot change a saved end date', async () => {
  const screen = fixture();
  screen.field('Select contract end date').props.onPress(); screen.render();
  screen.picker().props.onChange(event('set'), future(3)); screen.render();
  screen.field('Select contract start date').props.onPress(); screen.render();
  const start = future(7);
  screen.picker().props.onChange(event('set'), start); screen.render();
  screen.field('Select contract end date').props.onPress(); screen.render();
  assert.equal(screen.picker().props.value.getTime(), start.getTime());
  assert.equal(screen.picker().props.minimumDate.getTime(), start.getTime());
  screen.picker().props.onChange(event('dismissed'), start); screen.render();
  await screen.field('Accept and hire student').props.onPress(); screen.render();
  assert.equal(screen.submissions.length, 0);
  assert.equal(screen.notice().props.title, 'Invalid End Date');
});

test('instructions scroll above the keyboard; already resized Android modals get no duplicate inset', async () => {
  for (const modalHeight of [800, 500]) {
    const screen = fixture();
    screen.measurements.modalHeight = modalHeight;
    screen.field('First-day instructions').props.onFocus();
    screen.keyboard('keyboardDidShow', 500); screen.render();
    assert.equal(screen.keyboardPadding(), modalHeight - 500);
    await new Promise(resolve => setTimeout(resolve, 130));
    assert.equal(screen.scrolls.at(-1), 266);
    assert.ok(screen.measurements.inputY + screen.measurements.inputHeight <= 484);
    screen.keyboard('keyboardDidHide'); screen.render();
    assert.equal(screen.keyboardPadding(), 0);
  }
});

test('plain text normalization retains names, bullets, punctuation and newlines', () => {
  const { sanitizePlainText, containsMarkup, isValidCompensation } = load('utils/plainTextInput.ts');
  assert.equal(sanitizePlainText("  • Juan's ID\r\nRésumé\u0000\u202E  "), "• Juan's ID\nRésumé");
  assert.equal(containsMarkup('Bring <script>alert(1)</script>'), true);
  assert.equal(containsMarkup('&lt;img src=x&gt;'), true);
  assert.equal(containsMarkup('Arrive <5 minutes late & bring an ID.'), false);
  for (const rate of ['-1', '0', '1e3', '1.2.3', '250.999', 'Infinity', '1234567890']) assert.equal(isValidCompensation(rate), false);
  for (const rate of ['1', '250.50', '0.01']) assert.equal(isValidCompensation(rate), true);
});

test('hire submission blocks unsafe contract text and zero compensation', async () => {
  for (const [field, value, title] of [
    ['First-day instructions', '<script>alert(1)</script>', 'Invalid Text'],
    ['Contract terms and termination conditions', '&lt;img src=x&gt;', 'Invalid Text'],
    ['Contract terms and termination conditions', ' ', 'Invalid Contract Details'],
    ['Agreed compensation in pesos per day', '0', 'Invalid Compensation'],
  ]) {
    const screen = fixture();
    screen.field('Select contract start date').props.onPress(); screen.render();
    screen.picker().props.onChange(event('set'), future(7)); screen.render();
    screen.field(field).props.onChangeText(value); screen.render();
    await screen.field('Accept and hire student').props.onPress(); screen.render();
    assert.equal(screen.submissions.length, 0);
    assert.equal(screen.notice().props.title, title);
  }
});

test('cleaned instructions and terms reach the hiring API', async () => {
  const screen = fixture();
  screen.field('Select contract start date').props.onPress(); screen.render();
  screen.picker().props.onChange(event('set'), future(7)); screen.render();
  screen.field('First-day instructions').props.onChangeText("  Bring Juan's ID.\r\nRésumé\u0000  "); screen.render();
  screen.field('Contract terms and termination conditions').props.onChangeText('  • Give notice.\u202E  '); screen.render();
  await screen.field('Accept and hire student').props.onPress();
  assert.equal(screen.submissions[0].special_instructions, "Bring Juan's ID.\nRésumé");
  assert.equal(screen.submissions[0].contract_terms, '• Give notice.');
});

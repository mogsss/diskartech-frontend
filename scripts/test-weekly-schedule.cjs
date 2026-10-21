/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, dependencies = {}) {
  const exports = {};
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText;
  vm.runInNewContext(compiled, { exports, Date, console, require(name) { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return exports;
}
const weekly = load('utils/weeklySchedule.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const slot = (day = 'Mon', start = '09:00', end = '12:00', next = false) => ({ day_of_week: day, start_time: start, end_time: end, ends_next_day: next });
let dark = false;
const theme = () => ({ isDark: dark, colors: dark
  ? { background: '#0F172A', surface: '#1E293B', text: '#F8FAFC', textSecondary: '#94A3B8', border: '#334155', primary: '#DC2626' }
  : { background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A', textSecondary: '#64748B', border: '#E2E8F0', primary: '#DC2626' } });
const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');
function icon({ name, size, color }) {
  assert.ok(glyphs[name], name);
  return React.createElement('i', { style: { fontFamily: 'MaterialIcons', fontStyle: 'normal', fontSize: size, color } }, String.fromCodePoint(glyphs[name]));
}

function fixture(options = {}) {
  const states = [], refs = [], effects = [];
  let cursor = 0, refCursor = 0, tree, closed = 0;
  const saved = [];
  const hooks = { __esModule: true, default: React, ...React,
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(value) { const i = refCursor++; return refs[i] ||= { current: value }; },
    useEffect(callback) { effects.push(callback); },
  };
  const summary = load('components/schedule/WeeklyScheduleSummary.tsx', { react: hooks, 'react-native': { Text: 'span', View: 'div' }, '@/hooks/useDarkMode': { useDarkMode: theme }, '@/utils/weeklySchedule': weekly });
  const Native = { Modal: 'main', View: 'div', ScrollView: 'section', Text: 'span', TouchableOpacity: 'button', TextInput: 'input', Switch: 'input', ActivityIndicator: 'progress', Platform: { OS: 'web' } };
  const component = load('components/schedule/WeeklyScheduleModal.tsx', {
    react: hooks, 'react-native': Native, '@/hooks/useDarkMode': { useDarkMode: theme }, '@/utils/weeklySchedule': weekly,
    '@/hooks/useToast': { ToastViewport: () => null },
    '@expo/vector-icons': { MaterialIcons: icon }, '@react-native-community/datetimepicker': { __esModule: true, default: 'input', DateTimePickerAndroid: {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 20, bottom: 12 }) }, './WeeklyScheduleSummary': summary,
  }).default;
  const props = { visible: true, mode: options.mode || 'student', defaultToToday: options.defaultToToday, value: options.value || { days: [], slots: [] }, onClose() { closed++; }, async onSave(value) { saved.push(plain(value)); if (options.gate) await options.gate; return options.success !== false; } };
  function render() {
    cursor = refCursor = 0; effects.length = 0;
    tree = component(props);
    const calls = effects.splice(0); calls.forEach(fn => fn());
    return tree;
  }
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...React.Children.toArray(node.props?.children).flatMap(child => nodes(child))];
  }
  function text(node) { if (typeof node === 'string' || typeof node === 'number') return String(node); return node?.props ? React.Children.toArray(node.props.children).map(text).join('') : ''; }
  function click(label) {
    const node = nodes().find(n => n.type === 'button' && text(n) === label);
    assert.ok(node, 'Button exists: ' + label); assert.ok(!node.props.disabled, 'Button enabled: ' + label);
    const result = node.props.onPress(); render(); return result;
  }
  function press(label) {
    const node = nodes().find(n => n.props?.accessibilityLabel === label);
    assert.ok(node, 'Control exists: ' + label); assert.ok(!node.props.disabled, 'Control enabled: ' + label);
    const result = node.props.onPress(); render(); return result;
  }
  render(); render();
  return { render, click, press, nodes, text, states, props, saved, get closed() { return closed; }, get tree() { return tree; } };
}

test('today follows Philippine midnight and wraps Sunday into Monday', () => {
  assert.equal(weekly.currentScheduleDay(new Date('2026-10-25T15:59:59Z')), 'Sun');
  assert.equal(weekly.currentScheduleDay(new Date('2026-10-25T16:00:00Z')), 'Mon');
});

test('a new household schedule opens today and requires hours before saving', async () => {
  const today = weekly.currentScheduleDay();
  const value = { days: [], slots: [] };
  const f = fixture({ mode: 'job', defaultToToday: true, value });
  assert.deepEqual(plain(f.states[0]), { days: [today], slots: [] });
  assert.equal(f.nodes().filter(n => n.props?.accessibilityState?.expanded).length, 1);
  f.click('Use this schedule');
  assert.equal(f.saved.length, 0);
  const preset = f.nodes().find(n => n.props?.accessibilityRole === 'checkbox' && n.props.accessibilityLabel.startsWith('Morning,'));
  assert.ok(preset);
  preset.props.onPress(); f.render();
  f.click('Use this schedule'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.saved[0], { days: [today], slots: [slot(today, '06:00', '12:00')] });
  assert.deepEqual(value, { days: [], slots: [] });
});

test('today default preserves existing days and does not preselect business or student schedules', () => {
  const value = { days: ['Sun'], slots: [slot('Sun', '18:00', '22:00')] };
  const existing = fixture({ mode: 'job', defaultToToday: true, value });
  assert.deepEqual(plain(existing.states[0]), value);
  for (const options of [{ mode: 'job' }, { mode: 'student', defaultToToday: true }]) {
    assert.deepEqual(plain(fixture(options).states[0]), { days: [], slots: [] });
  }
  const cancelled = fixture({ mode: 'job', defaultToToday: true });
  cancelled.click('Cancel');
  assert.equal(cancelled.saved.length, 0);
  assert.deepEqual(cancelled.props.value, { days: [], slots: [] });
});

test('legacy days and presets load as independent ranges; unknown strings do not invent availability', () => {
  const draft = weekly.scheduleDraft([], '["Monday","Wed"]', 'Morning (6AM - 12PM) & Evening (6PM - 10PM)');
  assert.equal(draft.slots.length, 4);
  assert.deepEqual(plain(draft.days), ['Mon', 'Wed']);
  assert.equal(weekly.scheduleDraft([], ['Mon'], 'Custom saved hours').slots.length, 0);
  assert.equal(weekly.scheduleDraft([], ['Mon'], 'Morning 8AM to 10AM').slots.length, 0);
});
test('merging retains class gaps, joins adjacent hours, and whole day replaces covered ranges', () => {
  let slots = weekly.addScheduleSlot([slot()], slot('Mon', '13:00', '15:00'));
  assert.equal(slots.length, 2);
  slots = weekly.addScheduleSlot(slots, slot('Mon', '12:00', '13:00'));
  assert.deepEqual(plain(slots), [slot('Mon', '09:00', '15:00')]);
  assert.deepEqual(plain(weekly.addScheduleSlot(slots, slot('Mon', '00:00', '00:00', true))), [slot('Mon', '00:00', '00:00', true)]);
});
test('validation catches missing days, zero duration, long shifts, cross-week overlap, and too many ranges', () => {
  for (const value of [ { days: [], slots: [] }, { days: ['Tue'], slots: [] },
    { days: ['Mon'], slots: [slot('Mon', '15:00', '09:00')] },
    { days: ['Mon'], slots: [slot('Mon', '09:00', '10:00', true)] },
    { days: ['Mon'], slots: [slot('Mon', '09:00', '09:00')] },
    { days: ['Sun', 'Mon'], slots: [slot('Sun', '22:00', '06:00', true), slot('Mon', '05:00', '07:00')] },
  ]) assert.ok(weekly.scheduleError(value));
  assert.equal(weekly.scheduleError({ days: ['Sun'], slots: [slot('Sun', '22:00', '06:00', true)] }), null);
});
test('weekly list requires hours for each enabled day and saves exact custom times', async () => {
  const f = fixture();
  assert.equal(f.nodes().find(n => n.type === 'button' && f.text(n) === 'Save availability').props.disabled, true);
  f.press('Monday availability'); f.press('Wednesday availability'); f.press('Edit Monday hours');
  f.click('Choose exact hours');
  f.nodes().find(n => n.type === 'input' && n.props.accessibilityLabel === 'start time, HH:MM').props.onChangeText('09:30');
  f.nodes().find(n => n.type === 'input' && n.props.accessibilityLabel === 'end time, HH:MM').props.onChangeText('15:00');
  f.render(); f.click('Add hours');
  f.click('Save availability');
  assert.ok(f.nodes().some(n => n.props?.accessibilityRole === 'alert' && f.text(n).includes('Wed')));
  const morning = f.nodes().find(n => n.props?.accessibilityRole === 'checkbox' && n.props.accessibilityLabel.startsWith('Morning,'));
  assert.ok(morning.props.accessibilityLabel.endsWith('Wednesday'));
  morning.props.onPress(); f.render();
  f.click('Save availability'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.closed, 1); assert.equal(f.saved[0].slots.length, 2);
  assert.equal(f.saved[0].slots[0].start_time, '09:30');
});
test('copy requires explicit destinations and a failed save leaves the editor open', async () => {
  const f = fixture({ value: { days: ['Mon', 'Wed'], slots: [slot()] }, success: false });
  f.press('Edit Monday hours'); f.click('Same hours on other days'); f.press('Copy to Wednesday'); f.click('Apply hours');
  assert.equal(f.states[0].slots.length, 2);
  f.click('Save availability'); await new Promise(resolve => setImmediate(resolve)); f.render();
  assert.equal(f.closed, 0); assert.ok(f.nodes().some(n => n.props?.accessibilityRole === 'alert' && f.text(n).includes('not saved')));
});
test('cancel does not mutate the supplied schedule', () => {
  const value = { days: ['Mon'], slots: [slot()] }, before = JSON.stringify(value);
  const f = fixture({ value }); f.press('Tuesday availability'); f.click('Cancel');
  assert.equal(JSON.stringify(value), before); assert.equal(f.closed, 1);
});

test('custom overnight hours show the ending day and are saved without an extra toggle', async () => {
  const f = fixture(); f.press('Sunday availability'); f.click('Choose exact hours');
  f.nodes().find(n => n.props?.accessibilityLabel === 'start time, HH:MM').props.onChangeText('22:00');
  f.nodes().find(n => n.props?.accessibilityLabel === 'end time, HH:MM').props.onChangeText('06:00');
  f.render(); assert.ok(f.text(f.tree).includes('Ends on Monday at 6 AM.'));
  f.click('Add hours'); f.click('Save availability'); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.saved[0].slots, [slot('Sun', '22:00', '06:00', true)]);
});

test('copy can enable a new day only after an explicit destination and confirmation', () => {
  const f = fixture({ value: { days: ['Mon'], slots: [slot()] } });
  f.press('Edit Monday hours'); f.click('Same hours on other days');
  assert.equal(f.nodes().find(n => n.type === 'button' && f.text(n) === 'Apply hours').props.disabled, true);
  f.press('Copy to Saturday');
  assert.deepEqual(plain(f.states[0].days), ['Mon']);
  assert.equal(f.nodes().find(n => n.type === 'button' && f.text(n) === 'Save availability').props.disabled, true);
  f.click('Apply hours');
  assert.deepEqual(plain(f.states[0].days), ['Mon', 'Sat']);
  assert.equal(f.states[0].slots.filter(s => s.day_of_week === 'Sat').length, 1);
});

test('pending custom hours cannot be silently skipped by saving the weekly list', () => {
  const f = fixture({ value: { days: ['Mon'], slots: [slot()] } });
  f.press('Edit Monday hours'); f.click('Add more hours'); f.click('Choose exact hours');
  assert.equal(f.nodes().find(n => n.type === 'button' && f.text(n) === 'Save availability').props.disabled, true);
  assert.ok(f.text(f.tree).includes('Tap Add hours to keep this time range'));
  f.click('Hide exact hours');
  assert.equal(f.nodes().find(n => n.type === 'button' && f.text(n) === 'Save availability').props.disabled, false);
  assert.deepEqual(plain(f.states[0].slots), [slot()]);
});

test('saving locks day controls, prevents duplicate submission, and blocks closing until finished', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = fixture({ value: { days: ['Mon'], slots: [slot()] }, gate });
  f.click('Save availability');
  assert.equal(f.nodes().find(n => n.props?.accessibilityLabel === 'Monday availability').props.disabled, true);
  f.nodes().find(n => n.type === 'button' && n.props.accessibilityState?.busy).props.onPress();
  f.nodes().find(n => n.type === 'button' && f.text(n) === 'Cancel').props.onPress();
  f.tree.props.onRequestClose();
  assert.equal(f.closed, 0); assert.equal(f.saved.length, 1);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.closed, 1);
});

if (process.argv.includes('--render')) {
  const output = path.join(__dirname, '../.expo/weekly-schedule-review'); fs.mkdirSync(output, { recursive: true });
  const font = fs.readFileSync(path.join(__dirname, '../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf')).toString('base64');
  const poppins = fs.readFileSync(path.join(__dirname, '../node_modules/@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf')).toString('base64');
  const normalize = (node, index = 0) => {
    if (typeof node !== 'object' || node === null) return node;
    if (typeof node.type === 'function') return normalize(node.type(node.props));
    const p = node.props;
    const style = { ...p.style };
    for (const prefix of ['padding', 'margin']) {
      if (style[prefix + 'Horizontal'] !== undefined) {
        style[prefix + 'Left'] = style[prefix + 'Right'] = style[prefix + 'Horizontal'];
        delete style[prefix + 'Horizontal'];
      }
      if (style[prefix + 'Vertical'] !== undefined) {
        style[prefix + 'Top'] = style[prefix + 'Bottom'] = style[prefix + 'Vertical'];
        delete style[prefix + 'Vertical'];
      }
    }
    if (typeof style.lineHeight === 'number') style.lineHeight = style.lineHeight + 'px';
    const attributes = { key: node.key || String(index), className: node.type === 'div' ? 'view' : undefined, style, 'aria-label': p.accessibilityLabel, disabled: p.disabled, role: p.accessibilityRole, 'aria-checked': p.accessibilityState?.checked };
    if (node.type === 'input') return React.createElement('input', { ...attributes, defaultValue: p.value, placeholder: p.placeholder });
    return React.createElement(node.type, attributes, React.Children.toArray(p.children).map(normalize));
  };
  for (const role of ['student', 'job']) for (const isDark of [false, true]) for (const variant of ['empty', 'choose', 'overview', 'edit', 'custom', 'copy']) {
    dark = isDark;
    const slots = role === 'student' ? [slot('Mon', '09:30', '12:00'), slot('Mon', '13:00', '15:00'), slot('Wed', '22:00', '06:00', true)] : [slot('Mon', '10:00', '14:00'), slot('Wed', '18:00', '22:00')];
    const f = fixture({ mode: role, value: ['empty', 'choose'].includes(variant) ? { days: [], slots: [] } : { days: ['Mon', 'Wed'], slots } });
    if (variant === 'choose') f.press('Edit Monday hours');
    if (['edit', 'custom', 'copy'].includes(variant)) f.press('Edit Monday hours');
    if (variant === 'custom') { f.click('Add more hours'); f.click('Choose exact hours'); }
    if (variant === 'copy') f.click('Same hours on other days');
    const html = renderToStaticMarkup(normalize(f.tree));
    fs.writeFileSync(path.join(output, `${role}-${isDark ? 'dark' : 'light'}-${variant}.html`), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Poppins;src:url(data:font/ttf;base64,${poppins})}@font-face{font-family:MaterialIcons;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box;min-width:0}body{margin:0;font-family:Poppins,sans-serif}main{height:100vh;display:flex;flex-direction:column}main>.view{flex:1;min-height:0;display:flex;flex-direction:column}.view{display:flex;flex-direction:column;flex-shrink:0}section{flex:1;min-height:0;overflow:auto;padding:22px 16px 24px;display:flex;flex-direction:column}.view,button,input{border-style:solid;border-width:0}button{display:flex;flex-direction:column;align-items:stretch;text-align:left;font-family:inherit;cursor:pointer;flex-shrink:0;background:transparent}section>*{flex-shrink:0}span{display:block;flex-shrink:1;white-space:pre-wrap}i{flex-shrink:0}</style></head><body>${html}</body></html>`);
  }
  console.log('Rendered actual schedule components to ' + output);
}

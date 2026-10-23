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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}

function fixture(isHousehold, category) {
  const events = [], inputs = new Map(), scrolls = [];
  const react = { useRef: current => ({ current }), useState: value => [value, () => {}] };
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { findNodeHandle: input => input.field, Keyboard: { dismiss: () => events.push('dismiss') }, PanResponder: { create: () => ({ panHandlers: {} }) }, TextInput: 'TextInput', View: 'View', Text: 'Text', ScrollView: 'ScrollView', TouchableOpacity: 'Button' },
    '@expo/vector-icons': { MaterialIcons: 'Icon', MaterialCommunityIcons: 'Icon' },
    '@/components/ui/InputField': 'InputField', '@/components/ui/InputSuggestions': 'Suggestions', './JobFormSection': 'Section',
    '@/hooks/useDarkMode': { useDarkMode: () => ({ colors: { text: '#111', textSecondary: '#666', border: '#ccc' }, isDark: false }) },
    '@/data/jobCategories': { CATEGORY_OPTIONS: ['General', 'Other'] },
    '@/data/jobRequirements': { REQUIREMENT_SUGGESTIONS: [] }, '@/data/skills': { SKILL_SUGGESTIONS: [] },
    '@/utils/jobRate': { getSalaryUnit: () => '/ day' },
  };
  const { inputNavigation, formScrollRef } = load('hooks/useJobPostingKeyboard.ts', dependencies).useJobPostingKeyboard();
  formScrollRef.current = { scrollToFocusedInput: (field, gap, delay) => scrolls.push({ field, gap, delay }) };
  const Details = load('components/employer/job-posting/JobDetailsFields.tsx', dependencies).default;
  const Candidate = load('components/employer/job-posting/CandidateProfileFields.tsx', dependencies).default;
  const noop = () => {};
  const details = Details({ isHousehold, inputNavigation, isCategoryOpen: false, setIsCategoryOpen: noop, onScrollEnabledChange: noop, form: {
    jobTitle: 'Assistant', setJobTitle: noop, description: 'Help with tasks', setDescription: noop,
    salary: '500', handleSalaryChange: noop, salaryType: 'day', setSalaryType: noop,
    selectedCategory: category, setSelectedCategory: noop, customCategory: 'Gardening', setCustomCategory: noop,
  } });
  const candidate = Candidate({ inputNavigation, activeSuggestionField: null, setActiveSuggestionField: noop, form: {
    requirementInput: 'Valid ID', setRequirementInput: noop, requirements: [], handleAddRequirement: () => events.push('add requirement'), handleRemoveRequirement: noop,
    skillInput: 'Driving', setSkillInput: noop, skills: [], handleAddSkill: () => events.push('add skill'), handleRemoveSkill: noop,
  } });
  function mount(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(mount); return; }
    if (typeof node.type === 'function') { mount(node.type(node.props)); return; }
    const props = node.props || {};
    if (node.type === 'InputField' || node.type === 'TextInput') {
      const field = props.label === 'Job Title *' ? 'title' : props.label === 'Category name *' ? 'category'
        : props.multiline ? 'description' : props.keyboardType === 'decimal-pad' ? 'salary'
        : props.accessibilityLabel === 'Requirements' ? 'requirements' : 'skills';
      const native = { field, focus: () => { events.push(`focus ${field}`); props.onFocus?.(); } };
      (props.inputRef || props.ref)(native);
      inputs.set(field, props);
    }
    mount(props.children);
  }
  mount([details, candidate]);
  return { events, inputs, scrolls, inputNavigation, submit: field => inputs.get(field).onSubmitEditing() };
}

for (const isHousehold of [false, true]) {
  for (const category of ['General', 'Other']) {
    test(`${isHousehold ? 'household' : 'business'} ${category}: Next advances through mounted fields and Done commits the last skill`, () => {
      const app = fixture(isHousehold, category);
      app.submit('title'); assert.equal(app.events.at(-1), 'focus description');
      assert.equal(app.inputs.get('description').multiline, true);
      app.submit('description'); assert.equal(app.events.at(-1), 'focus salary');
      app.submit('salary'); assert.equal(app.events.at(-1), category === 'Other' ? 'focus category' : 'focus requirements');
      if (category === 'Other') { app.submit('category'); assert.equal(app.events.at(-1), 'focus requirements'); }
      app.submit('requirements'); assert.deepEqual(app.events.slice(-2), ['add requirement', 'focus skills']);
      app.submit('skills'); assert.deepEqual(app.events.slice(-2), ['add skill', 'dismiss']);
      assert.deepEqual(app.scrolls.map(item => item.field), ['description', 'salary', ...(category === 'Other' ? ['category'] : []), 'requirements', 'skills']);
      assert.ok(app.scrolls.every(item => item.gap === 24 && item.delay === 0), 'Next scrolls immediately even when the keyboard is already open');
      for (const [name, props] of app.inputs) {
        assert.equal(props.returnKeyType, name === 'skills' ? 'done' : 'next');
        assert.equal(props.submitBehavior, name === 'skills' ? 'blurAndSubmit' : 'submit');
      }
    });
  }
}

test('a removed conditional input dismisses the keyboard safely instead of targeting a stale native ref', () => {
  const app = fixture(true, 'Other');
  app.inputNavigation('category').inputRef(null);
  app.submit('salary');
  assert.equal(app.events.at(-1), 'dismiss');
});

test('direct taps on pay and candidate inputs keep the focus scroll along with their existing focus actions', () => {
  const app = fixture(true, 'Other');
  app.inputs.get('salary').onFocus();
  app.inputs.get('requirements').onFocus();
  app.inputs.get('skills').onFocus();
  assert.deepEqual(app.scrolls.map(item => item.field), ['salary', 'requirements', 'skills']);
});

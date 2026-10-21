// Run with: node scripts/test-job-posting.cjs
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
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console, AbortController, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename });
  return exports;
}

const categories = load('data/jobCategories.ts');
const schedule = load('data/jobSchedule.ts');
const weekly = load('utils/weeklySchedule.ts');
const rate = load('utils/jobRate.ts');
const quota = load('utils/jobQuota.ts');
const plain = value => JSON.parse(JSON.stringify(value));

async function fixture(options = {}) {
  const hooks = [], effects = [], requests = [], notifications = [], navigation = [];
  let cursor = 0, form;
  const state = { verified: true, response: { job: { id: 42 } }, ...options };
  const storage = new Map([
    ['userToken', 'session-token'],
    ['userData', JSON.stringify({ id: 7, name: 'Employer' })],
  ]);
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: initial, set(value) {
        hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
      } };
      return [hooks[index].value, hooks[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { current: initial };
      return hooks[index];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) { hooks[index] = { deps }; effects.push(callback); }
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!same(hooks[index]?.deps, deps)) hooks[index] = { deps, callback };
      return hooks[index].callback;
    },
  };
  const api = {
    defaults: { baseURL: 'https://backend.example/api' },
    async get(url) {
      if (url === '/user/profile') return { data: { profile: { isVerified: state.verified } } };
      if (url === '/employer/job-quota') return { data: { job_quota: state.quota } };
      if (url.startsWith('/jobs/')) return { data: { status: 'success', job: state.job } };
      throw Error(`Unexpected request: ${url}`);
    },
    async put(url, body) {
      requests.push({ method: 'PUT', url, body: plain(body) });
      return { data: { status: 'success' } };
    },
  };
  const { useJobPosting: runHook } = load('hooks/useJobPosting.ts', {
    '@/api/axios': api,
    '@/data/jobCategories': categories,
    '@/data/jobSchedule': schedule,
    '@/utils/weeklySchedule': weekly,
    '@/utils/weeklyScheduleApi': { async supportsWeeklySchedules() { return state.weeklySupport !== false; } },
    '@/utils/jobRate': rate,
    '@/utils/jobQuota': quota,
    '@/utils/notifications': { async sendAppNotification(params) { notifications.push(plain(params)); } },
    '@react-native-async-storage/async-storage': {
      async getItem(key) { return storage.get(key) ?? null; },
      async setItem(key, value) { storage.set(key, value); },
    },
    'expo-router': {
      useFocusEffect: callback => react.useEffect(callback, [callback]),
      router: { back() { navigation.push('back'); }, replace(url) { navigation.push(url); }, push(url) { navigation.push(url); } },
    },
    react,
  }, {
    console: { error() {}, warn() {} },
    async fetch(url, init) {
      requests.push({ method: init.method, url, headers: init.headers, body: JSON.parse(init.body) });
      if (state.gate) await state.gate;
      if (state.networkError) throw Error('Offline');
      return { ok: state.status ? state.status < 400 : true, status: state.status || 201, async json() { return state.response; } };
    },
  });
  function render() { cursor = 0; form = runHook(options.params || {}); return form; }
  render();
  for (const effect of effects.splice(0)) effect();
  await new Promise(setImmediate);
  render();

  function fill() {
    form.details.setJobTitle('Barista');
    form.details.setDescription('Prepare coffee');
    form.details.handleSalaryChange('500');
    form.candidate.setRequirementInput('Valid ID');
    form.candidate.setSkillInput('Customer service');
    form.schedule.handleToggleDay('Mon');
    form.schedule.setSelectedTimeSlots(['Morning (6AM - 12PM)']);
    return render();
  }
  return { get form() { return form; }, state, render, fill, requests, notifications, navigation };
}

test('new postings start with an empty schedule and validate required details before sending', async () => {
  const f = await fixture();
  assert.deepEqual(plain(f.form.schedule.selectedDays), []);
  assert.deepEqual(plain(f.form.schedule.selectedTimeSlots), []);
  await f.form.handleSubmit();
  f.render();
  assert.equal(f.form.notificationConfig.title, 'Incomplete Details');
  assert.equal(f.requests.length, 0);
  f.fill();
  f.form.schedule.setSelectedTimeSlots([]);
  f.render();
  await f.form.handleSubmit();
  f.render();
  assert.equal(f.form.notificationConfig.title, 'Schedule Required');
  assert.equal(f.requests.length, 0);
});

test('only new household postings request a today default in the schedule editor', async () => {
  const household = await fixture({ params: { type: 'household' } });
  assert.equal(household.form.schedule.defaultToToday, true);
  const business = await fixture();
  assert.equal(business.form.schedule.defaultToToday, false);
  const edited = await fixture({ params: { type: 'household', jobId: '42' }, job: { available_days: ['Sun'], time_slot: 'Evening (6PM - 10PM)' } });
  assert.equal(edited.form.schedule.defaultToToday, false);
  assert.deepEqual(plain(edited.form.schedule.weeklySchedule.days), ['Sun']);
});

test('unverified households are directed to the household document screen', async () => {
  const f = await fixture({ verified: false, params: { type: 'household' } });
  f.fill();
  await f.form.handleSubmit();
  f.render();
  assert.equal(f.requests.length, 0);
  assert.equal(f.form.notificationConfig.title, 'Verification Required');
  f.form.notificationConfig.onPrimaryPress();
  assert.equal(f.navigation.at(-1), '/employer/verification-status?type=household');
});

test('employer quota prevents creation while household creation does not use that quota', async () => {
  const full = { plan: 'basic', active_job_limit: 3, active_job_count: 3 };
  const employer = await fixture({ quota: full });
  employer.fill();
  await employer.form.handleSubmit();
  employer.render();
  assert.equal(employer.requests.length, 0);
  assert.equal(employer.form.notificationConfig.title, 'Active job limit reached');
  const household = await fixture({ quota: full, params: { type: 'household' } });
  household.fill();
  await household.form.handleSubmit();
  assert.equal(household.requests.length, 1);
});

test('create preserves the API payload, unsaved entries, deduplication and matched-student alerts', async () => {
  const f = await fixture({ response: { job: { id: 42 }, matched_students_count: 1, matched_students: [{ user_id: 9, formatted_distance: '2 km away' }] } });
  f.fill();
  f.form.candidate.setRequirementInput('Valid ID, Resume, Valid ID');
  f.render();
  f.form.candidate.handleAddRequirement();
  f.render();
  f.form.candidate.setRequirementInput('Resume, COE');
  f.form.candidate.setSkillInput('Coffee making, Customer service');
  f.form.details.handleSalaryChange('PHP 125.456');
  f.form.details.setSalaryType('hour');
  f.form.details.setSelectedCategory('Other');
  f.form.details.setCustomCategory('Cafe');
  f.form.schedule.setSelectedTimeSlots(['Morning (6AM - 12PM)', 'Afternoon (1PM - 5PM)']);
  f.render();
  await f.form.handleSubmit();
  assert.equal(f.requests[0].headers.Authorization, 'Bearer session-token');
  assert.deepEqual(f.requests[0].body, {
    title: 'Barista', description: 'Prepare coffee', salary: '125.45', salary_type: 'hour', category: 'Cafe',
    available_days: ['Mon'], time_slot: 'Morning (6AM - 12PM) & Afternoon (1PM - 5PM)',
    schedule_slots: [
      { day_of_week: 'Mon', start_time: '06:00', end_time: '12:00', ends_next_day: false },
      { day_of_week: 'Mon', start_time: '13:00', end_time: '17:00', ends_next_day: false },
    ],
    requirements: ['Valid ID', 'Resume', 'COE'], skills: ['Coffee making', 'Customer service'],
  });
  assert.equal(f.notifications.length, 1);
  assert.equal(f.notifications[0].recipientId, 9);
  assert.equal(f.notifications[0].targetId, 42);
  assert.equal(f.notifications[0].type, 'new_job');
  f.render();
  assert.equal(f.form.loading, false);
  assert.equal(f.form.notificationConfig.title, 'Job Posted!');
  f.form.notificationConfig.onPrimaryPress();
  assert.equal(f.navigation.at(-1), 'back');
});

test('edit loads saved JSON lists, a custom category and legacy schedules before updating', async () => {
  const f = await fixture({ params: { jobId: '42' }, job: {
    title: 'Tutor', description: 'Teach math', salary: 300, salary_type: 'hour', category: 'Math',
    available_days: '["Tue"]', time_slot: 'Custom saved hours', requirements: '["Resume"]', skills: ['Teaching'],
    schedule_slots: [{ day_of_week: 'Tue', start_time: '09:30', end_time: '12:00', ends_next_day: false }],
  } });
  assert.equal(f.form.details.selectedCategory, 'Other');
  assert.equal(f.form.details.customCategory, 'Math');
  assert.deepEqual(plain(f.form.schedule.selectedTimeSlots), ['Custom saved hours']);
  await f.form.handleSubmit();
  assert.deepEqual(f.requests[0], {
    method: 'PUT', url: '/jobs/42', body: {
      title: 'Tutor', description: 'Teach math', salary: '300', salary_type: 'hour', category: 'Math',
      available_days: ['Tue'], time_slot: 'Custom saved hours', requirements: ['Resume'], skills: ['Teaching'],
      schedule_slots: [{ day_of_week: 'Tue', start_time: '09:30', end_time: '12:00', ends_next_day: false }],
    },
  });
  assert.equal(f.notifications.length, 0);
  f.render();
  assert.equal(f.form.notificationConfig.title, 'Job Updated');
});

test('double taps cannot create two postings while the first submission is pending', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = await fixture({ gate });
  f.fill();
  const first = f.form.handleSubmit();
  await f.form.handleSubmit();
  release();
  await first;
  assert.equal(f.requests.length, 1);
});

test('a network failure clears the submission guard so the user can retry', async () => {
  const f = await fixture({ networkError: true });
  f.fill();
  await f.form.handleSubmit();
  f.render();
  assert.equal(f.form.loading, false);
  assert.equal(f.form.notificationConfig.title, 'Network Error');
  f.state.networkError = false;
  await f.form.handleSubmit();
  f.render();
  assert.equal(f.requests.length, 2);
  assert.equal(f.form.notificationConfig.title, 'Job Posted!');
});

test('per-day custom and night hours survive create without applying a global time slot', async () => {
  const f = await fixture(); f.fill();
  const slots = [
    { day_of_week: 'Mon', start_time: '09:30', end_time: '12:00', ends_next_day: false },
    { day_of_week: 'Mon', start_time: '13:00', end_time: '15:00', ends_next_day: false },
    { day_of_week: 'Wed', start_time: '22:00', end_time: '06:00', ends_next_day: true },
  ];
  f.form.schedule.setWeeklySchedule({ days: ['Mon', 'Wed'], slots }); f.render();
  await f.form.handleSubmit();
  assert.deepEqual(f.requests[0].body.schedule_slots, slots);
  assert.deepEqual(f.requests[0].body.available_days, ['Mon', 'Wed']);
});

test('older servers cannot silently accept a summary and drop exact hours', async () => {
  const f = await fixture({ weeklySupport: false }); f.fill();
  await f.form.handleSubmit(); f.render();
  assert.equal(f.requests.length, 0);
  assert.equal(f.form.notificationConfig.title, 'Schedule update unavailable');
  assert.equal(f.form.details.jobTitle, 'Barista');
});

// Run with: node --test scripts/test-applicant-details.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function load(file, dependencies = {}, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, Error, URLSearchParams, console: { error() {} }, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename });
  return exports;
}

async function fixture(options = {}) {
  const application = { id: 42, status: 'viewed', student: { user_id: 21, student_name: 'Alex Reyes', available_days: '["Sat","Sun"]', student_resume: 'resume.pdf' },
    job: { id: 7, title: 'Weekend assistant', salary: 450, salary_type: 'day', employer: { location: 'Pinamalayan' } } };
  const state = { application, response: { status: 'success' }, failChat: false, failNotification: false, ...options };
  const requests = [], messages = [], notifications = [], navigation = [], rooms = [], browser = [], links = [], timers = new Map();
  const slots = [], effects = [];
  let cursor = 0, current, focusCallback, cleanup, nextTimer = 0, storedOwnerReads = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: initial, set(value) { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; } }; return [slots[index].value, slots[index].set]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useCallback(callback, deps) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { deps, callback }; return slots[index].callback; },
  };
  const api = {
    defaults: { baseURL: 'https://backend.example/api' },
    async get(url) {
      requests.push(['GET', url]);
      if (state.get) return state.get(url);
      if (url === '/user/profile') return { data: { status: 'success', profile: { detailed_address: 'Zone 1', location: 'Pinamalayan' } } };
      if (url.endsWith('/reviews')) return { data: { status: 'success', data: { has_reviewed: false } } };
      if (url.endsWith('/certificate-data')) return { data: { certificate: { certificate_number: 'DT-COE-42' } } };
      return { data: { status: 'success', application: state.application } };
    },
    async put(url, data) { requests.push(['PUT', url, plain(data)]); return state.put ? state.put(url, data) : { data: state.response }; },
    async post(url, data) { requests.push(['POST', url, plain(data)]); return state.post ? state.post(url, data) : { data: state.response }; },
    async delete(url) { requests.push(['DELETE', url]); return { data: state.response }; },
  };
  const chat = {
    resolveStudentFromRecord: student => ({ student_user_id: student.user_id ? String(student.user_id) : 'unknown', student_name: student.student_name || 'Student Applicant' }),
    resolveOwnerFromJob: () => state.owner || { owner_user_id: '10', owner_name: 'Business owner', owner_role: 'employer', owner_avatar: 'owner.png' },
    isGenericName: name => !name || name === 'Employer',
    getOwnerParticipantFromStorage: async () => { storedOwnerReads++; return { owner_user_id: '77', owner_name: 'Household owner', owner_role: 'household', owner_avatar: 'household.png' }; },
    ensureChatRoom: async params => { rooms.push(plain(params)); return 'chat-10-21'; },
    sendChatMessage: async params => { if (state.failChat) throw new Error('Chat offline'); messages.push(plain(params)); },
  };
  const helpers = load('utils/applicantDetails.ts', {
    axios: { isAxiosError: error => Boolean(error.isAxiosError) }, '@/utils/chat': chat,
    '@/utils/notifications': { sendAppNotification: async data => { if (state.failNotification) throw new Error('Notification offline'); notifications.push(plain(data)); } },
  });
  const rate = load('utils/jobRate.ts');
  const time = load('utils/interviewTime.ts');
  const router = { push: value => navigation.push(value), back: () => navigation.push('back') };
  const useDetails = load('hooks/useApplicantDetails.ts', { react, '@/api/axios': api, 'expo-router': { useFocusEffect(callback) {
    if (callback !== focusCallback) { focusCallback = callback; effects.push(() => { cleanup?.(); cleanup = callback(); }); }
  } } }, { setInterval: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; }, clearInterval: id => timers.delete(id) }).useApplicantDetails;
  const useActions = load('hooks/useApplicantActions.ts', { react, '@/api/axios': api, '@/utils/applicantDetails': helpers,
    '@/utils/chat': chat, '@/utils/interviewTime': time, '@/utils/jobRate': rate,
    'expo-router': { router }, 'react-native': { Keyboard: { dismiss() {} } },
  }).useApplicantActions;
  const useDocuments = load('hooks/useApplicantDocuments.ts', { react, '@/api/axios': api, '@/utils/applicantDetails': helpers,
    '@/utils/media': { resolveMediaUrl: value => value ? `https://media.example/${value}` : null, mediaFilename: value => value.split('/').pop() },
    'expo-web-browser': { openBrowserAsync: async url => { browser.push(url); if (state.failBrowser) throw new Error('Browser unavailable'); } },
    'react-native': { Linking: { openURL: async url => { links.push(url); if (state.failLink) throw new Error('Link unavailable'); } } },
  }).useApplicantDocuments;
  const app = { state, requests, messages, notifications, navigation, rooms, browser, links, timers, helpers,
    render: function useApplicantModel() {
      cursor = 0;
      const details = useDetails(state.missingId ? undefined : '42');
      const context = { applicationId: '42', application: details.application, setApplication: details.setApplication };
      const actions = useActions(context);
      const documents = useDocuments({ ...context, showNotice: actions.showNotice, withBusyAction: actions.withBusyAction, closeWhenIdle: actions.closeWhenIdle });
      current = { details, actions, documents };
      return current;
    },
    get current() { return app.render(); },
    get storedOwnerReads() { return storedOwnerReads; },
    stop() { cleanup?.(); },
    async poll() { for (const timer of timers.values()) timer.callback(); await tick(); app.render(); },
  };
  app.render(); while (effects.length) effects.shift()(); await tick(); app.render();
  return app;
}

test('details load on focus, refresh in the background, and ignore in-flight results after leaving', async () => {
  const app = await fixture();
  assert.equal(app.current.details.loading, false);
  assert.equal(app.current.details.application.id, 42);
  assert.equal(app.current.details.availableDaysText, 'Sat, Sun');
  assert.equal(app.current.details.contractReview.has_reviewed, false);
  assert.deepEqual([...app.timers.values()].map(timer => timer.delay), [2500]);
  const pending = deferred();
  app.state.get = () => pending.promise;
  const poll = app.poll();
  assert.equal(app.current.details.loading, false);
  app.stop();
  assert.equal(app.timers.size, 0);
  pending.resolve({ data: { status: 'success', application: { id: 99 } } });
  await poll;
  assert.equal(app.current.details.application.id, 42);
});

test('missing application IDs finish loading without making requests', async () => {
  const app = await fixture({ missingId: true });
  assert.equal(app.current.details.loading, false);
  assert.equal(app.current.details.application, null);
  assert.equal(app.requests.length, 0);
  assert.equal(app.timers.size, 0);
});

test('reject confirmation deduplicates repeated taps and failures preserve the current status', async () => {
  const app = await fixture();
  app.current.actions.reject();
  const confirmation = app.current.actions.notification;
  assert.equal(confirmation.secondaryButtonText, 'Cancel');
  const pending = deferred(); app.state.put = () => pending.promise;
  const first = confirmation.onPrimaryPress();
  const second = confirmation.onPrimaryPress();
  assert.equal(app.current.actions.busyAction, 'Reject');
  assert.equal(app.requests.filter(request => request[0] === 'PUT').length, 1);
  pending.resolve({ data: { status: 'error', message: 'You cannot update this application.' } });
  await Promise.all([first, second]);
  assert.equal(app.current.details.application.status, 'viewed');
  assert.equal(app.current.actions.disabled, false);
  assert.match(app.current.actions.notification.message, /cannot update/);
  assert.equal(app.notifications.length, 0);
  assert.equal(app.messages.length, 0);
});

test('hiring preserves all contract fields and stays successful when chat and notifications are unavailable', async () => {
  const app = await fixture({ failChat: true, failNotification: true });
  const data = { start_date: '2026-10-20', end_date: 'Project-based', work_schedule: 'Sat, Sun', agreed_rate: '450', contract_terms: 'Follow the agreed schedule.', special_instructions: 'Arrive at 8AM.' };
  app.current.actions.openHire();
  await app.current.actions.hire(data);
  assert.deepEqual(app.requests.find(request => request[0] === 'PUT'), ['PUT', '/employer/applications/42/status', { status: 'accepted', ...data }]);
  assert.equal(app.current.details.application.status, 'accepted');
  assert.equal(app.current.details.application.contract_terms, data.contract_terms);
  assert.ok(app.current.details.application.hired_at);
  assert.equal(app.current.actions.hireVisible, false);
  assert.equal(app.current.actions.hireSuccessVisible, true);
});

test('failed hiring keeps the form open and propagates its error to HireModal', async () => {
  const app = await fixture({ response: { status: 'error', message: 'Invalid contract dates.' } });
  app.current.actions.openHire();
  await assert.rejects(app.current.actions.hire({ start_date: 'bad' }), /Invalid contract dates/);
  assert.equal(app.current.actions.hireVisible, true);
  assert.equal(app.current.actions.hireSuccessVisible, false);
  assert.equal(app.current.details.application.status, 'viewed');
  assert.equal(app.notifications.length, 0);
});

test('completion confirms first, then updates status and delivers the matching notices', async () => {
  const app = await fixture();
  app.current.actions.complete();
  assert.match(app.current.actions.notification.message, /Alex Reyes/);
  await app.current.actions.notification.onPrimaryPress();
  assert.equal(app.current.details.application.status, 'completed');
  assert.ok(app.current.details.application.updated_at);
  assert.equal(app.notifications[0].targetId, '42');
  assert.match(app.messages[0].text, /successfully completed/);
  assert.equal(app.current.actions.notification.title, 'Contract Completed');
});

test('termination uses the saved reason and resolves incomplete hirer details from storage', async () => {
  const app = await fixture({ owner: { owner_user_id: 'unknown', owner_name: 'Employer', owner_avatar: '', owner_role: 'employer' } });
  app.current.actions.openTerminate();
  await app.current.actions.terminate('Project ended.');
  assert.equal(app.current.details.application.termination_reason, 'Project ended.');
  assert.equal(app.current.details.application.status, 'terminated');
  assert.equal(app.current.actions.terminateVisible, false);
  assert.equal(app.storedOwnerReads, 1);
  assert.equal(app.rooms[0].owner.owner_role, 'household');
  assert.equal(app.messages[0].senderId, '77');
  assert.equal(app.messages[0].receiverId, '21');
  assert.match(app.messages[0].text, /Reason: Project ended\./);
});

test('interview form uses the hirer address and failed chat delivery does not undo the saved invitation', async () => {
  const app = await fixture({ failChat: true });
  await app.current.actions.prepareInterview();
  assert.equal(app.current.actions.interviewVisible, true);
  assert.equal(app.current.actions.interviewLocation, 'Zone 1, Pinamalayan');
  await app.current.actions.sendInterview('walk-in', '2026-10-20', '10:00 AM', '  ');
  assert.equal(app.requests.filter(request => request[0] === 'PUT').length, 0);
  await app.current.actions.sendInterview('online', '2026-10-20', '13:30', 'Ignored address');
  const request = app.requests.find(item => item[0] === 'PUT');
  assert.equal(request[2].interview_location, 'DiskarTech video call');
  assert.equal(request[2].interview_time, '01:30 PM');
  assert.equal(app.current.details.application.status, 'interview');
  assert.equal(app.current.actions.interviewVisible, false);
  assert.equal(app.notifications[0].title, 'Interview Invitation');
  assert.match(app.current.actions.notification.message, /chat message could not be delivered/);
});

test('certificate signing is locked during submission and only approves after a successful response', async () => {
  const app = await fixture();
  app.current.documents.openSignature();
  const pending = deferred(); app.state.post = () => pending.promise;
  const first = app.current.documents.confirmSignature('signature-data');
  app.current.documents.closeSignature();
  const second = app.current.documents.confirmSignature('duplicate');
  assert.equal(app.current.documents.signatureVisible, true);
  assert.equal(app.current.documents.approvingCertificate, true);
  pending.resolve({ data: { status: 'error', message: 'Signature was not accepted.' } });
  await Promise.all([first, second]);
  assert.equal(app.requests.filter(request => request[0] === 'POST').length, 1);
  assert.equal(app.current.documents.signatureVisible, true);
  assert.equal(app.current.details.application.certificate_status, undefined);
  assert.equal(app.current.actions.notification.message, 'Signature was not accepted.');
  app.state.post = null;
  await app.current.documents.confirmSignature('signature-data');
  assert.equal(app.current.documents.signatureVisible, false);
  assert.equal(app.current.details.application.certificate_status, 'approved');
  assert.equal(app.current.details.application.employer_signature, 'signature-data');
  assert.equal(app.notifications.at(-1).title, 'Certificate of Employment Ready! 📜');
});

test('document preview, refreshed resume links, and browser fallback retain their original destinations', async () => {
  const app = await fixture({ failBrowser: true });
  await app.current.documents.previewCertificate();
  assert.equal(app.current.documents.certificateVisible, true);
  assert.equal(app.current.documents.certificateData.certificate_number, 'DT-COE-42');
  await app.current.documents.openResume();
  assert.equal(app.current.documents.resumeVisible, true);
  assert.equal(app.current.documents.resumeUrl, 'https://media.example/resume.pdf');
  assert.equal(app.current.documents.resumeFilename, 'resume.pdf');
  await app.current.documents.downloadCertificate();
  assert.deepEqual(app.browser, ['https://backend.example/certificate/42/view']);
  assert.deepEqual(app.links, app.browser);
});

test('delete waits for confirmation and success acknowledgement before navigating back', async () => {
  const app = await fixture();
  app.current.actions.deleteApplication();
  assert.equal(app.requests.filter(request => request[0] === 'DELETE').length, 0);
  await app.current.actions.notification.onPrimaryPress();
  assert.equal(app.requests.filter(request => request[0] === 'DELETE').length, 1);
  assert.equal(app.navigation.length, 0);
  app.current.actions.notification.onPrimaryPress();
  assert.deepEqual(app.navigation, ['back']);
});

const jsx = (type, props) => ({ type, props });
const Modals = load('components/employer/applicant-details/ApplicantDetailsModals.tsx', {
  react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  '@/components/common/CertificateModal': 'Certificate', '@/components/employer/modals/DigitalSignatureModal': 'Signature',
  '@/components/employer/modals/HireModal': 'Hire', '@/components/employer/modals/InterviewModal': 'Interview',
  '@/components/employer/modals/TerminateContractModal': 'Terminate', '@/components/ui/modals/DocumentViewerModal': 'Resume',
  '@/components/ui/modals/NotificationModal': 'Notice', '@/utils/chat': { resolveOwnerFromJob: () => ({ owner_name: 'Business owner' }) },
}).default;

test('signing errors render inside the active signature modal instead of behind it', async () => {
  const app = await fixture({ response: { status: 'error', message: 'Signature rejected.' } });
  app.current.documents.openSignature();
  await app.current.documents.confirmSignature('signature-data');
  const model = app.current;
  const children = Modals(model).props.children.filter(Boolean);
  const signature = children.find(node => node.type === 'Signature');
  assert.equal(signature.props.visible, true);
  assert.equal(signature.props.notification.props.visible, true);
  assert.equal(signature.props.notification.props.message, 'Signature rejected.');
  assert.equal(children.filter(node => node.type === 'Notice' && node.props.visible).length, 0);
  assert.equal(signature.props.onSubmit, model.documents.confirmSignature);
});

test('interview validation errors stay in the interview modal and controls use the current schedule', async () => {
  const app = await fixture();
  await app.current.actions.prepareInterview();
  app.current.actions.setInterviewDate('2026-10-20');
  app.current.actions.setInterviewTime('10:00 AM');
  await app.current.actions.sendInterview('walk-in', '2026-10-20', '10:00 AM', '');
  const children = Modals(app.current).props.children.filter(Boolean);
  const interview = children.find(node => node.type === 'Interview');
  assert.equal(interview.props.visible, true);
  assert.equal(interview.props.date, '2026-10-20');
  assert.equal(interview.props.time, '10:00 AM');
  assert.equal(interview.props.notification.props.title, 'Incomplete Details');
  assert.equal(children.filter(node => node.type === 'Notice' && node.props.visible).length, 0);
});

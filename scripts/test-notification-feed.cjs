// Run with: node scripts/test-notification-feed.cjs
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.join(__dirname, '../utils/notificationFeed.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { mergeNotificationSources, getCreatedApplicationId } = loaded.exports;

const api = {
  id: 'app_27', type: 'application_status', title: 'Interview Invitation',
  targetId: 27, rawApplication: { id: 27, status: 'interview' },
  message: { type: 'Text', props: { children: 'You are invited for an interview for test maeami.' } },
  read: true, timestampMs: 100, timestamp: '1m ago',
};
const live = {
  id: 'firestore_invite', firestoreDocId: 'invite', type: 'application_status',
  title: 'Interview Invitation', targetId: '27',
  message: 'You are invited for an interview for "test maeami".',
  read: false, timestampMs: 200, timestamp: 'Just now',
};

test('API summary and live invitation become one unread card despite different message formats', () => {
  const feed = mergeNotificationSources([api], [live]);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].read, false);
  assert.equal(feed[0].message, live.message);
  assert.deepEqual(feed[0].rawApplication, api.rawApplication);
  assert.equal(feed[0].targetId, 27);
  assert.deepEqual(feed[0].mergedIds, ['app_27', 'firestore_invite']);
});

test('different applications with the same job title never merge', () => {
  const second = { ...live, id: 'firestore_other', targetId: '28' };
  assert.equal(mergeNotificationSources([api], [live, second]).length, 2);
});

test('interview and approval events for one application remain separate', () => {
  const approved = { ...live, id: 'approved', title: 'Application Approved' };
  assert.equal(mergeNotificationSources([api], [live, approved]).length, 2);
});

test('invitation chat stays separate and still routes to the chat', () => {
  const chat = { id: 'chat_abc', type: 'message', title: 'BUSINESS', message: 'Hello, you are invited.', targetId: 'abc', read: false };
  const feed = mergeNotificationSources([api], [live], [chat]);
  assert.equal(feed.length, 2);
  assert.equal(feed.find(n => n.type === 'message').targetId, 'abc');
});

test('duplicate live records preserve every read ID and newest timestamp', () => {
  const duplicate = { ...live, id: 'firestore_rescheduled', firestoreDocId: 'rescheduled', timestampMs: 300, timestamp: 'Newest' };
  const merged = mergeNotificationSources([api], [live, duplicate])[0];
  assert.deepEqual(merged.mergedIds, ['app_27', 'firestore_invite', 'firestore_rescheduled']);
  assert.equal(merged.timestampMs, 300);
  assert.equal(merged.timestamp, 'Newest');
});

test('marking all merged source records read clears the invitation unread count', () => {
  const feed = mergeNotificationSources([api], [live]);
  const readIds = new Set(feed.flatMap(n => n.mergedIds));
  const markedApi = [{ ...api, read: readIds.has(api.id) }];
  const markedLive = [{ ...live, read: readIds.has(live.id) }];
  assert.equal(mergeNotificationSources(markedApi, markedLive).filter(n => !n.read).length, 0);
});

test('an unread reschedule remains unread even if an older invitation was read', () => {
  const older = { ...live, read: true };
  const newer = { ...live, id: 'firestore_new', firestoreDocId: 'new', timestampMs: 300 };
  assert.equal(mergeNotificationSources([api], [older, newer])[0].read, false);
});

test('API-only invitation remains available when Firestore has no records', () => {
  assert.equal(mergeNotificationSources([api], [])[0].id, api.id);
});

test('newest notifications stay first across sources regardless of read state', () => {
  const newest = { id: 'newest-read', type: 'message', message: 'New message', read: true, timestampMs: 500 };
  const oldest = { id: 'oldest-unread', type: 'new_job', message: 'Old job alert', read: false, timestampMs: 50 };
  const unknown = { id: 'missing-date', type: 'general', message: 'No date', read: false };
  const feed = mergeNotificationSources([api, oldest], [unknown, live], [newest]);
  assert.deepEqual(feed.map(n => n.id), ['newest-read', 'app_27', 'oldest-unread', 'missing-date']);
  assert.equal(feed[1].timestampMs, live.timestampMs);
});

test('general updates keep legacy matching, newest-first order, and source records intact', () => {
  const original = JSON.stringify([api, live]);
  const general = { id: 'update', type: 'general', title: 'Update', message: 'Hello!', timestampMs: 400 };
  const duplicate = { ...general, id: 'update-copy', message: ' hello ' };
  const feed = mergeNotificationSources([api, general], [live, duplicate]);
  assert.equal(feed.length, 2);
  assert.equal(feed[0].id, 'update');
  assert.equal(JSON.stringify([api, live]), original);
});

const applicant = {
  id: 'app_65', type: 'application', title: 'New Applicant', targetId: 65,
  jobId: 27, senderId: 10, rawApplication: { id: 65, job_id: 27, student: { user_id: 10 } },
  message: 'Kent Fabunan applied for "tes".', read: true, timestampMs: 1000000,
};
const legacyApplicant = {
  id: 'firestore_legacy', firestoreDocId: 'legacy', type: 'application', title: 'New Applicant',
  targetId: '27', senderId: '10', message: applicant.message, read: false, timestampMs: 1001000,
};

test('apply-job response uses the created application ID rather than the job ID', () => {
  assert.equal(getCreatedApplicationId({ status: 'success', data: { id: 65, job_id: 27 } }), '65');
  assert.equal(getCreatedApplicationId({ application: { id: 66 } }), '66');
  assert.equal(getCreatedApplicationId({ application_id: '67' }), '67');
  assert.equal(getCreatedApplicationId({ id: 68 }), '68');
  assert.equal(getCreatedApplicationId({ data: { job_id: 27 } }), undefined);
  assert.equal(getCreatedApplicationId({ data: { id: '<script>65</script>' } }), undefined);
});

test('legacy employer/household alert with a job target merges into the correct applicant', () => {
  const originals = JSON.stringify([applicant, legacyApplicant]);
  const feed = mergeNotificationSources([applicant], [legacyApplicant]);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].targetId, 65);
  assert.equal(feed[0].read, false);
  assert.deepEqual(feed[0].mergedIds, ['app_65', 'firestore_legacy']);
  assert.equal(JSON.stringify([applicant, legacyApplicant]), originals);
});

test('new alerts use their explicit application ID and retain every read source', () => {
  const corrected = { ...legacyApplicant, targetId: '65', applicationId: '65', jobId: '27' };
  const duplicate = { ...corrected, id: 'firestore_duplicate', firestoreDocId: 'duplicate', read: true };
  const feed = mergeNotificationSources([applicant], [corrected, duplicate]);
  assert.equal(feed.length, 1);
  assert.equal(feed.filter(n => !n.read).length, 1);
  assert.deepEqual(feed[0].mergedIds, ['app_65', 'firestore_legacy', 'firestore_duplicate']);
  const readIds = new Set(feed[0].mergedIds);
  const markRead = n => ({ ...n, read: readIds.has(n.id) });
  assert.equal(mergeNotificationSources([markRead(applicant)], [markRead(corrected), markRead(duplicate)]).filter(n => !n.read).length, 0);
});

test('legacy job ID collision does not merge a different student or job', () => {
  const collision = { ...applicant, id: 'app_27', targetId: 27, senderId: 11, rawApplication: { id: 27, job_id: 99, student: { user_id: 11 } } };
  const feed = mergeNotificationSources([collision, applicant], [legacyApplicant]);
  assert.equal(feed.length, 2);
  assert.deepEqual(feed.find(n => n.targetId === 65).mergedIds, ['app_65', 'firestore_legacy']);
  assert.deepEqual(feed.find(n => n.targetId === 27).mergedIds, ['app_27']);
  assert.equal(mergeNotificationSources([collision], [legacyApplicant]).length, 2);
});

test('two students with the same displayed name do not merge', () => {
  const otherStudent = { ...applicant, id: 'app_66', targetId: 66, senderId: 11, rawApplication: { id: 66, job_id: 27, student: { user_id: 11 } } };
  const feed = mergeNotificationSources([applicant, otherStudent], [legacyApplicant]);
  assert.equal(feed.length, 2);
  assert.deepEqual(feed.find(n => n.targetId === 66).mergedIds, ['app_66']);
});

test('ambiguous or older resubmissions stay separate', () => {
  const resubmitted = { ...applicant, id: 'app_66', targetId: 66, rawApplication: { ...applicant.rawApplication, id: 66 } };
  assert.equal(mergeNotificationSources([applicant, resubmitted], [legacyApplicant]).length, 3);
  assert.equal(mergeNotificationSources([{ ...applicant, timestampMs: 1 }], [legacyApplicant]).length, 2);
});

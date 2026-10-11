/* global __dirname */
// Run with: node scripts/test-report-form.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const loaded = new Module(filename, module);
  loaded.require = name => name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  cache.set(filename, loaded.exports);
  return loaded.exports;
}
const { buildReportPayload, REPORT_REASONS } = load(path.join(__dirname, '../utils/reportForm.ts'));
const input = { reason: 'unsafe', description: 'Safety concern.', targetType: 'job', targetName: 'Test job', jobId: '27', reportedUserId: '2' };

test('report screen payload preserves its listing, hirer and reason', () => {
  assert.deepEqual(buildReportPayload(input), { job_id: '27', reported_user_id: '2', report_type: 'unsafe', subject: 'Unsafe Workplace - Test job', description: 'Safety concern.' });
  assert.equal(REPORT_REASONS.length, 6);
});
test('ordinary report text is normalized without losing line breaks', () => {
  assert.equal(buildReportPayload({ ...input, description: '  Concern\r\nMore detail\x00\u202e  ' }).description, 'Concern\nMore detail');
});
test('general platform reports allow no job or hirer', () => {
  const payload = buildReportPayload({ reason: 'other', description: 'Platform concern.', targetType: 'user' });
  assert.equal(payload.job_id, null);
  assert.equal(payload.reported_user_id, null);
});
for (const [label, change] of [
  ['empty explanation', { description: ' \r\n\x00 ' }],
  ['too long explanation', { description: 'a'.repeat(2001) }],
  ['raw HTML', { description: '<script>alert(1)</script>' }],
  ['encoded HTML', { description: '&lt;img src=x&gt;' }],
  ['invalid reason', { reason: 'invented' }],
  ['invalid job ID', { jobId: '27 OR 1=1' }],
  ['invalid hirer ID', { reportedUserId: '<script>2</script>' }],
  ['missing job target', { jobId: '' }],
]) {
  test(label + ' is blocked before the request', () => assert.throws(() => buildReportPayload({ ...input, ...change })));
}
test('job titles cannot inject markup into report subjects', () => {
  assert.equal(buildReportPayload({ ...input, targetName: '<script>bad title</script>' }).subject, 'Unsafe Workplace - DiskarTech');
  assert.equal(buildReportPayload({ ...input, targetName: 'a'.repeat(400) }).subject.length, 255);
});
